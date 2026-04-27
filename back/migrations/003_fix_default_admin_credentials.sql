-- Fix default admin credentials.
-- The original seeded hash does not match admin123.
-- This migration guarantees that the default admin account can log in using:
--   email: admin@example.com
--   password: admin123

INSERT INTO users (username, password_hash, email, role)
VALUES (
  'admin',
  '$2b$10$g8V8nQi.PS/vuxdas/23SuL8PLy8gvqknaJOSOejtXMx6T0fTUpBK',
  'admin@example.com',
  'admin'
)
ON CONFLICT (username)
DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  email = EXCLUDED.email,
  role = 'admin';
