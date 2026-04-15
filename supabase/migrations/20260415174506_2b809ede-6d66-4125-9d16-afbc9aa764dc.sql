
-- Fix: ensure only admins can insert into user_roles, period.
-- The has_role check already ensures only admins pass, and user_id != auth.uid() prevents self-grant.
-- But we need to also ensure no default/fallback allows non-admin inserts.
-- Drop and recreate with explicit admin-only check.
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
CREATE POLICY "Only admins can insert roles"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  AND user_id != auth.uid()
);
