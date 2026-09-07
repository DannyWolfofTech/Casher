CREATE TABLE app_private.import_request_windows (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  window_start timestamptz NOT NULL DEFAULT now(),requests integer NOT NULL DEFAULT 0
);
ALTER TABLE app_private.import_request_windows ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.import_request_windows FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.allow_import_request(_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v app_private.import_request_windows;
BEGIN
  INSERT INTO app_private.import_request_windows(user_id) VALUES(_user_id) ON CONFLICT DO NOTHING;
  SELECT * INTO v FROM app_private.import_request_windows WHERE user_id=_user_id FOR UPDATE;
  IF v.window_start<=now()-interval '10 minutes' THEN v.requests:=0;v.window_start:=now();END IF;
  IF v.requests>=30 THEN RETURN false;END IF;
  UPDATE app_private.import_request_windows SET requests=v.requests+1,window_start=v.window_start WHERE user_id=_user_id;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.allow_import_request(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.allow_import_request(uuid) TO service_role;
