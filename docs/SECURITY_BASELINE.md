# SecureMAX Security Baseline & State Assessment

> **Classification**: CONFIDENTIAL / DEFENSE PLATFORM AUDIT  
> **Date**: October 2026  
> **Repository**: `SECURE_MAX` (SIH26125)  
> **Audit Status**: Baseline Verified Pre-Hardening  

---

## 1. Executive Baseline Summary

SecureMAX is a decentralized zero-trust identity and cryptographic digital asset access platform designed for Bharat Electronics Limited (BEL). Its primary architectural thesis is:

$$\text{Authorization} \neq \text{Decryption}$$

Decentralized smart contracts on Chain-1 govern identity, asset registry, and role-based access control (RBAC), while Chain-2 and an isolated Key Management System (KMS) govern key policy and decryption authorization.

This baseline captures the verified state of the repository, dependencies, security-critical pathways, discovered vulnerabilities, and baseline test suite outcomes prior to executing the Phase 2–15 hardening phases.

---

## 2. Package Manifests & Dependencies

The repository is built on Next.js 14 (App Router) with TypeScript, ethers.js v6, Hardhat, Supabase JS client, and JOSE for cryptographic tokens:

- **Framework**: `next@14.2.5`, `react@18.3.1`, `react-dom@18.3.1`
- **Cryptography & Security**:
  - Node.js native `crypto` (AES-256-GCM, PBKDF2, P-256 ECDSA)
  - `jose@5.6.3` (JWT issuance, verification, claims parsing)
  - `@openzeppelin/contracts@5.0.2` (Smart contract access control & reentrancy guards)
- **Blockchain**:
  - `ethers@6.13.1`, `hardhat@2.22.6`, `viem@2.56.3`, `wagmi@3.7.7`
  - `@metamask/connect-evm@2.1.1`, `@coinbase/wallet-sdk@4.3.7`
- **Database & Realtime**:
  - `@supabase/supabase-js@2.45.0`, `@supabase/ssr@0.4.0`
- **Testing & Quality Assurance**:
  - `vitest@2.0.3` (Unit, security, and integration testing)
  - `@playwright/test@1.63.0` (Browser end-to-end testing)
  - `@nomicfoundation/hardhat-toolbox@5.0.0` (EVM smart contract testing)
  - `eslint@8.57.0`, `eslint-config-next@14.2.5`

---

## 3. Application Entry Points & Security Boundaries

### 3.1 Public & Authentication Entry Points
1. `/` (`src/app/(public)/page.tsx`): Hero landing page; redirects authenticated users to role-tailored dashboards.
2. `/login` (`src/app/(public)/login/page.tsx`): Dual-authentication gateway (MetaMask ECDSA wallet signature for Admins, P-256 WebAuthn passkey for normal users).
3. `/register-device` (`src/app/(public)/register-device/page.tsx`): Hardware device passport enrollment using single-use security enrollment codes.
4. `/api/auth/login` (`src/app/api/auth/login/route.ts`): Signature challenge verification and JWT session cookie (`securemesh_session`) issuance.
5. `/api/auth/challenge` (`src/app/api/auth/challenge/route.ts`): Nonce challenge generation for wallet / passkey authentication.

### 3.2 Access, Asset & Decryption Endpoints
1. `/api/access/requests` (`src/app/api/access/requests/route.ts`): Access request submission, approval, and rejection workflow.
2. `/api/assets/decrypt` (`src/app/api/assets/decrypt/route.ts`): Primary decryption streaming gateway; consumes temporary authorization tokens and returns decrypted payload.
3. `/api/assets/upload` (`src/app/api/assets/upload/route.ts`): AES-256-GCM asset encryption, DEK wrapping, and Supabase storage upload.
4. `/api/assets/list` (`src/app/api/assets/list/route.ts`): Metadata listing of classified assets based on user permissions.
5. `/api/assets/share` (`src/app/api/assets/share/route.ts`): Peer-to-peer / manager asset clearance assignment.

