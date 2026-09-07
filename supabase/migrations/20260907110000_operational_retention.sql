-- Operational records never contain statement rows or account access tokens.
-- Run purge_operational_data daily after deployment (see tools/release/enable-jobs.sql).
CREATE TABLE app_private.maintenance_runs (
  request_id bigint PRIMARY KEY, job text NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE app_private.maintenance_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.maintenance_runs FROM PUBLIC,anon,authenticated;

CREATE TABLE app_private.closed_accounts (
  user_id uuid PRIMARY KEY, closed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE app_private.closed_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.closed_accounts FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION app_private.record_account_deletion()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  INSERT INTO app_private.closed_accounts(user_id) VALUES(OLD.id) ON CONFLICT DO NOTHING;
  RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION app_private.record_account_deletion() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER record_account_deletion BEFORE DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION app_private.record_account_deletion();

CREATE OR REPLACE FUNCTION public.purge_operational_data()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE q text;
BEGIN
  DELETE FROM public.webhook_events WHERE created_at < now()-interval '90 days';
  DELETE FROM public.email_send_log WHERE created_at < now()-interval '30 days';
  DELETE FROM app_private.maintenance_runs WHERE requested_at < now()-interval '7 days';
  DELETE FROM app_private.billing_sync s WHERE NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.stripe_customer_id=s.customer_id)
    AND greatest(s.last_success,s.last_failure,s.lease_until) < now()-interval '90 days';
  -- A short-lived tombstone rejects Stripe event replays after account deletion.
  DELETE FROM app_private.closed_billing_customers WHERE closed_at < now()-interval '90 days';
  DELETE FROM app_private.closed_accounts WHERE closed_at < now()-interval '90 days';
  FOREACH q IN ARRAY ARRAY['q_auth_emails','q_auth_emails_dlq','q_transactional_emails','q_transactional_emails_dlq',
    'a_auth_emails','a_auth_emails_dlq','a_transactional_emails','a_transactional_emails_dlq'] LOOP
    IF to_regclass('pgmq.'||q) IS NOT NULL THEN
      EXECUTE format('DELETE FROM pgmq.%I WHERE enqueued_at < now()-interval ''1 day''',q);
    END IF;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.purge_operational_data() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.purge_operational_data() TO service_role;
