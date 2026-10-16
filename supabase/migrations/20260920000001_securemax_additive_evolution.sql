-- ============================================================
-- SecureMax SIH26125 — Additive Database Evolution
-- Safely extending the existing 21-table schema without drops
-- ============================================================

-- ===================== ADDITIVE ALTERATIONS =====================

-- 1. users
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS employee_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS designation TEXT,
  ADD COLUMN IF NOT EXISTS kyc_status TEXT DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS controller_address TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Note: 'dids' table exists separately, but we also want a quick index on the user table if needed,
-- or we can rely on identity_sync. The prompt asked for DID/reference on USER/IDENTITY.
ALTER TABLE users ADD COLUMN IF NOT EXISTS did TEXT UNIQUE;

-- 2. wallets (This acts as our admin_wallets table)
ALTER TABLE wallets
  ADD COLUMN IF NOT EXISTS label TEXT,
  ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_authenticated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revocation_reason TEXT;

-- 3. devices (Depends on user_credentials, so we add credential_id as UUID)
ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS device_name TEXT,
  ADD COLUMN IF NOT EXISTS device_type TEXT,
  ADD COLUMN IF NOT EXISTS credential_id UUID, -- Foreign key added below
  ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_ip INET,
  ADD COLUMN IF NOT EXISTS user_agent TEXT,
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

-- The existing device_fingerprint is NOT NULL, but normal WebAuthn flows may not have one instantly.
-- We alter it to drop the NOT NULL constraint to support the new flow.
ALTER TABLE devices ALTER COLUMN device_fingerprint DROP NOT NULL;

-- 4. assets
ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS token_id TEXT,
  ADD COLUMN IF NOT EXISTS current_owner_address TEXT,
  ADD COLUMN IF NOT EXISTS current_owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS owner_did TEXT,
  ADD COLUMN IF NOT EXISTS metadata_uri TEXT,
  ADD COLUMN IF NOT EXISTS contract_address TEXT,
  ADD COLUMN IF NOT EXISTS network TEXT;

-- 5. blockchain_transactions
ALTER TABLE blockchain_transactions
  ADD COLUMN IF NOT EXISTS network TEXT,
  ADD COLUMN IF NOT EXISTS contract_address TEXT,
  ADD COLUMN IF NOT EXISTS function_name TEXT,
  ADD COLUMN IF NOT EXISTS initiated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS submitted_by_wallet TEXT,
  ADD COLUMN IF NOT EXISTS block_number BIGINT,
  ADD COLUMN IF NOT EXISTS gas_used NUMERIC,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

-- 6. audit_events
-- Preserving existing BIGINT id and existing columns. Adding new contextual columns for compliance.
ALTER TABLE audit_events
  ADD COLUMN IF NOT EXISTS event_category TEXT,
  ADD COLUMN IF NOT EXISTS occurred_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS actor_wallet_address TEXT,
  ADD COLUMN IF NOT EXISTS actor_did TEXT,
  ADD COLUMN IF NOT EXISTS actor_role TEXT,
  ADD COLUMN IF NOT EXISTS target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resource_type TEXT,
  ADD COLUMN IF NOT EXISTS resource_id TEXT,
  ADD COLUMN IF NOT EXISTS action TEXT,
  ADD COLUMN IF NOT EXISTS result TEXT,
  ADD COLUMN IF NOT EXISTS reason TEXT,
  ADD COLUMN IF NOT EXISTS session_id UUID, -- FK to access_sessions/sessions added later if needed
  ADD COLUMN IF NOT EXISTS device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ip_address INET,
  ADD COLUMN IF NOT EXISTS user_agent TEXT,
  ADD COLUMN IF NOT EXISTS request_id TEXT,
  ADD COLUMN IF NOT EXISTS transaction_hash TEXT,
  ADD COLUMN IF NOT EXISTS block_number BIGINT,
  ADD COLUMN IF NOT EXISTS contract_address TEXT,
  ADD COLUMN IF NOT EXISTS event_signature TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB,
  ADD COLUMN IF NOT EXISTS previous_event_hash TEXT;


-- ===================== CREATE NEW ADDITIVE TABLES =====================

-- 7. user_credentials (Normal Users)
CREATE TABLE IF NOT EXISTS user_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
  credential_type TEXT NOT NULL DEFAULT 'P256',
  public_key TEXT NOT NULL,
  public_key_format TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  key_version INTEGER DEFAULT 1,
  metadata JSONB
);

-- Link devices -> user_credentials safely
ALTER TABLE devices
  ADD CONSTRAINT fk_device_credential FOREIGN KEY (credential_id) REFERENCES user_credentials(id) ON DELETE SET NULL;

-- 8. auth_challenges
CREATE TABLE IF NOT EXISTS auth_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_type TEXT NOT NULL, -- e.g., 'ADMIN_METAMASK', 'USER_CRYPTO'
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE,
  credential_id UUID REFERENCES user_credentials(id) ON DELETE CASCADE,
  challenge TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'PENDING',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  request_ip INET,
  user_agent TEXT
);

-- 9. enrollment_codes
CREATE TABLE IF NOT EXISTS enrollment_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_by_wallet_id UUID REFERENCES wallets(id) ON DELETE SET NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  revoked_at TIMESTAMPTZ,
  metadata JSONB
);

-- 10. kyc_records
CREATE TABLE IF NOT EXISTS kyc_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'PENDING',
  verification_method TEXT,
  verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  rejection_reason TEXT,
  document_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. asset_events
CREATE TABLE IF NOT EXISTS asset_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_wallet_address TEXT,
  from_address TEXT,
  to_address TEXT,
  token_id TEXT,
  transaction_hash TEXT,
  block_number BIGINT,
  block_timestamp TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12. identity_sync
CREATE TABLE IF NOT EXISTS identity_sync (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  did TEXT NOT NULL,
  controller_address TEXT NOT NULL,
  identity_status TEXT NOT NULL,
  public_key_hash TEXT,
  contract_address TEXT NOT NULL,
  last_synced_block BIGINT,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  registration_tx_hash TEXT,
  updated_tx_hash TEXT
);

-- ===================== SECURITY & INDEXES =====================

CREATE INDEX IF NOT EXISTS idx_users_employee_id ON users(employee_id);
CREATE INDEX IF NOT EXISTS idx_users_controller_address ON users(controller_address);
CREATE INDEX IF NOT EXISTS idx_user_credentials_user_id ON user_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_challenges_status ON auth_challenges(status);
CREATE INDEX IF NOT EXISTS idx_enrollment_codes_hash ON enrollment_codes(code_hash);
CREATE INDEX IF NOT EXISTS idx_kyc_records_user_id ON kyc_records(user_id);
CREATE INDEX IF NOT EXISTS idx_identity_sync_controller ON identity_sync(controller_address);

-- Enable RLS on new tables
ALTER TABLE user_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollment_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity_sync ENABLE ROW LEVEL SECURITY;
