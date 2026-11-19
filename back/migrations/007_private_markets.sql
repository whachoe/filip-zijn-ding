ALTER TABLE markets DROP CONSTRAINT IF EXISTS markets_identity_key_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_markets_owner_identity
  ON markets (created_by, identity_key);
