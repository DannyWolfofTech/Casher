-- 1. SECURITY DEFINER functions must not be callable by anon or authenticated.
--    email_queue_wake/dispatch are internal queue plumbing invoked from
--    service-role paths (and from triggers inside SECURITY DEFINER enqueue),
--    so browser roles never need EXECUTE.
REVOKE ALL ON FUNCTION public.email_queue_wake() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.email_queue_wake() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.email_queue_wake() TO service_role;

REVOKE ALL ON FUNCTION public.email_queue_dispatch() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.email_queue_dispatch() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.email_queue_dispatch() TO service_role;

-- has_role() must stay callable by authenticated: RLS policies evaluate it as
-- the calling role. get_upload_usage() is a deliberate, own-row-only RPC used
-- by the signed-in dashboard. Both stay revoked from anon.
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_upload_usage() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_upload_usage() TO authenticated, service_role;

-- 2. email-assets: only the published email logo is world readable.
DROP POLICY IF EXISTS "Public can view email assets by name" ON storage.objects;
CREATE POLICY "Public can view published email assets"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'email-assets'
  AND (name = 'logo-full.png' OR name LIKE 'public/%')
);

-- 3. profiles: drop the same-row subquery guard from the UPDATE policy and let
--    the BEFORE UPDATE trigger be the single, race-free authority on
--    stripe_customer_id (it restores OLD for non-privileged writers).
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.protect_profile_stripe_customer_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.entitlement_writes_allowed() THEN
    RETURN NEW;
  END IF;
  NEW.stripe_customer_id := OLD.stripe_customer_id;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_profile_stripe_customer_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.protect_profile_stripe_customer_id() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.protect_profile_stripe_customer_id() TO service_role;

DROP TRIGGER IF EXISTS protect_profile_stripe_customer_id_upd ON public.profiles;
CREATE TRIGGER protect_profile_stripe_customer_id_upd
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_stripe_customer_id();

-- 4. user_subscriptions: owners may delete their own rows; nobody else can.
DROP POLICY IF EXISTS "Users can delete their own subscriptions" ON public.user_subscriptions;
CREATE POLICY "Users can delete their own subscriptions"
ON public.user_subscriptions
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
