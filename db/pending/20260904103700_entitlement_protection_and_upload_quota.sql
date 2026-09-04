-- =============================================================================
-- PENDING / NOT APPLIED.
--
-- This file lives outside supabase/migrations/ on purpose. The migration
-- directory is managed by Lovable's migration tool, which *applies* SQL as a
-- side effect of writing the file, and this change was explicitly requested to
-- be committed without touching the live database. Move/apply it deliberately
-- when you are ready.
--
-- Phase A: entitlement protection + concurrency-safe upload quota.
-- Additive only. No existing row is backfilled or modified.
--
-- 1. Clients can no longer self-grant a paid tier or reset their own upload
--    counter: entitlement columns on public.profiles become writable only by
--    trusted server-side code.
-- 2. Upload allowance moves into the database: reserve_upload_slot() takes a
--    row-level lock, uses database time for the calendar-month reset, and
--    returns the decision atomically. release_upload_slot() compensates when
--    the import fails after reservation.
-- 3. transactions gains nullable direction/import_version so signed cash flow
--    can be stored without changing the meaning of legacy rows (direction IS
--    NULL keeps its historic "treat as spending" semantics).
-- 4. upload_history gains csv_hash (idempotency) and total_credits.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Entitlement protection
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_request_role()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT current_setting('role', true);
$$;

REVOKE ALL ON FUNCTION public.current_request_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_request_role() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_request_role() TO service_role;

-- Trusted server code opts in explicitly by setting app.entitlements_writable
-- inside its own transaction (see reserve_upload_slot / release_upload_slot).
CREATE OR REPLACE FUNCTION public.entitlement_writes_allowed()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT coalesce(current_setting('app.entitlements_writable', true), '') = 'on'
      OR coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role'
      OR current_user = 'service_role'
      OR current_user = 'postgres';
$$;

REVOKE ALL ON FUNCTION public.entitlement_writes_allowed() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.entitlement_writes_allowed() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.entitlement_writes_allowed() TO service_role;

-- Reject client-side changes to billing/quota fields. On UPDATE the old values
-- are forced back, so a malicious PATCH silently no-ops instead of granting
-- Premium. On INSERT the fields fall back to free-tier defaults.
CREATE OR REPLACE FUNCTION public.protect_profile_entitlements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.entitlement_writes_allowed() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.subscription_tier    := 'free';
    NEW.monthly_uploads_used := 0;
    NEW.uploads_reset_date   := (now() AT TIME ZONE 'utc')::date;
    RETURN NEW;
  END IF;

  NEW.subscription_tier    := OLD.subscription_tier;
  NEW.monthly_uploads_used := OLD.monthly_uploads_used;
  NEW.uploads_reset_date   := OLD.uploads_reset_date;

  -- Only guard columns that exist on this schema version.
  IF to_jsonb(NEW) ? 'subscription_end' THEN
    NEW.subscription_end := OLD.subscription_end;
  END IF;
  IF to_jsonb(NEW) ? 'stripe_customer_id' THEN
    NEW.stripe_customer_id := OLD.stripe_customer_id;
  END IF;
  IF to_jsonb(NEW) ? 'stripe_subscription_id' THEN
    NEW.stripe_subscription_id := OLD.stripe_subscription_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_entitlements_ins ON public.profiles;
CREATE TRIGGER protect_profile_entitlements_ins
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_entitlements();

DROP TRIGGER IF EXISTS protect_profile_entitlements_upd ON public.profiles;
CREATE TRIGGER protect_profile_entitlements_upd
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_entitlements();

-- The old client-callable increment is superseded by reserve_upload_slot.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'increment_monthly_uploads'
  ) THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.increment_monthly_uploads(uuid) FROM PUBLIC';
    EXECUTE 'REVOKE ALL ON FUNCTION public.increment_monthly_uploads(uuid) FROM anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.increment_monthly_uploads(uuid) TO service_role';
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 2. Upload quota (database time, row-locked)
-- -----------------------------------------------------------------------------

