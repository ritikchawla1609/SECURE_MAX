-- ============================================================
-- SecureMax SIH26125 — Expanded Database Schema Migration
-- Supabase PostgreSQL (21 Required Tables)
-- ============================================================

-- ===================== ENUM TYPES =====================
CREATE TYPE user_status AS ENUM ('ACTIVE', 'SUSPENDED', 'REVOKED');
CREATE TYPE classification_level AS ENUM ('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED', 'HIGH');
CREATE TYPE asset_status AS ENUM ('ACTIVE', 'ARCHIVED', 'REVOKED', 'TRANSFERRING');
CREATE TYPE assignment_status AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');
CREATE TYPE access_status AS ENUM ('PENDING', 'AUTHORIZED', 'DENIED', 'EXPIRED', 'REVOKED');
CREATE TYPE key_status AS ENUM ('ACTIVE', 'ROTATING', 'ROTATED', 'REVOKED', 'DESTROYED');
CREATE TYPE severity_level AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE finding_status AS ENUM ('OPEN', 'INVESTIGATING', 'REMEDIATED', 'VERIFIED', 'CLOSED');
CREATE TYPE scan_status AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');
CREATE TYPE chain_type AS ENUM ('CHAIN_1', 'CHAIN_2');

-- ===================== TABLES =====================

-- 1. users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL,
  email TEXT UNIQUE,
  status user_status NOT NULL DEFAULT 'ACTIVE',
  is_sandbox BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. roles
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT
);

-- 3. user_roles
CREATE TABLE user_roles (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

-- 4. dids
CREATE TABLE dids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  did_string TEXT UNIQUE NOT NULL,
  status user_status NOT NULL DEFAULT 'ACTIVE',
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. wallets
CREATE TABLE wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  address TEXT UNIQUE NOT NULL,
  status user_status NOT NULL DEFAULT 'ACTIVE',
  verified_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. devices
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_fingerprint TEXT UNIQUE NOT NULL,
  status user_status NOT NULL DEFAULT 'ACTIVE',
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. assets
CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  classification classification_level NOT NULL,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  storage_path TEXT,
  status asset_status NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. asset_assignments
CREATE TABLE asset_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_by_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status assignment_status NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);

-- 9. asset_permissions
CREATE TABLE asset_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES asset_assignments(id) ON DELETE CASCADE,
  can_read BOOLEAN NOT NULL DEFAULT true,
  can_decrypt BOOLEAN NOT NULL DEFAULT false,
  can_transfer BOOLEAN NOT NULL DEFAULT false
);

-- 10. access_requests
CREATE TABLE access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  purpose TEXT,
  status access_status NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- 11. access_sessions
CREATE TABLE access_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- 12. encryption_keys
CREATE TABLE encryption_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  algorithm TEXT NOT NULL DEFAULT 'aes-256-gcm',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 13. key_versions
CREATE TABLE key_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id UUID NOT NULL REFERENCES encryption_keys(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  encrypted_dek TEXT NOT NULL,
  dek_iv TEXT NOT NULL,
  status key_status NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(key_id, version_number)
);

-- 14. key_policies
CREATE TABLE key_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id UUID NOT NULL REFERENCES encryption_keys(id) ON DELETE CASCADE,
  policy_type TEXT NOT NULL,
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 15. key_access_events
CREATE TABLE key_access_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id UUID NOT NULL REFERENCES encryption_keys(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 16. audit_events
CREATE TABLE audit_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_type TEXT NOT NULL,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  target_type TEXT,
  target_id UUID,
  event_hash TEXT NOT NULL,
  prev_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 17. security_scans
CREATE TABLE security_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  triggered_by UUID REFERENCES users(id) ON DELETE SET NULL,
  status scan_status NOT NULL DEFAULT 'RUNNING',
  passed_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- 18. security_findings
CREATE TABLE security_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID NOT NULL REFERENCES security_scans(id) ON DELETE CASCADE,
  severity severity_level NOT NULL,
  description TEXT NOT NULL,
  status finding_status NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 19. security_incidents
CREATE TABLE security_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  severity severity_level NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- 20. break_glass_requests
CREATE TABLE break_glass_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- 21. blockchain_transactions
CREATE TABLE blockchain_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tx_hash TEXT UNIQUE NOT NULL,
  chain_id chain_type NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===================== DEMO SEED DATA =====================
-- Insert roles
INSERT INTO roles (id, name, description) VALUES
  ('11111111-1111-1111-1111-111111111111', 'ADMIN', 'System Administrator'),
  ('22222222-2222-2222-2222-222222222222', 'MANAGER', 'Asset Manager'),
  ('33333333-3333-3333-3333-333333333333', 'ENGINEER', 'Field Engineer'),
  ('44444444-4444-4444-4444-444444444444', 'AUDITOR', 'Compliance Auditor'),
  ('55555555-5555-5555-5555-555555555555', 'SECURITY_ANALYST', 'Security Analyst');

-- Insert demo users
INSERT INTO users (id, display_name, email) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Aarav Mehta', 'aarav@demo.securemax.local'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Riya Sharma', 'riya@demo.securemax.local'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Arjun Verma', 'arjun@demo.securemax.local');

-- Map users to roles
INSERT INTO user_roles (user_id, role_id) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '33333333-3333-3333-3333-333333333333');

-- Insert wallets for auth
INSERT INTO wallets (user_id, address) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '0x1111111111111111111111111111111111111111'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '0x2222222222222222222222222222222222222222'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '0x3333333333333333333333333333333333333333');

-- Insert demo assets
INSERT INTO assets (id, asset_code, name, classification, owner_id) VALUES
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'BEL-RDR-001', 'Radar Signal Processing Spec', 'HIGH', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'BEL-EW-002', 'Electronic Warfare Test Proc', 'RESTRICTED', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
