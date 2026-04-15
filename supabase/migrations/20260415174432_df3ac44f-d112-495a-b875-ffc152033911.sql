
-- 1. Restrict profiles INSERT to prevent users from setting stripe_customer_id
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND stripe_customer_id IS NULL
);

-- 2. Restrict profiles UPDATE to prevent users from modifying stripe_customer_id
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND (stripe_customer_id IS NOT DISTINCT FROM (SELECT p.stripe_customer_id FROM public.profiles p WHERE p.user_id = auth.uid()))
);

-- 3. Add service role UPDATE policy for stripe_customer_id changes
CREATE POLICY "Service role can update profiles"
ON public.profiles FOR UPDATE
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- 4. Fix email-assets SELECT to allow public access (bucket is public for email logos)
DROP POLICY IF EXISTS "Public can view email assets by path" ON storage.objects;
CREATE POLICY "Public can view email assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'email-assets');
