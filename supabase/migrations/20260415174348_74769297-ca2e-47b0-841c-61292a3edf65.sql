
-- 1. Fix user_roles INSERT policy: only admins can insert, and prevent inserting admin role for oneself
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
CREATE POLICY "Admins can insert roles"
ON public.user_roles FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  AND user_id != auth.uid()
);

-- 2. Tighten storage SELECT policy to prevent bucket listing (only allow access by known path)
DROP POLICY IF EXISTS "Public can view email assets" ON storage.objects;
CREATE POLICY "Public can view email assets by path"
ON storage.objects FOR SELECT
USING (bucket_id = 'email-assets' AND auth.role() = 'service_role');