### 3.3 Administrative & Emergency Operations
1. `/api/admin/panic` (`src/app/api/admin/panic/route.ts`): Emergency panic lockout; revokes active sessions and freezes access.
2. `/api/admin/recovery` (`src/app/api/admin/recovery/route.ts`): Disaster recovery and node restoration.
3. `/api/admin/bootstrap` (`src/app/api/admin/bootstrap/route.ts`): Initial administrative user and system seeding.
4. `/api/admin/security-status` (`src/app/api/admin/security-status/route.ts`): Telemetry, node health, and policy status.

### 3.4 Adversarial Security & Verification Engines
1. `src/lib/sentinel/engine.ts`: Sentinel automated attack runner with 9 deterministic security checks.
2. `src/lib/breachlab/orchestrator.ts`: BreachLab adversarial attack orchestrator executing 10 attack vectors against synthetic fixtures.
3. `src/lib/audit/merkle.ts` & `src/lib/audit/logger.ts`: SHA-256 hash-chaining and Merkle tree generation for tamper-evident audit logging.

---

## 4. Smart Contracts & Authorization Modifiers

The contracts reside in `contracts/chain1` and `contracts/chain2`:

| Contract | Domain | Key Functions | Modifiers & Access Controls | Emitted Events |
| :--- | :--- | :--- | :--- | :--- |
| `AssetRegistry.sol` | Chain-1 | `registerAsset`, `assignAsset`, `revokeAssignment`, `transferAssetOwnership` | `onlyOwner`, `nonReentrant` | `AssetRegistered`, `AssetAssigned`, `AssignmentRevoked`, `AssetOwnershipTransferred` |
| `IdentityRegistry.sol`| Chain-1 | `registerIdentity`, `updateStatus`, `updateRole` | `onlyOwner`, `whenNotPaused`, `nonReentrant` | `IdentityRegistered`, `IdentityStatusChanged`, `RoleUpdated` |
| `RBACManager.sol` | Chain-1 | `assignRole`, `revokeRole`, `hasPermission` | `onlyOwner`, `nonReentrant` | `RoleAssigned`, `RoleRevoked` |
| `AuditAnchor.sol` | Chain-1 | `anchorMerkleRoot`, `getAnchor`, `getLatestAnchor` | `onlyOwner`, `nonReentrant` | `MerkleRootAnchored` |
| `DecryptionAuth.sol` | Chain-2 | `recordAuthorization`, `recordCompletion`, `recordDenial`, `isAuthorizationValid` | `onlyOwner`, `nonReentrant` | `DecryptionAuthorized`, `DecryptionCompleted`, `DecryptionDenied` |
| `KeyLifecycle.sol` | Chain-2 | `registerKey`, `rotateKey`, `revokeKey`, `isKeyActive` | `onlyOwner`, `nonReentrant` | `KeyRegistered`, `KeyRotated`, `KeyRevoked` |
| `KeyPolicyManager.sol`| Chain-2 | `createPolicy`, `updatePolicy`, `deactivatePolicy`, `isPolicyActive` | `onlyOwner`, `nonReentrant` | `PolicyCreated`, `PolicyUpdated`, `PolicyDeactivated` |

---

## 5. Supabase Schemas, RLS Policies & Service-Role Usage

### 5.1 Database Schema
The database contains 21 core tables defined in `supabase/migrations/20260903120000_expanded_schema.sql` and extended by `20260920000001_securemax_additive_evolution.sql`:
- **Core Entities**: `users`, `roles`, `user_roles`, `dids`, `wallets`, `devices`
- **Asset Management**: `assets`, `asset_assignments`, `asset_permissions`, `asset_events`
- **Access & Sessions**: `access_requests`, `access_sessions`, `auth_challenges`, `enrollment_codes`, `kyc_records`
- **Cryptographic Keys**: `encryption_keys`, `key_versions`, `key_policies`, `key_access_events`
- **Audit & Security**: `audit_events`, `security_scans`, `security_findings`, `security_incidents`, `break_glass_requests`, `blockchain_transactions`, `identity_sync`

