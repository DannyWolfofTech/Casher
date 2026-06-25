
-- 1) Lock down SECURITY DEFINER functions exposed via PostgREST
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- has_role and increment_monthly_uploads must remain callable by authenticated
-- (has_role is used in RLS; increment_monthly_uploads is called from client/edge).
-- Just revoke from anon to satisfy the anon linter.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.increment_monthly_uploads(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_monthly_uploads(uuid) TO authenticated, service_role;

-- 2) Allow referred users to view referrals where they are the referred party
CREATE POLICY "Referred users can view their referral"
ON public.referrals
FOR SELECT
TO authenticated
USING (auth.uid() = referred_user_id);

-- 3) Explicit restrictive policy: no one may insert a role row for themselves.
-- This blocks any privilege-escalation path regardless of other permissive policies.
CREATE POLICY "No self role assignment"
ON public.user_roles
AS RESTRICTIVE
FOR INSERT
TO public
WITH CHECK (user_id <> auth.uid());
