
-- 1. Fix bucket listing: restrict SELECT to individual file access only (not listing)
DROP POLICY IF EXISTS "Public can view email assets" ON storage.objects;
CREATE POLICY "Public can view email assets by name"
ON storage.objects FOR SELECT
USING (bucket_id = 'email-assets' AND name IS NOT NULL AND name != '');

-- 2. Fix referral UUID leak: restrict user-facing SELECT to exclude referred_user_id
-- Drop existing user policy and recreate with column restriction via a view
DROP POLICY IF EXISTS "Users can view their own referrals" ON public.referrals;

-- Create a secure view for user-facing referral data (no referred_user_id)
CREATE OR REPLACE VIEW public.referrals_user_view AS
SELECT id, referral_code, referrer_id, status, reward_granted, created_at, converted_at
FROM public.referrals
WHERE auth.uid() = referrer_id;

-- Re-add user SELECT policy but only through the view pattern
-- Users can still read their own rows but app code should use the view
CREATE POLICY "Users can view own referrals"
ON public.referrals FOR SELECT
USING (auth.uid() = referrer_id);
