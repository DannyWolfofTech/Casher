-- One transaction owns deduplication, quota, rows, subscriptions and history.
-- Deploy this migration before deploying the updated process-csv function.
-- Keep user corrections separate from source values used for duplicate detection.
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS direction_override text CHECK (direction_override IN ('debit', 'credit'));
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS category_override text;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE public.detected_subscriptions ADD COLUMN IF NOT EXISTS details_locked boolean NOT NULL DEFAULT false;
ALTER TABLE public.detected_subscriptions ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
CREATE OR REPLACE FUNCTION public.import_statement_atomic(
  _user_id uuid, _csv_hash text, _transactions jsonb, _subscriptions jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_slot record;
  v_fresh jsonb;
  v_row jsonb;
  v_sub jsonb;
  v_existing public.detected_subscriptions%ROWTYPE;
  v_count integer;
  v_added integer := 0;
  v_updated integer := 0;
  v_spending numeric := 0;
  v_credits numeric := 0;
  v_annual numeric := 0;
  v_used integer;
  v_limit integer;
  v_usage jsonb;
BEGIN
  IF public.current_request_role() <> 'service_role' THEN RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501'; END IF;
  IF jsonb_typeof(_transactions) IS DISTINCT FROM 'array' OR jsonb_array_length(_transactions) > 10000
     OR jsonb_array_length(_transactions) = 0 OR _csv_hash IS NULL OR _csv_hash !~ '^[a-f0-9]{64}$'
     OR jsonb_typeof(_subscriptions) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Invalid statement payload';
  END IF;
  SELECT * INTO v_profile FROM public.profiles WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('code', 'PROFILE_NOT_FOUND', 'message', 'Your account profile is unavailable.'); END IF;
  v_limit := public.upload_limit_for_tier(v_profile.subscription_tier);
  v_used := CASE WHEN v_profile.uploads_reset_date IS NULL OR v_profile.uploads_reset_date < date_trunc('month', now() AT TIME ZONE 'utc')::date THEN 0 ELSE coalesce(v_profile.monthly_uploads_used, 0) END;
  v_usage := jsonb_build_object('uploadsUsed', v_used, 'uploadLimit', v_limit, 'tier', v_profile.subscription_tier, 'canUpload', v_limit IS NULL OR v_used < v_limit);
  IF EXISTS (SELECT 1 FROM public.upload_history WHERE user_id = _user_id AND csv_hash = _csv_hash) THEN
    RETURN jsonb_build_object('code', 'REPLAY', 'replay', true, 'message', 'This statement has already been imported.', 'transactionsCount', 0, 'usage', v_usage);
  END IF;

  -- Compare multisets: two identical purchases in one statement are two rows.
  -- An overlapping statement adds only occurrences beyond those already stored.
  WITH incoming AS (
    SELECT r.row, r.ordinal, (r.row->>'date')::date AS date,
      regexp_replace(lower(trim(r.row->>'description')), '\s+', ' ', 'g') AS description,
      abs((r.row->>'amount')::numeric) AS amount, r.row->>'direction' AS direction
    FROM jsonb_array_elements(_transactions) WITH ORDINALITY AS r(row, ordinal)
  ), numbered AS (
    SELECT *, row_number() OVER (PARTITION BY date, description, amount, direction ORDER BY ordinal) AS occurrence FROM incoming
  ), existing AS (
    SELECT date, regexp_replace(lower(trim(description)), '\s+', ' ', 'g') AS description,
      abs(amount) AS amount,
      coalesce(direction, direction_override, CASE WHEN lower(trim(coalesce(category, ''))) = 'income' OR description ~* '\m(salary|salaries|payroll|wages)\M' THEN 'credit' ELSE 'debit' END) AS direction,
      count(*) AS occurrences FROM public.transactions WHERE user_id = _user_id GROUP BY 1, 2, 3, 4
  )
  SELECT coalesce(jsonb_agg(n.row ORDER BY n.ordinal), '[]'::jsonb) INTO v_fresh
  FROM numbered n LEFT JOIN existing e USING (date, description, amount, direction)
  WHERE n.occurrence > coalesce(e.occurrences, 0);
  v_count := jsonb_array_length(v_fresh);
  IF v_count = 0 THEN
    RETURN jsonb_build_object('code', 'REPLAY', 'replay', true, 'message', 'All transactions in this statement have already been imported.', 'transactionsCount', 0, 'duplicatesSkipped', jsonb_array_length(_transactions), 'usage', v_usage);
  END IF;
  SELECT * INTO v_slot FROM public.reserve_upload_slot(_user_id);
  IF NOT v_slot.allowed THEN
    RETURN jsonb_build_object('code', 'QUOTA_EXCEEDED', 'message', 'Your monthly upload allowance has been used. View plans for more uploads.', 'usage', v_usage);
  END IF;
  FOR v_row IN SELECT value FROM jsonb_array_elements(v_fresh) LOOP
    IF (v_row->>'direction') NOT IN ('credit', 'debit') OR (v_row->>'amount')::numeric = 0 THEN RAISE EXCEPTION 'Invalid transaction'; END IF;
    INSERT INTO public.transactions(user_id, date, description, amount, direction, import_version, category, is_recurring, recurring_frequency, merchant)
      VALUES (_user_id, (v_row->>'date')::date, v_row->>'description', (v_row->>'amount')::numeric, v_row->>'direction', 2, v_row->>'category',
        (v_row->>'isSubscription')::boolean, CASE WHEN (v_row->>'isSubscription')::boolean THEN CASE WHEN v_row->>'description' ~* '\m(annual|yearly)\M' THEN 'annual' ELSE 'monthly' END END, v_row->>'merchant');
    IF v_row->>'direction' = 'debit' THEN v_spending := v_spending + abs((v_row->>'amount')::numeric); ELSE v_credits := v_credits + abs((v_row->>'amount')::numeric); END IF;
  END LOOP;
  FOR v_sub IN SELECT value FROM jsonb_array_elements(_subscriptions) LOOP
    IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_fresh) r WHERE r->>'merchant' = v_sub->>'service_name' AND r->>'direction' = 'debit') THEN CONTINUE; END IF;
    v_annual := v_annual + (v_sub->>'estimated_annual_cost')::numeric;
    SELECT * INTO v_existing FROM public.detected_subscriptions
      WHERE user_id = _user_id AND lower(trim(service_name)) = lower(trim(v_sub->>'service_name'))
      ORDER BY last_charged DESC NULLS LAST, id LIMIT 1;
    IF NOT FOUND THEN
      INSERT INTO public.detected_subscriptions(user_id, service_name, amount, frequency, last_charged, estimated_annual_cost, status)
        VALUES (_user_id, v_sub->>'service_name', (v_sub->>'amount')::numeric, v_sub->>'frequency', (v_sub->>'last_charged')::date, (v_sub->>'estimated_annual_cost')::numeric, 'active');
      v_added := v_added + 1;

    ELSIF v_existing.last_charged IS NULL OR v_existing.last_charged <= (v_sub->>'last_charged')::date THEN
      UPDATE public.detected_subscriptions SET
        amount = CASE WHEN details_locked THEN amount ELSE (v_sub->>'amount')::numeric END,
        frequency = CASE WHEN details_locked THEN frequency ELSE v_sub->>'frequency' END,
        last_charged = (v_sub->>'last_charged')::date,
        estimated_annual_cost = CASE WHEN details_locked THEN estimated_annual_cost ELSE (v_sub->>'estimated_annual_cost')::numeric END WHERE id = v_existing.id;
      v_updated := v_updated + 1;
    END IF;
  END LOOP;
  INSERT INTO public.upload_history(user_id, csv_hash, total_spending, total_credits, subscriptions_count, potential_savings, transaction_count)
    VALUES (_user_id, _csv_hash, v_spending, v_credits, v_added + v_updated, v_annual, v_count);
  RETURN jsonb_build_object('code', 'OK', 'ok', true, 'replay', false, 'transactionsCount', v_count, 'subscriptionsCount', v_added,
    'subscriptionsUpdated', v_updated, 'duplicatesSkipped', jsonb_array_length(_transactions) - v_count,
    'batchSpending', v_spending, 'batchCredits', v_credits, 'batchSubsCount', v_added + v_updated, 'batchAnnualSavings', v_annual,
    'usage', jsonb_build_object('uploadsUsed', v_slot.uploads_used, 'uploadLimit', v_slot.upload_limit, 'tier', v_slot.tier, 'canUpload', v_slot.upload_limit IS NULL OR v_slot.uploads_used < v_slot.upload_limit));
