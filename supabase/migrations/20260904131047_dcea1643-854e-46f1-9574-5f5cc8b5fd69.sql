REVOKE ALL ON FUNCTION public.protect_profile_entitlements() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.protect_profile_entitlements() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.protect_profile_entitlements() TO service_role;