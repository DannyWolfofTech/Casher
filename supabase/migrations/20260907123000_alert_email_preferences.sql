-- Register the recipient's unsubscribe token for runtime transactional delivery.
CREATE OR REPLACE FUNCTION public.queue_maintenance_alert()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE last_notice timestamptz; message_id uuid; unsubscribe_key text;
BEGIN
  SELECT last_enqueued INTO last_notice FROM app_private.maintenance_alert_state WHERE singleton FOR UPDATE;
  IF last_notice > now()-interval '24 hours' THEN RETURN false;END IF;
  IF EXISTS(SELECT 1 FROM public.suppressed_emails WHERE lower(email)='privacy@trycasher.com') THEN RETURN false;END IF;
  INSERT INTO public.email_unsubscribe_tokens(email,token) VALUES('privacy@trycasher.com',gen_random_uuid()::text) ON CONFLICT(email) DO NOTHING;
  SELECT token INTO unsubscribe_key FROM public.email_unsubscribe_tokens WHERE email='privacy@trycasher.com' AND used_at IS NULL;
  IF unsubscribe_key IS NULL THEN RETURN false;END IF;
  message_id:=gen_random_uuid();
  PERFORM public.enqueue_email('transactional_emails',jsonb_build_object(
    'message_id',message_id,'unsubscribe_token',unsubscribe_key,'idempotency_key','casher-operations-'||message_id,
    'queued_at',now(),'to','privacy@trycasher.com','from','Casher <noreply@trycasher.com>',
    'sender_domain','notify.trycasher.com','purpose','transactional','label','operations-alert',
    'subject','Casher maintenance needs attention',
    'text','A Casher billing or scheduled maintenance check needs attention. Open Lovable Cloud logs and check Stripe webhook delivery, billing reconciliation and the email queue. This alert contains no user or transaction records. Project: https://lovable.dev/projects/ea77ebbb-78bd-46c4-a0c9-0ab73994a416',
    'html','<p>A Casher billing or scheduled maintenance check needs attention.</p><p>Open <a href="https://lovable.dev/projects/ea77ebbb-78bd-46c4-a0c9-0ab73994a416">Lovable Cloud</a> and check the function logs, Stripe webhook delivery, billing reconciliation and email queue.</p><p>This alert contains no user or transaction records.</p>'
  ));
  UPDATE app_private.maintenance_alert_state SET last_enqueued=now() WHERE singleton;
  RETURN true;
END $$;
