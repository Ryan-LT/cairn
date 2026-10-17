-- Add a login account. Replace the values, then run it in the Neon SQL Editor.
-- The new account starts with no data; the person fills it in after signing in,
-- and can change the password themselves in Settings.
-- Usernames and emails are case-insensitive (stored lowercase); the password is stored as a bcrypt hash.

INSERT INTO cairn_users (username, display_name, email, password_hash)
VALUES (
  lower('alice'),                                -- username used to sign in
  'Alice Nguyen',                                -- name shown in the app (optional, can be NULL)
  lower('alice@example.com'),                    -- optional second sign-in name (or NULL)
  crypt('change-me-strong-password', gen_salt('bf', 12))
);

-- Set or change someone's email (they can then sign in with it):
--   UPDATE cairn_users SET email = lower('alice@example.com') WHERE username = 'alice';
--
-- Forgotten password (admin reset; signs out their devices). Ask them to change it in Settings afterwards:
--   UPDATE cairn_users
--   SET password_hash = crypt('temporary-password', gen_salt('bf', 12)),
--       password_changed_at = date_trunc('second', now()),
--       failed_attempts = 0, locked_until = NULL
--   WHERE username = 'alice';
--
-- Unlock an account after 5 wrong passwords (otherwise it unlocks itself after 15 minutes):
--   UPDATE cairn_users SET failed_attempts = 0, locked_until = NULL WHERE username = 'alice';
--
-- Delete an account and all of its data:
--   DELETE FROM cairn_users WHERE username = 'alice';
