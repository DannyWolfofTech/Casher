-- Save only deleted record identifiers, never statement contents, for exact recovery.
-- Timestamp cutoffs would incorrectly remove imports that started before a reset
-- but committed after it while waiting for the same profile lock.
ALTER TABLE app_private.statement_reset_receipts ADD COLUMN deleted_record_ids jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.clear_statement_data(_confirmation text, _request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := auth.uid(); v_signed_in timestamptz; v_result jsonb;
  v_transactions integer; v_subscriptions integer; v_reviews integer; v_imports integer;
  v_transaction_ids jsonb; v_subscription_ids jsonb; v_review_ids jsonb; v_import_ids jsonb;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Please sign in.' USING ERRCODE='42501'; END IF;
  IF _confirmation IS DISTINCT FROM 'CLEAR' OR _request_id IS NULL THEN
    RAISE EXCEPTION 'Type CLEAR to remove your imported statement data.' USING ERRCODE='22023';
  END IF;
  SELECT last_sign_in_at INTO v_signed_in FROM auth.users WHERE id=v_user;
  IF v_signed_in IS NULL OR v_signed_in < now()-interval '10 minutes' THEN
    RAISE EXCEPTION 'Sign in again before clearing statement data.' USING ERRCODE='42501';
  END IF;
  -- Imports take this same lock before writing any rows or charging quota.
  PERFORM 1 FROM public.profiles WHERE user_id=v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Account profile unavailable.' USING ERRCODE='42501'; END IF;
  SELECT result INTO v_result FROM app_private.statement_reset_receipts WHERE user_id=v_user AND request_id=_request_id;
  IF FOUND THEN RETURN v_result; END IF;
  IF EXISTS(SELECT 1 FROM app_private.account_operations WHERE user_id=v_user AND closing) THEN
    RAISE EXCEPTION 'Account deletion is already in progress.' USING ERRCODE='42501';
  END IF;
  IF (SELECT count(*) FROM app_private.statement_reset_receipts WHERE user_id=v_user AND completed_at>now()-interval '10 minutes') >= 5 THEN
    RAISE EXCEPTION 'Too many reset attempts. Try again in a few minutes.' USING ERRCODE='P0001';
  END IF;
  -- Wait for in-flight corrections before deleting their immutable history.
  -- Record locks are taken in the same table order used by statement import.
  WITH removed AS (DELETE FROM public.transactions WHERE user_id=v_user RETURNING id)
  SELECT count(*)::integer, coalesce(jsonb_agg(id),'[]'::jsonb) INTO v_transactions,v_transaction_ids FROM removed;
  WITH removed AS (DELETE FROM public.detected_subscriptions WHERE user_id=v_user RETURNING id)
  SELECT count(*)::integer, coalesce(jsonb_agg(id),'[]'::jsonb) INTO v_subscriptions,v_subscription_ids FROM removed;
  WITH removed AS (DELETE FROM public.statement_reviews WHERE user_id=v_user RETURNING id)
  SELECT count(*)::integer, coalesce(jsonb_agg(id),'[]'::jsonb) INTO v_reviews,v_review_ids FROM removed;
  WITH removed AS (DELETE FROM public.upload_history WHERE user_id=v_user RETURNING id)
  SELECT count(*)::integer, coalesce(jsonb_agg(id),'[]'::jsonb) INTO v_imports,v_import_ids FROM removed;
  UPDATE public.profiles SET monthly_spending_history='[]'::jsonb WHERE user_id=v_user;
  v_result := jsonb_build_object('cleared',true,'completedAt',now(),
    'transactions',v_transactions,'subscriptions',v_subscriptions,'reviews',v_reviews,'imports',v_imports);
  INSERT INTO app_private.statement_reset_receipts(user_id,request_id,result,deleted_record_ids) VALUES(v_user,_request_id,v_result,
    jsonb_build_object('transactions',v_transaction_ids,'detected_subscriptions',v_subscription_ids,'statement_reviews',v_review_ids,'upload_history',v_import_ids));
  RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.clear_statement_data(text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.clear_statement_data(text,uuid) TO authenticated;
COMMENT ON FUNCTION public.clear_statement_data(text,uuid) IS 'Clear the signed-in owner statement records atomically. Retain profile, goals, plan and upload usage. Never retry with a new request ID after an unconfirmed response.';
NOTIFY pgrst, 'reload schema';
