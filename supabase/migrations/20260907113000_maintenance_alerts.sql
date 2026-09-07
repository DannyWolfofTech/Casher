-- Send aggregate operational alerts to the verified owner contact at most daily.
-- Browser roles cannot queue mail or read this state.
CREATE TABLE app_private.maintenance_alert_state (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), last_enqueued timestamptz
);
ALTER TABLE app_private.maintenance_alert_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.maintenance_alert_state FROM PUBLIC,anon,authenticated;
INSERT INTO app_private.maintenance_alert_state(singleton) VALUES(true);

CREATE OR REPLACE FUNCTION public.queue_maintenance_alert()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE last_notice timestamptz; message_id uuid;
BEGIN
  SELECT last_enqueued INTO last_notice FROM app_private.maintenance_alert_state WHERE singleton FOR UPDATE;
  IF last_notice > now()-interval '24 hours' THEN RETURN false;END IF;
  message_id:=gen_random_uuid();
  PERFORM public.enqueue_email('transactional_emails',jsonb_build_object(
    'run_id',message_id,'message_id',message_id,'idempotency_key','casher-operations-'||message_id,
    'queued_at',now(),'to','privacy@trycasher.com','from','Casher <noreply@trycasher.com>',
    'sender_domain','notify.trycasher.com','purpose','transactional','label','operations-alert',
    'subject','Casher maintenance needs attention',
    'text','A Casher billing or scheduled maintenance check needs attention. Open Lovable Cloud logs and check Stripe webhook delivery, billing reconciliation and the email queue. This alert contains no user or transaction records. Project: https://lovable.dev/projects/ea77ebbb-78bd-46c4-a0c9-0ab73994a416',
    'html','<p>A Casher billing or scheduled maintenance check needs attention.</p><p>Open <a href="https://lovable.dev/projects/ea77ebbb-78bd-46c4-a0c9-0ab73994a416">Lovable Cloud</a> and check the function logs, Stripe webhook delivery, billing reconciliation and email queue.</p><p>This alert contains no user or transaction records.</p>'
  ));
  UPDATE app_private.maintenance_alert_state SET last_enqueued=now() WHERE singleton;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.queue_maintenance_alert() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.queue_maintenance_alert() TO service_role;

CREATE OR REPLACE FUNCTION public.stale_billing_count()
RETURNS bigint LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
  SELECT count(*) FROM public.profiles p LEFT JOIN app_private.billing_sync s ON s.customer_id=p.stripe_customer_id
  WHERE p.stripe_customer_id IS NOT NULL AND (s.last_success IS NULL OR s.last_success<now()-interval '24 hours')
  AND NOT EXISTS(SELECT 1 FROM app_private.account_operations a WHERE a.user_id=p.user_id AND a.closing);
$$;
REVOKE ALL ON FUNCTION public.stale_billing_count() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.stale_billing_count() TO service_role;
