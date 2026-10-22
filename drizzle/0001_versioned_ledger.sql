-- Additive migration only: no legacy tables or data are modified.
BEGIN;
CREATE TABLE IF NOT EXISTS ledger_snapshots (
  id text PRIMARY KEY CHECK (id = 'owner'),
  revision bigint NOT NULL CHECK (revision >= 1 AND revision <= 9007199254740991),
  payload jsonb NOT NULL CHECK (payload->>'version' = '2'),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ledger_history (
  ledger_id text NOT NULL CHECK (ledger_id = 'owner'),
  revision bigint NOT NULL CHECK (revision >= 1 AND revision <= 9007199254740991),
  payload jsonb NOT NULL CHECK (payload->>'version' = '2'),
  saved_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ledger_id, revision)
);
CREATE TABLE IF NOT EXISTS owner_passkeys (
  credential_id text PRIMARY KEY,
  public_key bytea NOT NULL,
  counter bigint NOT NULL DEFAULT 0 CHECK (counter >= 0),
  transports text[] NOT NULL DEFAULT '{}',
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);
CREATE TABLE IF NOT EXISTS webauthn_challenges (
  id uuid PRIMARY KEY,
  purpose text NOT NULL CHECK (purpose IN ('registration', 'authentication')),
  challenge text NOT NULL,
  rp_id text NOT NULL,
  origin text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS webauthn_challenges_expires_at_idx ON webauthn_challenges (expires_at);
DELETE FROM webauthn_challenges WHERE expires_at <= now();
COMMIT;
