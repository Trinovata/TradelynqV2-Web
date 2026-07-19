-- ============================================================================
-- Shared trigger functions (playbook S029)
--
-- Timestamps, slugs, and aggregates are maintained by triggers rather than by
-- application code. The reason is not elegance: the database is written to by
-- the web app, the mobile API, cron jobs, webhook consumers, and admin tooling.
-- A rule enforced in one of those five places is a rule that is wrong in four.
-- ============================================================================

-- Maintains `updated_at` on any table carrying that column.
-- Attached per-table as a BEFORE UPDATE trigger.
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
-- SECURITY INVOKER (the default) is correct here: this function needs no
-- privileges beyond those of the caller whose UPDATE fired it.
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION update_updated_at_column() IS
  'BEFORE UPDATE trigger: maintains updated_at. Attach to every table with that column.';


-- Converts arbitrary text into a URL-safe slug.
-- Used for professional storefront URLs, category paths, and catalogue posts.
CREATE OR REPLACE FUNCTION slugify(input TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT trim(
    both '-' FROM
    regexp_replace(
      regexp_replace(lower(coalesce(input, '')), '[^a-z0-9]+', '-', 'g'),
      '-{2,}', '-', 'g'
    )
  );
$$;

COMMENT ON FUNCTION slugify(TEXT) IS
  'Lowercase, non-alphanumerics to single hyphens, trimmed. IMMUTABLE so it can index.';


-- Returns a slug unique within a table, appending -2, -3, … on collision.
--
-- Two professionals may legitimately trade under the same name, and the second
-- one to sign up must not fail or silently overwrite the first's storefront URL.
CREATE OR REPLACE FUNCTION unique_slug(
  base_text TEXT,
  target_table TEXT,
  target_column TEXT DEFAULT 'slug',
  exclude_id UUID DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
-- SECURITY DEFINER: callers are row owners who cannot read the whole table, but
-- uniqueness requires checking rows they cannot see. search_path is pinned to
-- empty and every identifier is quote_ident'd — see the note in handle_new_user.
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  candidate TEXT;
  suffix INT := 1;
  taken BOOLEAN;
BEGIN
  candidate := public.slugify(base_text);

  -- An entirely non-alphanumeric name (or an empty one) slugifies to ''. Fall
  -- back to something addressable rather than writing a blank URL segment.
  IF candidate = '' THEN
    candidate := 'profile';
  END IF;

  LOOP
    EXECUTE format(
      'SELECT EXISTS (SELECT 1 FROM public.%I WHERE %I = $1 AND ($2::uuid IS NULL OR id <> $2))',
      target_table, target_column
    )
    INTO taken
    USING candidate, exclude_id;

    EXIT WHEN NOT taken;

    suffix := suffix + 1;
    candidate := public.slugify(base_text) || '-' || suffix;
  END LOOP;

  RETURN candidate;
END;
$$;

COMMENT ON FUNCTION unique_slug(TEXT, TEXT, TEXT, UUID) IS
  'Collision-safe slug. Appends -2, -3, … Two professionals may share a trading name.';
