-- Add password_changed_at column to users table.
-- JWTs issued before this timestamp are rejected by the AuthUser extractor,
-- forcing re-login after a password change.
ALTER TABLE users ADD COLUMN password_changed_at TIMESTAMPTZ;
