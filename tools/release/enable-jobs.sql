-- PRODUCTION ONLY. Apply after the corresponding edge functions are deployed.
-- Uses the existing Vault secret without exporting it or embedding it in cron.
BEGIN;
CREATE OR REPLACE FUNCTION app_private.dispatch_maintenance(_job text)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE service_key text; request_id bigint;
BEGIN
  IF _job NOT IN ('reconcile-billing','process-email-queue','check-failed-webhooks') THEN
    RAISE EXCEPTION 'Unknown maintenance job';
  END IF;
  IF _job='process-email-queue' AND NOT EXISTS(SELECT 1 FROM pgmq.q_auth_emails)
    AND NOT EXISTS(SELECT 1 FROM pgmq.q_transactional_emails) THEN RETURN 0;END IF;
  IF _job='reconcile-billing' AND NOT EXISTS(SELECT 1 FROM public.billing_reconciliation_candidates()) THEN RETURN 0;END IF;
  SELECT decrypted_secret INTO service_key FROM vault.decrypted_secrets WHERE name='email_queue_service_role_key';
  IF service_key IS NULL THEN RAISE EXCEPTION 'Maintenance credential unavailable';END IF;
  SELECT net.http_post(
    url:='https://ewnjmvxildwmbdmosasz.supabase.co/functions/v1/'||_job,
    headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||service_key),
    body:='{}'::jsonb,timeout_milliseconds:=50000
  ) INTO request_id;
  INSERT INTO app_private.maintenance_runs(request_id,job) VALUES(request_id,_job);
  RETURN request_id;
END $$;
REVOKE ALL ON FUNCTION app_private.dispatch_maintenance(text) FROM PUBLIC,anon,authenticated;
SELECT cron.schedule('casher-billing-reconciliation','*/5 * * * *',$job$SELECT app_private.dispatch_maintenance('reconcile-billing')$job$);
SELECT cron.schedule('casher-email-queue','* * * * *',$job$SELECT app_private.dispatch_maintenance('process-email-queue')$job$);
SELECT cron.schedule('casher-webhook-health','*/15 * * * *',$job$SELECT app_private.dispatch_maintenance('check-failed-webhooks')$job$);
SELECT cron.schedule('casher-operational-retention','23 3 * * *',$job$SELECT public.purge_operational_data(); DELETE FROM cron.job_run_details WHERE end_time<now()-interval '7 days';$job$);
COMMIT;
