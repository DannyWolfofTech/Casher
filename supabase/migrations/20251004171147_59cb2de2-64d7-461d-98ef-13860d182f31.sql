-- Add subscription tier tracking to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_tier text DEFAULT 'free';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_customer_id text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS monthly_uploads_used integer DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS uploads_reset_date date DEFAULT CURRENT_DATE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer ON public.profiles(stripe_customer_id);

-- Update subscription_plans with correct prices
UPDATE public.subscription_plans SET price = 9.99, stripe_price_id = 'price_pro_monthly' WHERE name = 'Pro';
UPDATE public.subscription_plans SET price = 14.99, stripe_price_id = 'price_premium_monthly' WHERE name = 'Premium';