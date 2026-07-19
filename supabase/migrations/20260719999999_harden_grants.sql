-- ============================================================================
-- Revoke dangerous default grants (SECURITY — runs last, deliberately)
--
-- ## What this fixes
--
-- Supabase's bootstrap grants broad table privileges to `anon`, `authenticated`,
-- and `service_role` in the public schema. Among them are three that no client
-- role should ever hold:
--
--   TRUNCATE   — **CRITICAL. Row Level Security does not apply to TRUNCATE.**
--                Verified empirically on this schema: an anonymous, entirely
--                unauthenticated caller could `TRUNCATE public.customer_profiles
--                CASCADE` and destroy every row, with every policy in place and
--                RLS both ENABLED and FORCED. Policies govern SELECT, INSERT,
--                UPDATE, and DELETE. TRUNCATE is none of those — it is a DDL-ish
--                table-level operation and goes straight through.
--
--   TRIGGER    — lets a client attach a trigger to a platform table. The column
--                guards bypass at `pg_trigger_depth() > 1` so the platform's own
--                triggers can maintain derived columns; that bypass is only safe
--                while clients cannot reach trigger depth. TRIGGER privilege is
--                exactly the reachability they must not have.
--
--   REFERENCES — lets a client add foreign keys to platform tables, which can
--                block deletes and leak row existence through FK violations.
--
-- ## Why this file is numbered to run LAST
--
-- REVOKE only affects tables that already exist. Numbered 999999 so it applies
-- after every table in every earlier migration, whenever one is added. The
-- ALTER DEFAULT PRIVILEGES statements below then cover tables created later.
--
-- Both halves are required: the REVOKE fixes today, the DEFAULT PRIVILEGES fix
-- tomorrow. Neither alone is sufficient.
--
-- The schema-invariant suite asserts this stays true, so a future migration that
-- re-grants (or a Supabase upgrade that re-applies its defaults) fails CI rather
-- than silently reopening the hole.
-- ============================================================================

-- ── Existing tables ─────────────────────────────────────────────────────────

REVOKE TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public FROM authenticated;

-- service_role bypasses RLS by design and is server-only, but it has no business
-- truncating tables or attaching triggers either — a compromised service key
-- should not be able to wipe the platform in one statement.
REVOKE TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public FROM service_role;

-- anon must never write. Any public write path (guest enquiry, prelaunch signup)
-- goes through an API route holding a server-side client, never the anon key.
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM anon;

-- ── Future tables ───────────────────────────────────────────────────────────
-- Applies to tables created by `postgres`, which is the role migrations run as.

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLES FROM authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLES FROM service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE INSERT, UPDATE, DELETE ON TABLES FROM anon;

-- ── Functions ───────────────────────────────────────────────────────────────
-- Clients call RPCs through PostgREST, so EXECUTE stays. Creating functions does
-- not, and is not grantable here — CREATE on the schema is what governs it.

REVOKE CREATE ON SCHEMA public FROM anon, authenticated;