-- NULL limit = unlimited.
CREATE OR REPLACE FUNCTION public.upload_limit_for_tier(_tier text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE lower(coalesce(_tier, 'free'))
           WHEN 'pro' THEN NULL
           WHEN 'premium' THEN NULL
           ELSE 1
         END::integer;
$$;

REVOKE ALL ON FUNCTION public.upload_limit_for_tier(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upload_limit_for_tier(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.upload_limit_for_tier(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.reserve_upload_slot(_user_id uuid)
RETURNS TABLE (
  allowed boolean,
  uploads_used integer,
  upload_limit integer,
  tier text,
  reason text,
  period_start date
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile      public.profiles%ROWTYPE;
  v_period_start date := date_trunc('month', now() AT TIME ZONE 'utc')::date;
  v_used         integer;
  v_limit        integer;
BEGIN
  -- Row lock serialises concurrent uploads for the same user, so two parallel
  -- requests can never both consume the last free slot.
  SELECT * INTO v_profile
  FROM public.profiles
  WHERE user_id = _user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 0, 'free'::text, 'profile_not_found'::text, v_period_start;
    RETURN;
  END IF;

  v_limit := public.upload_limit_for_tier(v_profile.subscription_tier);

  -- Calendar-month reset decided by database time, never the browser clock.
  IF v_profile.uploads_reset_date IS NULL
     OR date_trunc('month', v_profile.uploads_reset_date)::date < v_period_start THEN
    v_used := 0;
  ELSE
    v_used := coalesce(v_profile.monthly_uploads_used, 0);
  END IF;

  IF v_limit IS NOT NULL AND v_used >= v_limit THEN
    -- Persist the reset even when refusing, so the counter stays truthful.
    PERFORM set_config('app.entitlements_writable', 'on', true);
    UPDATE public.profiles
    SET monthly_uploads_used = v_used,
        uploads_reset_date   = v_period_start
    WHERE user_id = _user_id;
    PERFORM set_config('app.entitlements_writable', 'off', true);

    RETURN QUERY SELECT false, v_used, v_limit,
                        coalesce(v_profile.subscription_tier, 'free'),
                        'quota_exceeded'::text, v_period_start;
    RETURN;
  END IF;

  v_used := v_used + 1;

  PERFORM set_config('app.entitlements_writable', 'on', true);
  UPDATE public.profiles
  SET monthly_uploads_used = v_used,
      uploads_reset_date   = v_period_start
  WHERE user_id = _user_id;
  PERFORM set_config('app.entitlements_writable', 'off', true);

  RETURN QUERY SELECT true, v_used, v_limit,
                      coalesce(v_profile.subscription_tier, 'free'),
                      NULL::text, v_period_start;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_upload_slot(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reserve_upload_slot(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_upload_slot(uuid) TO service_role;

-- Compensating action when processing fails after a reservation.
CREATE OR REPLACE FUNCTION public.release_upload_slot(_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_used integer;
BEGIN
  PERFORM set_config('app.entitlements_writable', 'on', true);

  UPDATE public.profiles
  SET monthly_uploads_used = GREATEST(coalesce(monthly_uploads_used, 0) - 1, 0)
  WHERE user_id = _user_id
  RETURNING monthly_uploads_used INTO v_used;

  PERFORM set_config('app.entitlements_writable', 'off', true);

  RETURN coalesce(v_used, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.release_upload_slot(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_upload_slot(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_upload_slot(uuid) TO service_role;

-- Read-only allowance for the signed-in user's own account (display only).
CREATE OR REPLACE FUNCTION public.get_upload_usage()
RETURNS TABLE (
  uploads_used integer,
  upload_limit integer,
  tier text,
  period_start date
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile      public.profiles%ROWTYPE;
  v_period_start date := date_trunc('month', now() AT TIME ZONE 'utc')::date;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE user_id = auth.uid();
  IF NOT FOUND THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT CASE
           WHEN v_profile.uploads_reset_date IS NULL
             OR date_trunc('month', v_profile.uploads_reset_date)::date < v_period_start
           THEN 0
           ELSE coalesce(v_profile.monthly_uploads_used, 0)
         END,
         public.upload_limit_for_tier(v_profile.subscription_tier),
         coalesce(v_profile.subscription_tier, 'free'),
         v_period_start;
END;
$$;

REVOKE ALL ON FUNCTION public.get_upload_usage() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_upload_usage() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_upload_usage() TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3. Signed cash-flow columns (nullable, no backfill)
-- -----------------------------------------------------------------------------

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS direction text,
  ADD COLUMN IF NOT EXISTS import_version integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transactions_direction_check'
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_direction_check
      CHECK (direction IS NULL OR direction IN ('debit', 'credit'));
  END IF;
END;
$$;

COMMENT ON COLUMN public.transactions.direction IS
  'debit = money out, credit = money in. NULL = legacy row imported before v2; treated as spending.';
COMMENT ON COLUMN public.transactions.import_version IS
  'Parser version that produced the row. NULL/1 = legacy unsigned import, 2 = signed cash flow.';

CREATE INDEX IF NOT EXISTS transactions_user_date_idx
  ON public.transactions (user_id, date DESC);

-- -----------------------------------------------------------------------------
-- 4. Upload history idempotency metadata
-- -----------------------------------------------------------------------------

ALTER TABLE public.upload_history
  ADD COLUMN IF NOT EXISTS csv_hash text,
  ADD COLUMN IF NOT EXISTS total_credits numeric;

COMMENT ON COLUMN public.upload_history.csv_hash IS
  'SHA-256 of the uploaded CSV, used to detect a replayed upload within 24h.';

CREATE INDEX IF NOT EXISTS upload_history_user_hash_idx
  ON public.upload_history (user_id, csv_hash, created_at DESC);
