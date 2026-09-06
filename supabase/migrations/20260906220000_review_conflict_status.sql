-- A stale edit is an application conflict, not a retryable database serialization failure.
-- PT409 makes PostgREST return HTTP 409 immediately to the caller.
CREATE OR REPLACE FUNCTION public.review_transaction(
  _id uuid, _direction text, _category text, _expected_reviewed_at timestamptz DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.transactions%ROWTYPE; v_time timestamptz := clock_timestamp();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501'; END IF;
  IF _direction IS NULL OR _direction NOT IN ('debit', 'credit') OR _category IS NULL OR length(trim(_category)) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION 'Choose a payment direction and a category of 1 to 80 characters' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_row FROM public.transactions WHERE id = _id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transaction unavailable' USING ERRCODE = '42501'; END IF;
  IF v_row.reviewed_at IS DISTINCT FROM _expected_reviewed_at THEN RAISE EXCEPTION 'This record has changed. Reload and try again.' USING ERRCODE = 'PT409'; END IF;
  UPDATE public.transactions SET direction_override = _direction, category_override = trim(_category), reviewed_at = v_time WHERE id = v_row.id;
  INSERT INTO public.statement_reviews(user_id, record_kind, record_id, previous_values, new_values)
    VALUES (auth.uid(), 'transaction', v_row.id,
      jsonb_build_object('direction', coalesce(v_row.direction_override, v_row.direction), 'category', coalesce(v_row.category_override, v_row.category)),
      jsonb_build_object('direction', _direction, 'category', trim(_category)));
  RETURN jsonb_build_object('id', v_row.id, 'reviewed_at', v_time);
END;
$$;
REVOKE ALL ON FUNCTION public.review_transaction(uuid, text, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_transaction(uuid, text, text, timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.review_subscription(
  _id uuid, _status text, _amount numeric, _frequency text, _expected_reviewed_at timestamptz DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.detected_subscriptions%ROWTYPE; v_time timestamptz := clock_timestamp(); v_multiplier integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501'; END IF;
  v_multiplier := CASE _frequency WHEN 'monthly' THEN 12 WHEN 'annual' THEN 1 WHEN 'weekly' THEN 52 WHEN 'fortnightly' THEN 26 WHEN 'quarterly' THEN 4 END;
  IF _status IS NULL OR _status NOT IN ('active', 'cancelled', 'dismissed') OR _amount IS NULL OR NOT (_amount > 0 AND _amount < 100000000)
      OR round(_amount, 2) <> _amount OR v_multiplier IS NULL OR _amount * v_multiplier >= 100000000 THEN
    RAISE EXCEPTION 'Enter a valid status, amount and billing frequency' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_row FROM public.detected_subscriptions WHERE id = _id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Subscription unavailable' USING ERRCODE = '42501'; END IF;
  IF v_row.reviewed_at IS DISTINCT FROM _expected_reviewed_at THEN RAISE EXCEPTION 'This record has changed. Reload and try again.' USING ERRCODE = 'PT409'; END IF;
  UPDATE public.detected_subscriptions SET status = _status, amount = _amount, frequency = _frequency,
    estimated_annual_cost = _amount * v_multiplier,
    details_locked = details_locked OR amount IS DISTINCT FROM _amount OR frequency IS DISTINCT FROM _frequency,
    reviewed_at = v_time WHERE id = v_row.id;
  INSERT INTO public.statement_reviews(user_id, record_kind, record_id, previous_values, new_values)
    VALUES (auth.uid(), 'subscription', v_row.id,
      jsonb_build_object('status', v_row.status, 'amount', v_row.amount, 'frequency', v_row.frequency),
      jsonb_build_object('status', _status, 'amount', _amount, 'frequency', _frequency));
  RETURN jsonb_build_object('id', v_row.id, 'reviewed_at', v_time);
END;
$$;
REVOKE ALL ON FUNCTION public.review_subscription(uuid, text, numeric, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_subscription(uuid, text, numeric, text, timestamptz) TO authenticated;
DROP POLICY IF EXISTS "Users can insert their own detected subscriptions" ON public.detected_subscriptions;
DROP POLICY IF EXISTS "Users can update their own detected subscriptions" ON public.detected_subscriptions;
