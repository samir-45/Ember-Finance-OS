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
COMMIT;
