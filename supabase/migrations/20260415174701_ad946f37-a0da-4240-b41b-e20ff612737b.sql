
-- Fix: make the view SECURITY INVOKER (safe default)
ALTER VIEW public.referrals_user_view SET (security_invoker = on);
