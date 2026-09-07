-- Additive, service-only coordination. Existing customer records are not rewritten.
CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC, anon, authenticated;
CREATE TABLE app_private.account_operations (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  lease uuid,
  lease_until timestamptz,
  closing boolean NOT NULL DEFAULT false,
  window_start timestamptz NOT NULL DEFAULT now(),
  requests integer NOT NULL DEFAULT 0
);
CREATE TABLE app_private.closed_billing_customers (
  customer_id text PRIMARY KEY CHECK (customer_id ~ '^cus_[A-Za-z0-9]+$'),
  closed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app_private.billing_request_windows (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  window_start timestamptz NOT NULL DEFAULT now(),
  requests integer NOT NULL DEFAULT 0
);
ALTER TABLE app_private.account_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.closed_billing_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.billing_request_windows ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA app_private FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.allow_billing_request(_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v app_private.billing_request_windows;
BEGIN
  INSERT INTO app_private.billing_request_windows(user_id) VALUES(_user_id) ON CONFLICT DO NOTHING;
  SELECT * INTO v FROM app_private.billing_request_windows WHERE user_id=_user_id FOR UPDATE;
  IF v.window_start <= now()-interval '10 minutes' THEN v.requests:=0;v.window_start:=now();END IF;
  IF v.requests>=60 THEN RETURN false;END IF;
  UPDATE app_private.billing_request_windows SET requests=v.requests+1,window_start=v.window_start WHERE user_id=_user_id;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.acquire_account_operation(_user_id uuid, _closing boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v app_private.account_operations; k uuid;
BEGIN
  INSERT INTO app_private.account_operations(user_id) VALUES (_user_id) ON CONFLICT DO NOTHING;
  SELECT * INTO v FROM app_private.account_operations WHERE user_id=_user_id FOR UPDATE;
  IF v.closing AND NOT _closing THEN RETURN jsonb_build_object('code','CLOSING'); END IF;
  IF v.lease_until > now() THEN RETURN jsonb_build_object('code','BUSY'); END IF;
  IF v.window_start <= now() - interval '10 minutes' THEN v.requests := 0; v.window_start := now(); END IF;
  IF v.requests >= 20 THEN RETURN jsonb_build_object('code','RATE_LIMIT'); END IF;
  k := gen_random_uuid();
  UPDATE app_private.account_operations SET lease=k, lease_until=now()+interval '5 minutes',
    closing=closing OR _closing, window_start=v.window_start, requests=v.requests+1 WHERE user_id=_user_id;
  RETURN jsonb_build_object('code','OK','lease',k);
END $$;
CREATE OR REPLACE FUNCTION public.release_account_operation(_user_id uuid, _lease uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  UPDATE app_private.account_operations SET lease=NULL,lease_until=NULL WHERE user_id=_user_id AND lease=_lease;
$$;
CREATE OR REPLACE FUNCTION public.is_closed_billing_customer(_customer_id text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS(SELECT 1 FROM app_private.closed_billing_customers WHERE customer_id=_customer_id);
$$;
CREATE OR REPLACE FUNCTION public.complete_account_deletion(_user_id uuid, _lease uuid, _customer_id text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_email text; q text;
BEGIN
  PERFORM 1 FROM app_private.account_operations WHERE user_id=_user_id AND lease=_lease AND closing AND lease_until > now() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Deletion lease expired'; END IF;
  SELECT email INTO v_email FROM auth.users WHERE id=_user_id FOR UPDATE;
  IF _customer_id IS NOT NULL THEN
    INSERT INTO app_private.closed_billing_customers(customer_id) VALUES(_customer_id) ON CONFLICT DO NOTHING;
  END IF;
  -- upload_history predates the user foreign keys and needs explicit cleanup.
  DELETE FROM public.upload_history WHERE user_id=_user_id;
  DELETE FROM public.email_send_log WHERE lower(recipient_email)=lower(v_email);
  DELETE FROM public.email_unsubscribe_tokens WHERE lower(email)=lower(v_email);
  -- Remove queued recovery links, including archived and dead-letter messages.
  FOREACH q IN ARRAY ARRAY['q_auth_emails','q_auth_emails_dlq','q_transactional_emails','q_transactional_emails_dlq',
    'a_auth_emails','a_auth_emails_dlq','a_transactional_emails','a_transactional_emails_dlq'] LOOP
    IF to_regclass('pgmq.'||q) IS NOT NULL THEN
      EXECUTE format('DELETE FROM pgmq.%I WHERE lower(message->>''to'')=lower($1)',q) USING v_email;
    END IF;
  END LOOP;
  DELETE FROM auth.users WHERE id=_user_id;
END $$;

CREATE OR REPLACE FUNCTION app_private.reject_closing_account_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM app_private.account_operations WHERE user_id=NEW.user_id AND closing) THEN
    RAISE EXCEPTION 'Account deletion is in progress' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER prevent_import_during_deletion BEFORE INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION app_private.reject_closing_account_write();
CREATE TRIGGER prevent_upload_during_deletion BEFORE INSERT ON public.upload_history
  FOR EACH ROW EXECUTE FUNCTION app_private.reject_closing_account_write();

REVOKE ALL ON FUNCTION public.acquire_account_operation(uuid,boolean), public.release_account_operation(uuid,uuid),
  public.is_closed_billing_customer(text), public.complete_account_deletion(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_account_operation(uuid,boolean), public.release_account_operation(uuid,uuid),
  public.is_closed_billing_customer(text), public.complete_account_deletion(uuid,uuid,text) TO service_role;
REVOKE ALL ON FUNCTION app_private.reject_closing_account_write() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.allow_billing_request(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.allow_billing_request(uuid) TO service_role;
