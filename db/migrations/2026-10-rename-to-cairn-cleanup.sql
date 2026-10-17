-- Drop the wealthtracker_* compatibility views left by 2026-10-rename-to-cairn.sql.
-- Run once the release that uses the cairn_* tables is live. Safe to re-run; touches no table data.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.relname
    FROM pg_class c
    WHERE c.relnamespace = current_schema()::regnamespace
      AND c.relkind = 'v'
      AND c.relname LIKE 'wealthtracker\_%'
  LOOP
    EXECUTE format('DROP VIEW %I', r.relname);
  END LOOP;
END $$;
