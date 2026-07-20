# Operator action — revoke TRUNCATE on the storage schema

**Status:** OPEN. Cannot be fixed by a migration.
**Severity:** Critical — unauthenticated destruction of all uploaded files.
**Found:** 20 July 2026, adversarial review.

---

## The finding

**Row Level Security does not apply to `TRUNCATE`.** Policies govern `SELECT`,
`INSERT`, `UPDATE`, and `DELETE`. `TRUNCATE` is a table-level operation and goes
straight past every policy.

`anon` and `authenticated` hold `TRUNCATE` on the `storage` schema:

- `storage.objects` — every portfolio image, avatar, catalogue post, and every
  KYC document reference on the platform
- `storage.buckets`
- `storage.buckets_analytics`

`anon` is the **unauthenticated** role, behind the publishable key that ships in
the browser bundle of every page and in both mobile apps.

### Reproduced, not theorised

Against the local stack with all storage RLS policies in place:

```
rows before: 1
SET ROLE anon;
NOTICE:  EXPLOITABLE: anon truncated storage.objects
rows after: 0
```

## Why the migration cannot fix it

`storage.objects` is owned by `supabase_storage_admin`. Migrations run as
`postgres`, which is **not a member of that role**:

```sql
SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid = 'storage.objects'::regclass;
-- supabase_storage_admin
```

Postgres does **not** raise an error when a non-owner issues `REVOKE` — it emits
a notice and changes nothing. That silent no-op is exactly how the first
hardening pass (`20260719999999_harden_grants.sql`) appeared to succeed while
covering only the `public` schema.

The migration now attempts the revoke, **verifies the outcome**, and raises a
`WARNING` naming this document when it cannot complete. The policy suite reports
it on every run rather than asserting it, so it stays visible instead of turning
a real finding into a permanently red suite everyone learns to skip.

## The remedy

Run as a role that owns the storage schema. On hosted Supabase the **SQL editor
executes with higher privilege than a migration**, so this generally works there
even though it fails locally.

```sql
REVOKE TRUNCATE ON ALL TABLES IN SCHEMA storage FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA storage
  REVOKE TRUNCATE ON TABLES FROM anon, authenticated;
```

### Verify it took

```sql
SELECT table_name, grantee
FROM information_schema.role_table_grants
WHERE table_schema = 'storage'
  AND privilege_type = 'TRUNCATE'
  AND grantee IN ('anon', 'authenticated');
```

**Zero rows means it worked.** Any rows returned means the revoke silently
no-opped again — the SQL editor's role is not sufficient either, and the next
step is Supabase support, quoting this document.

### Will it break anything?

No. The storage API performs ordinary DML (`SELECT`/`INSERT`/`UPDATE`/`DELETE`)
as the calling role, and those grants are untouched. Nothing in this codebase
truncates a storage table — uploads insert, deletions delete.

## Also check V1

V1 runs on the same platform defaults and has **zero `REVOKE` statements across
its 82 migrations**. The same query above, run against the V1 production project,
answers whether it is exposed. See
`Tradelynq/docs/SECURITY-ADVISORY-2026-07-19-truncate-grant.md` for the wider
advisory, which covers the `public` schema on V1.

## When this is cleared

Change the reporting block in `tests/sql/zzz_vuln_regression.sql` from a
`RAISE WARNING` to a hard `ASSERT`, so any regression fails CI. The block is
marked with a comment saying so.
