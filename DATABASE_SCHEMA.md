# SecureMax Database Schema

## Database Overview
SecureMax utilizes **Supabase PostgreSQL** as its primary relational database. This schema has been expanded to strictly follow the 21 required entities for the SIH26125 prototype.

## PostgreSQL ENUM Types
- `user_status`: ACTIVE, SUSPENDED, REVOKED
- `classification_level`: PUBLIC, INTERNAL, CONFIDENTIAL, RESTRICTED, HIGH
- `asset_status`: ACTIVE, ARCHIVED, REVOKED, TRANSFERRING
- `assignment_status`: ACTIVE, REVOKED, EXPIRED
- `access_status`: PENDING, AUTHORIZED, DENIED, EXPIRED, REVOKED
- `key_status`: ACTIVE, ROTATING, ROTATED, REVOKED, DESTROYED
- `severity_level`: LOW, MEDIUM, HIGH, CRITICAL
- `finding_status`: OPEN, INVESTIGATING, REMEDIATED, VERIFIED, CLOSED
- `scan_status`: RUNNING, COMPLETED, FAILED
- `chain_type`: CHAIN_1, CHAIN_2

## Detailed Table Schemas

### 1. users
- `id` (uuid) - PK
- `display_name` (text) - not null
- `email` (text) - unique
- `status` (user_status) - not null, default 'ACTIVE'
- `is_sandbox` (boolean) - default false
- `created_at`, `updated_at` (timestamptz)

### 2. roles
- `id` (uuid) - PK
- `name` (text) - unique, not null (ADMIN, MANAGER, ENGINEER, AUDITOR, SECURITY_ANALYST)
- `description` (text)

### 3. user_roles
- `user_id` (uuid) - FK to users
- `role_id` (uuid) - FK to roles
- PK is (user_id, role_id)

### 4. dids
- `id` (uuid) - PK
- `user_id` (uuid) - FK to users
- `did_string` (text) - unique (e.g., 'did:securemax:0x...')
- `status` (user_status)
- `registered_at` (timestamptz)

### 5. wallets
- `id` (uuid) - PK
- `user_id` (uuid) - FK to users
- `address` (text) - unique
- `status` (user_status)
- `verified_at` (timestamptz)

### 6. devices
- `id` (uuid) - PK
- `user_id` (uuid) - FK to users
- `device_fingerprint` (text) - unique
- `status` (user_status)
- `last_seen_at` (timestamptz)

### 7. assets
- `id` (uuid) - PK
- `asset_code` (text) - unique
- `name` (text)
- `description` (text)
- `classification` (classification_level)
- `owner_id` (uuid) - FK to users
- `storage_path` (text)
- `status` (asset_status)
- `created_at`, `updated_at` (timestamptz)

### 8. asset_assignments
- `id` (uuid) - PK
- `asset_id` (uuid) - FK to assets
- `user_id` (uuid) - FK to users
- `assigned_by_id` (uuid) - FK to users
- `status` (assignment_status)
- `created_at`, `revoked_at` (timestamptz)

### 9. asset_permissions
- `id` (uuid) - PK
- `assignment_id` (uuid) - FK to asset_assignments
- `can_read` (boolean)
- `can_decrypt` (boolean)
- `can_transfer` (boolean)

### 10. access_requests
- `id` (uuid) - PK
- `user_id` (uuid) - FK to users
- `asset_id` (uuid) - FK to assets
- `purpose` (text)
- `status` (access_status)
- `created_at`, `resolved_at` (timestamptz)

### 11. access_sessions
- `id` (uuid) - PK
- `user_id` (uuid) - FK to users
- `token_hash` (text) - unique
- `ip_address` (text)
- `expires_at` (timestamptz)
- `created_at` (timestamptz)

### 12. encryption_keys
- `id` (uuid) - PK
- `asset_id` (uuid) - FK to assets
- `algorithm` (text) - default 'aes-256-gcm'
- `created_at` (timestamptz)

### 13. key_versions
- `id` (uuid) - PK
- `key_id` (uuid) - FK to encryption_keys
- `version_number` (integer)
- `encrypted_dek` (text)
- `dek_iv` (text)
- `status` (key_status)
- `created_at` (timestamptz)

### 14. key_policies
- `id` (uuid) - PK
- `key_id` (uuid) - FK to encryption_keys
- `policy_type` (text)
- `conditions` (jsonb)
- `created_at` (timestamptz)

### 15. key_access_events
- `id` (uuid) - PK
- `key_id` (uuid) - FK to encryption_keys
- `user_id` (uuid) - FK to users
- `action` (text) - e.g., 'DECRYPT', 'ROTATE'
- `timestamp` (timestamptz)

### 16. audit_events
- `id` (bigint) - PK, generated always as identity
- `event_type` (text)
- `actor_id` (uuid) - FK to users
- `target_type` (text)
- `target_id` (uuid)
- `event_hash` (text) - not null
- `prev_hash` (text) - not null
- `created_at` (timestamptz)

### 17. security_scans
- `id` (uuid) - PK
- `triggered_by` (uuid) - FK to users
- `status` (scan_status)
- `passed_count` (integer)
- `failed_count` (integer)
- `started_at`, `completed_at` (timestamptz)

### 18. security_findings
- `id` (uuid) - PK
- `scan_id` (uuid) - FK to security_scans
- `severity` (severity_level)
- `description` (text)
- `status` (finding_status)
- `created_at` (timestamptz)

### 19. security_incidents
- `id` (uuid) - PK
- `title` (text)
- `severity` (severity_level)
- `status` (text)
- `created_at`, `resolved_at` (timestamptz)

### 20. break_glass_requests
- `id` (uuid) - PK
- `user_id` (uuid) - FK to users
- `reason` (text)
- `status` (text) - 'PENDING', 'APPROVED', 'DENIED'
- `approved_by` (uuid) - FK to users
- `created_at`, `resolved_at` (timestamptz)

### 21. blockchain_transactions
- `id` (uuid) - PK
- `tx_hash` (text) - unique
- `chain_id` (chain_type)
- `entity_type` (text) - e.g., 'ASSET_ASSIGNMENT', 'KEY_POLICY'
- `entity_id` (uuid)
- `status` (text) - 'PENDING', 'CONFIRMED', 'FAILED'
- `created_at` (timestamptz)