END;
$$;
REVOKE ALL ON FUNCTION public.import_statement_atomic(uuid, text, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.import_statement_atomic(uuid, text, jsonb, jsonb) TO service_role;

-- Browser edits must not manufacture or erase server-owned import audit records.
DROP POLICY IF EXISTS "Users can insert their own upload history" ON public.upload_history;
DROP POLICY IF EXISTS "Users can update their own upload history" ON public.upload_history;
DROP POLICY IF EXISTS "Users can delete their own upload history" ON public.upload_history;
DROP POLICY IF EXISTS "Users can insert their own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can update their own transactions" ON public.transactions;

-- Sign-up provisions profiles through its existing SECURITY DEFINER trigger.
-- Browser-created profiles must not claim another customer's billing identity.
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE OR REPLACE FUNCTION public.protect_profile_billing_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.entitlement_writes_allowed() THEN
    NEW.stripe_customer_id := NULL;
    NEW.subscription_status := 'inactive';
    NEW.current_period_end := NULL;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.protect_profile_billing_insert() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS protect_profile_billing_insert ON public.profiles;
CREATE TRIGGER protect_profile_billing_insert BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_billing_insert();

-- NOT VALID preserves legacy rows but enforces valid values for new writes.
ALTER TABLE public.savings_goals ADD CONSTRAINT savings_goal_positive_target
  CHECK (target_amount > 0 AND target_amount < 100000000 AND current_amount >= 0 AND current_amount < 100000000 AND length(trim(title)) BETWEEN 1 AND 120) NOT VALID;
