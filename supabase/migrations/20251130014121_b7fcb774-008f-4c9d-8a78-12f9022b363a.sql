-- Add subscription status and period tracking to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'inactive',
ADD COLUMN IF NOT EXISTS current_period_end timestamp with time zone;