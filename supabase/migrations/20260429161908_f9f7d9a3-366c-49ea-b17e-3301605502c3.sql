CREATE OR REPLACE FUNCTION public.increment_monthly_uploads(_user_id uuid)
RETURNS TABLE(monthly_uploads_used integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow a user to increment their own counter (or service role)
  IF auth.uid() IS DISTINCT FROM _user_id AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  UPDATE public.profiles
  SET monthly_uploads_used = COALESCE(monthly_uploads_used, 0) + 1,
      updated_at = now()
  WHERE user_id = _user_id
  RETURNING profiles.monthly_uploads_used;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.increment_monthly_uploads(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_monthly_uploads(uuid) TO authenticated;