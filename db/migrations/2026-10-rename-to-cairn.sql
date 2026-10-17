-- Rename the app's tables from wealthtracker_* to cairn_* (the app is now called Cairn).
-- Run in the Neon SQL Editor BEFORE deploying the code that uses the new names. Safe to re-run.
--
-- Only names change: ALTER ... RENAME keeps every row, index, constraint, default and sequence
-- value, and the whole script is one transaction, so a failure leaves the database untouched.
--
-- To keep the old release working until the new one is live, each renamed table gets a view under
-- its old name (plain views, so INSERT / UPDATE / DELETE / ON CONFLICT still reach the table).
-- Once the new release is serving traffic, run 2026-10-rename-to-cairn-cleanup.sql to drop them.
--
-- This applies to a database that already has the wealthtracker_* tables. A new database should
-- use db/schema.sql, which already has the cairn_* names, and none of the older migrations.

BEGIN;

DO $$
DECLARE
  r RECORD;
  new_name TEXT;
  has_rows BOOLEAN;
  renamed TEXT[] := '{}';
  counts JSONB := '{}';
  n BIGINT;
  m BIGINT;
BEGIN
  -- 1. Tables.
  FOR r IN
    SELECT c.relname
    FROM pg_class c
    WHERE c.relnamespace = current_schema()::regnamespace
      AND c.relkind = 'r'
      AND c.relname LIKE 'wealthtracker\_%'
    ORDER BY c.relname
  LOOP
    new_name := 'cairn_' || substr(r.relname, length('wealthtracker_') + 1);

    IF to_regclass(quote_ident(new_name)) IS NOT NULL THEN
      -- A cairn_* table already exists: the new release created it before this migration ran.
      -- An empty one is safe to replace; one with rows means data in two places, so stop.
      EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I)', new_name) INTO has_rows;
      IF has_rows THEN
        RAISE EXCEPTION '% already exists and has rows; merge it into % by hand, then re-run', new_name, r.relname;
      END IF;
      RAISE NOTICE 'dropping empty % so % can take its name', new_name, r.relname;
      EXECUTE format('DROP TABLE %I CASCADE', new_name);
    END IF;

    EXECUTE format('SELECT count(*) FROM %I', r.relname) INTO n;
    counts := counts || jsonb_build_object(new_name, n);
    EXECUTE format('ALTER TABLE %I RENAME TO %I', r.relname, new_name);
    renamed := renamed || r.relname;
  END LOOP;

  -- 2. Constraints named after a table (primary keys, uniques); renaming one renames its index too.
  FOR r IN
    SELECT con.conrelid::regclass::TEXT AS tbl, con.conname
    FROM pg_constraint con
    WHERE con.connamespace = current_schema()::regnamespace
      AND con.conname LIKE 'wealthtracker\_%'
  LOOP
    new_name := 'cairn_' || substr(r.conname, length('wealthtracker_') + 1);
    EXECUTE format('ALTER TABLE %s RENAME CONSTRAINT %I TO %I', r.tbl, r.conname, new_name);
  END LOOP;

  -- 3. Remaining indexes and sequences (including the ones behind BIGSERIAL columns).
  FOR r IN
    SELECT c.relname, c.relkind
    FROM pg_class c
    WHERE c.relnamespace = current_schema()::regnamespace
      AND c.relkind IN ('i', 'S')
      AND c.relname LIKE 'wealthtracker\_%'
    ORDER BY c.relname
  LOOP
    new_name := 'cairn_' || substr(r.relname, length('wealthtracker_') + 1);
    IF r.relkind = 'i' THEN
      EXECUTE format('ALTER INDEX %I RENAME TO %I', r.relname, new_name);
    ELSE
      EXECUTE format('ALTER SEQUENCE %I RENAME TO %I', r.relname, new_name);
    END IF;
  END LOOP;

  -- 3b. Safety net: every table still has exactly the rows it had, and nothing kept its old name.
  --     Any exception here rolls the whole migration back.
  FOR r IN SELECT key AS tbl, value::BIGINT AS expected FROM jsonb_each_text(counts) AS e(key, value) LOOP
    EXECUTE format('SELECT count(*) FROM %I', r.tbl) INTO m;
    IF m <> r.expected THEN
      RAISE EXCEPTION '% has % rows after the rename, expected %', r.tbl, m, r.expected;
    END IF;
  END LOOP;
  IF EXISTS (
    SELECT 1 FROM pg_class c
    WHERE c.relnamespace = current_schema()::regnamespace
      AND c.relkind IN ('r', 'i', 'S')
      AND c.relname LIKE 'wealthtracker\_%'
  ) THEN
    RAISE EXCEPTION 'some wealthtracker_* tables, indexes or sequences were not renamed';
  END IF;
  RAISE NOTICE 'renamed % tables; row counts verified: %', cardinality(renamed), counts;

  -- 4. Old-name views for the release that is still running (dropped by the cleanup migration).
  FOREACH new_name IN ARRAY renamed LOOP
    EXECUTE format(
      'CREATE VIEW %I AS SELECT * FROM %I',
      new_name,
      'cairn_' || substr(new_name, length('wealthtracker_') + 1)
    );
  END LOOP;
END $$;

COMMIT;
