CREATE TABLE IF NOT EXISTS markets (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  local_name VARCHAR(255),
  country VARCHAR(255),
  province_state VARCHAR(255),
  district VARCHAR(255),
  city_town_village VARCHAR(255),
  identity_key TEXT NOT NULL UNIQUE,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE assessments
  ADD COLUMN IF NOT EXISTS market_id BIGINT REFERENCES markets(id),
  ADD COLUMN IF NOT EXISTS market_sequence INTEGER;

CREATE INDEX IF NOT EXISTS idx_assessments_market_sequence
  ON assessments (market_id, market_sequence);
