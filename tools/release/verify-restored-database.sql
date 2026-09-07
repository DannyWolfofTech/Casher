-- Run ONLY in the isolated restored database. Every mutation rolls back.
\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE
  owner_id uuid; other_id uuid; transaction_id uuid; other_transaction uuid;
  expected_count bigint; actual_count bigint; lease jsonb; denied boolean;
  expected_tier text; resulting_tier text; previous_review timestamptz;
BEGIN
  IF current_setting('max_worker_processes') <> '0'
     OR current_setting('cron.launch_active_jobs') <> 'off' THEN
    RAISE EXCEPTION 'Restore verification requires disabled workers and cron';
  END IF;
  SELECT user_id,id INTO owner_id,transaction_id FROM public.transactions ORDER BY id LIMIT 1;
  SELECT user_id,id INTO other_id,other_transaction FROM public.transactions WHERE user_id<>owner_id ORDER BY id LIMIT 1;
  IF owner_id IS NULL OR other_id IS NULL THEN RAISE EXCEPTION 'Two restored transaction owners are required'; END IF;
  SELECT count(*) INTO expected_count FROM public.transactions WHERE user_id=owner_id;
  SELECT subscription_tier INTO expected_tier FROM public.profiles WHERE user_id=owner_id;
  SELECT reviewed_at INTO previous_review FROM public.transactions WHERE id=transaction_id;

  EXECUTE 'SET LOCAL ROLE anon';
  SELECT count(*) INTO actual_count FROM public.transactions;
  IF actual_count<>0 THEN RAISE EXCEPTION 'Anonymous transaction access'; END IF;
  SELECT count(*) INTO actual_count FROM public.profiles;
  IF actual_count<>0 THEN RAISE EXCEPTION 'Anonymous profile access'; END IF;
  EXECUTE 'RESET ROLE';
  RAISE NOTICE 'PASS anonymous profile and transaction isolation';

  PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO actual_count FROM public.transactions;
  IF actual_count<>expected_count THEN RAISE EXCEPTION 'Restored owner transaction visibility differs'; END IF;
  IF EXISTS(SELECT 1 FROM public.profiles WHERE user_id<>owner_id) THEN RAISE EXCEPTION 'Cross-user profile access'; END IF;
  IF EXISTS(SELECT 1 FROM public.transactions WHERE user_id<>owner_id) THEN RAISE EXCEPTION 'Cross-user transaction access'; END IF;
  denied:=false;
  BEGIN
    PERFORM public.review_transaction(other_transaction,'debit','Restore verification',NULL);
  EXCEPTION WHEN insufficient_privilege THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Cross-user correction was allowed'; END IF;
  denied:=false;
  BEGIN
    UPDATE public.profiles SET subscription_tier=CASE WHEN expected_tier='pro' THEN 'free' ELSE 'pro' END WHERE user_id=owner_id;
  EXCEPTION WHEN insufficient_privilege THEN denied:=true;
  END;
  -- The deployed trigger restores the old tier rather than raising an error.
  SELECT subscription_tier INTO resulting_tier FROM public.profiles WHERE user_id=owner_id;
  IF resulting_tier IS DISTINCT FROM expected_tier THEN RAISE EXCEPTION 'Client changed an entitlement'; END IF;
  PERFORM public.review_transaction(transaction_id,'debit','Restore verification',previous_review);
  IF NOT EXISTS(SELECT 1 FROM public.transactions WHERE id=transaction_id AND category_override='Restore verification') THEN
    RAISE EXCEPTION 'Restored own-record correction failed';
  END IF;
  EXECUTE 'RESET ROLE';
  RAISE NOTICE 'PASS authenticated ownership, correction and entitlement boundaries';

  -- Exercise the real restored deletion function, foreign keys and deletion ledger.
  PERFORM set_config('request.jwt.claim.role','service_role',true);
  EXECUTE 'SET LOCAL ROLE service_role';
  lease:=public.acquire_account_operation(owner_id,true);
  IF lease->>'code'<>'OK' THEN RAISE EXCEPTION 'Could not acquire restored deletion lease'; END IF;
  PERFORM public.complete_account_deletion(owner_id,(lease->>'lease')::uuid,NULL);
  EXECUTE 'RESET ROLE';
  IF EXISTS(SELECT 1 FROM auth.users WHERE id=owner_id)
     OR EXISTS(SELECT 1 FROM public.profiles WHERE user_id=owner_id)
     OR EXISTS(SELECT 1 FROM public.transactions WHERE user_id=owner_id)
     OR EXISTS(SELECT 1 FROM public.upload_history WHERE user_id=owner_id)
     OR EXISTS(SELECT 1 FROM public.detected_subscriptions WHERE user_id=owner_id) THEN
    RAISE EXCEPTION 'Restored account deletion left user records';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM app_private.closed_accounts WHERE user_id=owner_id) THEN
    RAISE EXCEPTION 'Restored deletion receipt missing';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=other_id) THEN
    RAISE EXCEPTION 'Deletion affected another user';
  END IF;
  RAISE NOTICE 'PASS deletion lease, cascades, upload cleanup and deletion receipt';
END $$;
ROLLBACK;
SELECT 'PASS all verification mutations rolled back' AS result;