### 5.2 RLS & Service Role Analysis
- In `20260903120000_expanded_schema.sql`, RLS was **not enabled** on the initial 21 tables.
- In `20260920000001_securemax_additive_evolution.sql`, RLS was enabled on 6 additive tables (`user_credentials`, `auth_challenges`, `enrollment_codes`, `kyc_records`, `asset_events`, `identity_sync`), but **no explicit RLS policies (`CREATE POLICY`) were declared**, denying non-privileged clients access.
- In `src/lib/db/client.ts`, `supabaseAdmin` bypasses RLS using `SUPABASE_SERVICE_ROLE_KEY`. If the key is absent, it falls back to `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

---

## 6. Security Deficiencies & Vulnerabilities Identified

During the discovery inspection, the following critical deficiencies were cataloged:

1. **Insecure Default Master Key & Fallback** (`src/lib/kms/index.ts` lines 7, 191):
   - Defaults to `'0000000000000000000000000000000000000000000000000000000000000000'`.
   - On primary decryption failure, silently retries with the all-zero master key!
2. **Hardcoded JWT Secret Fallback** (`src/lib/kms/index.ts` line 10, `src/lib/auth/session.ts` line 24):
   - Uses `'securemax-dev-jwt-secret-minimum-32-chars-long-secure-padding'` when `process.env.JWT_SECRET` is unset.
3. **Hardcoded Third-Party API Key Exposed in Client Code** (`src/lib/blockchain/chain1/client.ts` line 4, `src/lib/blockchain/oracle.ts` line 17):
   - Contains fallback to a live Alchemy API key (`https://eth-sepolia.g.alchemy.com/v2/alch_0qnxXuC1AluDumPOynCns`).
4. **Predictable Admin Identifier & Role Inferences** (`src/lib/api/access-flow.ts` line 50, 58, `src/app/api/assets/decrypt/route.ts` line 39):
   - `userId === 'usr_admin_001' || userId?.startsWith('admin')` automatically grants `ADMIN` role.
5. **Implicit Synthetic User & Assignment Grants** (`src/lib/api/access-flow.ts` lines 50, 89):
   - Any user containing `'test'` or `'user-123'` receives automatic active user status and decrypt permissions.
6. **Missing Atomic Token Redemption / Replay Window** (`src/lib/kms/index.ts`, `src/lib/api/access-flow.ts`):
   - Decryption tokens have a 30-minute validity window without server-side one-time redemption enforcement, allowing replay within TTL.
7. **Missing Smart Contract Tests**:
   - `contracts/chain1/RBACManager.sol`, `AuditAnchor.sol` and all Chain-2 contracts (`DecryptionAuth.sol`, `KeyLifecycle.sol`, `KeyPolicyManager.sol`) had no automated test coverage in `test/contracts/`.
8. **Discrepancy in Sentinel Scenario Coverage**:
   - Sentinel engine ran only 9 ad-hoc checks; BreachLab had 10 scenarios. Phase 6 mandates a structured S-01 through S-30 scenario catalog.

---

## 7. Baseline Test Execution Results

Prior to architectural modification, all available test suites were executed to establish a reproducible baseline:

- **Vitest Unit & Security Suite** (`npm test`):
  - 16 test files passed (16 / 16)
  - 150 individual test cases passed (150 / 150)
  - Total Duration: 2.23s
- **Hardhat Smart Contract Suite** (`npm run contracts:test`):
  - 2 test suites passed (`AssetRegistry`, `IdentityRegistry`)
  - 8 individual test cases passed (8 / 8)
  - Total Duration: 371ms
- **Lint Check** (`npm run lint`):
  - Clean: 0 warnings, 0 errors.

*No source code has been modified merely to make baseline tests pass.*
