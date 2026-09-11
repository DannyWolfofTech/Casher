-- User-confirmed statement reset, separate from account closure and billing.
-- Receipt IDs make a retried request safe even after a later import.
CREATE TABLE app_private.statement_reset_receipts (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  result jsonb NOT NULL,
  PRIMARY KEY(user_id, request_id)
);
ALTER TABLE app_private.statement_reset_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.statement_reset_receipts FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.clear_statement_data(_confirmation text, _request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := auth.uid(); v_signed_in timestamptz; v_result jsonb;
  v_transactions integer; v_subscriptions integer; v_reviews integer; v_imports integer;
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
  DELETE FROM public.transactions WHERE user_id=v_user;
  GET DIAGNOSTICS v_transactions = ROW_COUNT;
  DELETE FROM public.detected_subscriptions WHERE user_id=v_user;
  GET DIAGNOSTICS v_subscriptions = ROW_COUNT;
  DELETE FROM public.statement_reviews WHERE user_id=v_user;
  GET DIAGNOSTICS v_reviews = ROW_COUNT;
  DELETE FROM public.upload_history WHERE user_id=v_user;
  GET DIAGNOSTICS v_imports = ROW_COUNT;
  UPDATE public.profiles SET monthly_spending_history='[]'::jsonb WHERE user_id=v_user;
  v_result := jsonb_build_object('cleared',true,'completedAt',now(),
    'transactions',v_transactions,'subscriptions',v_subscriptions,'reviews',v_reviews,'imports',v_imports);
  INSERT INTO app_private.statement_reset_receipts(user_id,request_id,result) VALUES(v_user,_request_id,v_result);
  RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.clear_statement_data(text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.clear_statement_data(text,uuid) TO authenticated;
COMMENT ON FUNCTION public.clear_statement_data(text,uuid) IS 'Clear the signed-in owner statement records atomically. Retain profile, goals, plan and upload usage. Never retry with a new request ID after an unconfirmed response.';
NOTIFY pgrst, 'reload schema';
