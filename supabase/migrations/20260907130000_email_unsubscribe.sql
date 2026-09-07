-- The high-entropy bearer token is the sole authority to unsubscribe its recipient.
-- Only this service-side function can resolve a token to an email address.
CREATE OR REPLACE FUNCTION public.unsubscribe_app_email(_token text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE recipient text;
BEGIN
  SELECT email INTO recipient FROM public.email_unsubscribe_tokens WHERE token=_token FOR UPDATE;
  IF recipient IS NULL THEN RETURN NULL;END IF;
  UPDATE public.email_unsubscribe_tokens SET used_at=coalesce(used_at,now()) WHERE token=_token;
  INSERT INTO public.suppressed_emails(email,reason) VALUES(lower(recipient),'unsubscribe') ON CONFLICT(email) DO NOTHING;
  RETURN recipient;
END $$;
REVOKE ALL ON FUNCTION public.unsubscribe_app_email(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.unsubscribe_app_email(text) TO service_role;
