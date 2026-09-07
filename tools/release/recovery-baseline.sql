-- Read-only comparison data for the actual provider-export restore drill.
-- Contains counts and metadata fingerprints, never customer records or secrets.
SELECT jsonb_build_object(
  'captured_at', now(),
  'counts', jsonb_build_object(
    'auth_users', (SELECT count(*) FROM auth.users),
    'auth_identities', (SELECT count(*) FROM auth.identities),
    'profiles', (SELECT count(*) FROM public.profiles),
    'transactions', (SELECT count(*) FROM public.transactions),
    'detected_subscriptions', (SELECT count(*) FROM public.detected_subscriptions),
    'user_subscriptions', (SELECT count(*) FROM public.user_subscriptions),
    'subscription_plans', (SELECT count(*) FROM public.subscription_plans),
    'savings_goals', (SELECT count(*) FROM public.savings_goals),
    'referrals', (SELECT count(*) FROM public.referrals),
    'user_roles', (SELECT count(*) FROM public.user_roles),
    'upload_history', (SELECT count(*) FROM public.upload_history),
    'statement_reviews', (SELECT count(*) FROM public.statement_reviews),
    'closed_accounts', (SELECT count(*) FROM app_private.closed_accounts),
    'closed_billing_customers', (SELECT count(*) FROM app_private.closed_billing_customers),
    'migrations', (SELECT count(*) FROM supabase_migrations.schema_migrations)
  ),
  'application_rls', (
    SELECT jsonb_agg(jsonb_build_object('schema', schemaname, 'table', tablename, 'enabled', rowsecurity)
      ORDER BY schemaname, tablename)
    FROM pg_tables WHERE schemaname IN ('public', 'app_private')
  ),
  'application_policy_fingerprint', (
    SELECT md5(string_agg(row(schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check)::text,
      E'\n' ORDER BY schemaname, tablename, policyname))
    FROM pg_policies WHERE schemaname IN ('public', 'app_private')
  ),
  'application_function_fingerprint', (
    SELECT md5(string_agg(pg_get_functiondef(p.oid), E'\n' ORDER BY n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)))
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname IN ('public', 'app_private') AND p.prokind='f'
  ),
  'application_structure_fingerprint', (
    SELECT md5(string_agg(definition, E'\n' ORDER BY definition)) FROM (
      SELECT concat_ws('|', 'column', n.nspname, c.relname, a.attname,
        format_type(a.atttypid, a.atttypmod), a.attnotnull,
        pg_get_expr(d.adbin, d.adrelid)) AS definition
      FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace
      LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
      WHERE n.nspname IN ('public', 'app_private') AND c.relkind='r'
        AND a.attnum>0 AND NOT a.attisdropped
      UNION ALL
      SELECT concat_ws('|', 'constraint', n.nspname, c.relname, k.conname,
        pg_get_constraintdef(k.oid, true))
      FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname IN ('public', 'app_private')
      UNION ALL
      SELECT concat_ws('|', 'index', schemaname, tablename, indexname, indexdef)
      FROM pg_indexes WHERE schemaname IN ('public', 'app_private')
      UNION ALL
      SELECT concat_ws('|', 'trigger', n.nspname, c.relname, t.tgname,
        t.tgenabled, pg_get_triggerdef(t.oid, true))
      FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname IN ('public', 'app_private') AND NOT t.tgisinternal
    ) AS structure
  ),
  'migration_fingerprint', (
    SELECT md5(string_agg(version, E'\n' ORDER BY version))
    FROM supabase_migrations.schema_migrations
  ),
  'deleted_users_still_present', (
    SELECT count(*) FROM app_private.closed_accounts c JOIN auth.users u ON u.id=c.user_id
  )
) AS recovery_baseline;
