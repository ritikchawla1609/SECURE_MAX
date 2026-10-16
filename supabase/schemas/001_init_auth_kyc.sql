-- ===========================================================================
-- 001_init_auth_kyc.sql
-- Owner: Person 1 (KYC + cryptographic authentication).
-- Creates ONLY authentication/KYC tables. No DID / RBAC / NFT tables here.
-- All data in this schema is OFF-CHAIN and must never be written to a contract.
-- ===========================================================================
BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'kyc_status') THEN
    CREATE TYPE kyc_status AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- users : account record. Low-sensitivity identifiers only.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  user_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email               TEXT NOT NULL,
  name                TEXT NOT NULL,
  phone               TEXT,
  kyc_status          kyc_status NOT NULL DEFAULT 'PENDING',
  -- Local reviewer flag. Interim mechanism only: authoritative role assignment
  -- is owned by Person 3 (RBAC). See docs/INTEGRATION.md.
  is_reviewer         BOOLEAN NOT NULL DEFAULT FALSE,
  failed_login_count  INTEGER NOT NULL DEFAULT 0,
  locked_until        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (lower(email));

DROP TRIGGER IF EXISTS users_set_updated_at ON users;
CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- cryptographic_identities : PUBLIC key material only.
-- The backend never receives, derives or stores a private key.
-- public_key is base64(SubjectPublicKeyInfo DER), as exported by Web Crypto.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cryptographic_identities (
  identity_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  algorithm              TEXT NOT NULL
                           CHECK (algorithm IN ('ECDSA_P256_SHA256', 'ED25519')),
  public_key             TEXT NOT NULL,
  public_key_fingerprint TEXT NOT NULL UNIQUE,
  status                 TEXT NOT NULL DEFAULT 'ACTIVE'
                           CHECK (status IN ('ACTIVE', 'REVOKED')),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- At most one ACTIVE key per user; revoked keys are retained for audit.
CREATE UNIQUE INDEX IF NOT EXISTS identities_one_active_per_user
  ON cryptographic_identities (user_id) WHERE status = 'ACTIVE';

DROP TRIGGER IF EXISTS identities_set_updated_at ON cryptographic_identities;
CREATE TRIGGER identities_set_updated_at BEFORE UPDATE ON cryptographic_identities
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- login_challenges : single-use, time-limited, user-bound nonces.
-- `challenge` stores the exact UTF-8 message the client must sign.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS login_challenges (
  challenge_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  challenge    TEXT NOT NULL,
  nonce        TEXT NOT NULL,
  expires_at   TIMESTAMPTZ NOT NULL,
  used         BOOLEAN NOT NULL DEFAULT FALSE,
  used_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS login_challenges_user_idx ON login_challenges (user_id);
CREATE INDEX IF NOT EXISTS login_challenges_expiry_idx ON login_challenges (expires_at);

-- ---------------------------------------------------------------------------
-- sessions : opaque bearer tokens. Only the SHA-256 hash is stored, so a
-- database dump does not yield usable session tokens.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions (expires_at);

-- ---------------------------------------------------------------------------
-- kyc_records : the sensitive part of the KYC submission.
-- date_of_birth and government_id_reference are AES-256-GCM encrypted at rest.
-- Nothing in this table is ever exposed to the blockchain layer.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kyc_records (
  record_id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
  date_of_birth_enc           TEXT NOT NULL,
  government_id_reference_enc TEXT NOT NULL,
  status                      kyc_status NOT NULL DEFAULT 'PENDING',
  decision_reason             TEXT,
  reviewed_by                 UUID REFERENCES users(user_id),
  reviewed_at                 TIMESTAMPTZ,
  submitted_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS kyc_set_updated_at ON kyc_records;
CREATE TRIGGER kyc_set_updated_at BEFORE UPDATE ON kyc_records
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- auth_audit_log : off-chain security event trail. Separate from, and
-- complementary to, the on-chain audit trail owned by Persons 2/3/4.
-- `detail` must never contain PII, key material or session tokens.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auth_audit_log (
  event_id   BIGSERIAL PRIMARY KEY,
  user_id    UUID,
  event_type TEXT NOT NULL,
  success    BOOLEAN NOT NULL,
  ip_hash    TEXT,
  detail     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_audit_user_idx ON auth_audit_log (user_id, created_at DESC);

COMMIT;
