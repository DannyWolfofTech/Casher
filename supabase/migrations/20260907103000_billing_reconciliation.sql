-- Bounded, recoverable leases prevent older concurrent Stripe reads overwriting
-- newer entitlement state. Only service-side verified Stripe reads may commit.
CREATE TABLE app_private.billing_sync (
  customer_id text PRIMARY KEY CHECK(customer_id ~ '^cus_[A-Za-z0-9]+$'),
  lease uuid, lease_until timestamptz, last_success timestamptz,
  last_failure timestamptz
);
ALTER TABLE app_private.billing_sync ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.billing_sync FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.acquire_billing_sync(_customer_id text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v app_private.billing_sync; k uuid;
BEGIN
  INSERT INTO app_private.billing_sync(customer_id) VALUES(_customer_id) ON CONFLICT DO NOTHING;
  SELECT * INTO v FROM app_private.billing_sync WHERE customer_id=_customer_id FOR UPDATE;
  IF v.lease_until>now() THEN RETURN NULL;END IF;
  k:=gen_random_uuid();
  UPDATE app_private.billing_sync SET lease=k,lease_until=now()+interval '2 minutes' WHERE customer_id=_customer_id;
  RETURN k;
END $$;
CREATE OR REPLACE FUNCTION public.commit_billing_sync(_customer_id text,_lease uuid,_user_id uuid,_state jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  PERFORM 1 FROM app_private.billing_sync WHERE customer_id=_customer_id AND lease=_lease AND lease_until>now() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Billing lease expired';END IF;
  IF EXISTS(SELECT 1 FROM app_private.closed_billing_customers WHERE customer_id=_customer_id) THEN RETURN;END IF;
  IF (_state->>'subscription_tier') NOT IN ('free','pro','premium') OR (_state->>'subscription_status') NOT IN ('inactive','active','past_due','canceled')
    OR NOT _state ? 'subscription_tier' OR NOT _state ? 'subscription_status' THEN RAISE EXCEPTION 'Invalid billing state';END IF;
  UPDATE public.profiles SET subscription_tier=_state->>'subscription_tier',subscription_status=_state->>'subscription_status',
    current_period_end=(_state->>'current_period_end')::timestamptz,stripe_customer_id=_customer_id
    WHERE ((_user_id IS NOT NULL AND user_id=_user_id AND (stripe_customer_id IS NULL OR stripe_customer_id=_customer_id))
      OR (_user_id IS NULL AND stripe_customer_id=_customer_id));
  IF NOT FOUND THEN RAISE EXCEPTION 'Billing profile unavailable';END IF;
  UPDATE app_private.billing_sync SET last_success=now(),last_failure=NULL WHERE customer_id=_customer_id;
END $$;
CREATE OR REPLACE FUNCTION public.release_billing_sync(_customer_id text,_lease uuid,_failed boolean DEFAULT false)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
  UPDATE app_private.billing_sync SET lease=NULL,lease_until=NULL,last_failure=CASE WHEN _failed THEN now() ELSE last_failure END
    WHERE customer_id=_customer_id AND lease=_lease;
$$;
CREATE OR REPLACE FUNCTION public.billing_reconciliation_candidates()
RETURNS TABLE(user_id uuid,stripe_customer_id text) LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
  SELECT p.user_id,p.stripe_customer_id FROM public.profiles p
  LEFT JOIN app_private.billing_sync s ON s.customer_id=p.stripe_customer_id
  WHERE p.stripe_customer_id IS NOT NULL
    AND NOT EXISTS(SELECT 1 FROM app_private.account_operations a WHERE a.user_id=p.user_id AND a.closing)
    AND (s.lease_until IS NULL OR s.lease_until<=now())
    AND (s.last_success IS NULL OR s.last_success<now()-interval '5 minutes')
  ORDER BY greatest(s.last_success,s.last_failure) ASC NULLS FIRST,p.user_id LIMIT 10;
$$;
REVOKE ALL ON FUNCTION public.acquire_billing_sync(text), public.commit_billing_sync(text,uuid,uuid,jsonb),
  public.release_billing_sync(text,uuid,boolean), public.billing_reconciliation_candidates() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_billing_sync(text), public.commit_billing_sync(text,uuid,uuid,jsonb),
  public.release_billing_sync(text,uuid,boolean), public.billing_reconciliation_candidates() TO service_role;
