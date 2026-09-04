-- 1) get_upload_usage: SECURITY DEFINER no longer needed (own-row read allowed by RLS)
CREATE OR REPLACE FUNCTION public.get_upload_usage()
 RETURNS TABLE(uploads_used integer, upload_limit integer, tier text, period_start date)
 LANGUAGE plpgsql
 STABLE
 SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_profile      public.profiles%ROWTYPE;
  v_period_start date := date_trunc('month', now() AT TIME ZONE 'utc')::date;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE user_id = auth.uid();
  IF NOT FOUND THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT CASE
           WHEN v_profile.uploads_reset_date IS NULL
             OR date_trunc('month', v_profile.uploads_reset_date)::date < v_period_start
           THEN 0
           ELSE coalesce(v_profile.monthly_uploads_used, 0)
         END,
         public.upload_limit_for_tier(v_profile.subscription_tier),
         coalesce(v_profile.subscription_tier, 'free'),
         v_period_start;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_upload_usage() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_upload_usage() TO authenticated, service_role;

-- 2) upload_history: allow users to manage their own rows
DROP POLICY IF EXISTS "Users can update their own upload history" ON public.upload_history;
CREATE POLICY "Users can update their own upload history"
ON public.upload_history
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own upload history" ON public.upload_history;
CREATE POLICY "Users can delete their own upload history"
ON public.upload_history
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 3) user_roles UPDATE: add WITH CHECK and block self-role edits
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
CREATE POLICY "Admins can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) AND user_id <> auth.uid())
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) AND user_id <> auth.uid());
