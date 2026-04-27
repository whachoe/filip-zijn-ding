-- Enforce case-insensitive uniqueness for user emails
-- This keeps NULL emails allowed, but any provided email must be unique ignoring case.

-- Normalize stored emails so uniqueness is deterministic.
UPDATE users
SET email = NULLIF(LOWER(TRIM(email)), '')
WHERE email IS NOT NULL;

-- Abort with a clear error if duplicates exist before adding the unique index.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM users
    WHERE email IS NOT NULL
    GROUP BY LOWER(email)
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce unique emails: duplicate case-insensitive emails exist in users.email';
  END IF;
END
$$;

-- Enforce case-insensitive uniqueness for non-null emails.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_ci_unique
ON users (LOWER(email))
WHERE email IS NOT NULL;
