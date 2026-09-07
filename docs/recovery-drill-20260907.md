# Actual database recovery drill — 7 September 2026

**PASS: the owner's fresh Lovable export was restored and verified. Full-service disaster recovery is not yet production ready.** The export is private; only aggregate evidence is committed in [the verification record](recovery-drill-20260907.json).

The archive created at 19:42:56 UTC restored 29 Auth users, 31 identities, 29 profiles, 490 transactions, 60 detected subscriptions and 34 migrations. Application schema, functions, policies and all 23 RLS table settings matched production. All 28 existing password hashes matched without printing hashes or credentials. Owners and effective privileges matched across 96 application/Auth objects; some original ACL grantor attribution differs after logical restore.

Actual SQL behavior tests passed for anonymous isolation, owner-only reads, cross-user correction denial, neutralization of client entitlement changes, own-record correction, deletion leases, cascading deletion, explicit upload cleanup and deletion receipts. Tests rolled back, and post-test counts/fingerprints were unchanged. The repeatable clean restore took 2.36 seconds; restore plus behavior verification took 3.51 seconds after container startup. This is a small database measurement, not a promised service recovery time.

## Reproduce safely

Extract only the expected `.backup` member from the owner's ZIP into a private directory, then run:

```powershell
./tools/release/restore-provider-export.ps1 `
  -ArchivePath '.audit-results/recovery-current/trycasher-com_260907.backup' `
  -PrivateReportDirectory '.audit-results/recovery-current/repeatable-drill'
```

The script creates a new PostgreSQL instance with no network, no published ports, read-only root, temporary memory-backed data, zero background-worker slots and disabled cron execution. It preserves ownership and ACLs, fails on restore errors, runs behavior checks and removes the isolated copy. It never accepts a production connection string. Original exports and private reports remain with the owner. All temporary instances created for this drill were removed.

The real provider archive requires `pg_cron` and `pg_net` to be preloaded for schema restoration, even though their workers must remain disabled. It also contains sequence grants for two omitted extension-managed email queues. The script recreates only those missing operational queues empty. It does not replace or fabricate customer tables or records.

## Remaining service-recovery boundaries

1. **Provider-managed secret:** the exported Vault record cannot decrypt on another host (SQLSTATE `22000`). Obtain Lovable's supported process to reprovision `email_queue_service_role_key`, along with Cloud environment secrets, into an isolated replacement. Do not export its plaintext or enable restored jobs before that replacement has been verified.
2. **Storage and application configuration:** object bytes, deployment configuration and external provider credentials are not supplied by this database export. Exercise their restoration separately, using private owner-controlled storage.
3. **Retained snapshots:** this proves restoration of a fresh logical export, not a retained daily backup. No production Restore button was used. The supported historical restore/replacement route remains a provider dependency.
4. **Cutover and authentication:** database password integrity and permission/deletion behavior passed; a complete replacement Auth/API deployment, external integration checks and timed cutover have not been exercised. Keep outbound jobs disabled until current deletion receipts and external subscription states have been reconciled.

No live application, existing user record, Stripe setting or production bank-connection gate changed during this drill.
