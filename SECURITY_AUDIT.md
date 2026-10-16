# SecureMAX Security Audit & Vulnerability Assessment Report

**System Name:** SecureMAX (Zero-Trust Encrypted File-Sharing & Audit-Integrity Platform)  
**Assessment Scope:** Entire Repository (`contracts/`, `src/app/`, `src/lib/`, `test/`)  
**Core Architectural Principle:** *"Authorization ≠ Decryption"*  
**Audit Standard:** Defensive Application Security, Cryptographic Controls, Smart Contract Assurance, and Zero-Trust Verification  
**Status:** Audit Completed & Remediated  

---

## 1. Executive Summary

SecureMAX was audited to identify security vulnerabilities, architectural inconsistencies, mock bypasses, fail-open logic, and cryptographic weaknesses. The application's stated objective is to enforce the separation of identity, authorization, key management, and cryptographic decryption, such that having general permission or database access does not grant decryption capabilities.

During the source-code audit of all 28 API routes, Next.js server actions, cryptographic utilities, middleware, database interfaces, and 7 Solidity smart contracts, **16 distinct vulnerabilities and design weaknesses** were discovered. These include **3 Critical vulnerabilities**, **5 High severity vulnerabilities**, **5 Medium severity findings**, and **3 Low severity / hygiene issues**.

All 8 initial hypothesis vectors were investigated and verified directly against source code:
1. **Authorization succeeding based solely on local asset records**: **CONFIRMED** (`oracle.ts` bypassed on-chain verification if an asset was present in memory).
2. **Blockchain / oracle errors granting access (Fail-Open)**: **CONFIRMED** (`verifyChain2Policy` in `oracle.ts` returned `{ allowed: true }` upon any RPC timeout or contract failure).
3. **Zero-valued or hardcoded fallback master keys**: **CONFIRMED** (64-zero hex string fallback in `kms/index.ts` and `deviceStore.ts`, plus hardcoded JWT/HMAC fallbacks).
4. **Inconsistent JWT expiration and session enforcement**: **CONFIRMED** (Documentation specified 1-hour sessions, but implementation issued 8-hour sessions, and edge middleware lacked live revocation checks).
5. **Missing device / IP context in the decryption flow**: **CONFIRMED** (Token IP binding defaulted to `0.0.0.0` and was never validated against incoming request IP in `decrypt/route.ts`).
6. **Suppressed session / database errors**: **CONFIRMED** (`access-flow.ts` and `kms/index.ts` caught database and session failures and failed open or fell back silently).
7. **Uploads continuing after storage failures**: **CONFIRMED** (`upload/route.ts` registered the asset in memory and returned HTTP 200 even when binary storage upload failed).
8. **Decryption endpoints returning corrupted or excessively buffered file data**: **CONFIRMED** (`decrypt/route.ts` decoded binary streams with `TextDecoder`, corrupting non-UTF8 files and buffering entire files in memory).

Furthermore, eight additional vulnerabilities were identified, including **unauthenticated remote administrative actions** in `/api/sync/state` and exposed Next.js server actions in `adminUsers.ts`.

---

## 2. Scope & Target Environment

| Component | Target Description | Verified Reality |
|---|---|---|
| **Framework** | Next.js 14.2.5 (App Router, Server Actions, Middleware) | Verified (`src/app/`, `src/middleware.ts`) |
| **Language / Runtime** | TypeScript 5.5, Node.js 20+ | Verified (`tsconfig.json`, `package.json`) |
| **Smart Contracts** | Solidity 0.8.24, OpenZeppelin v5, Hardhat 2.22.6 | 7 contracts (`chain1/*.sol`, `chain2/*.sol`) |
| **Database** | PostgreSQL via Supabase / Local hybrid fallback | Supabase JS v2 client with in-memory `deviceStore` fallback |
| **Cryptographic Engine** | AES-256-GCM, HKDF / PBKDF2 KEK derivation, ECDSA P-256 | Implemented in `src/lib/crypto/` and `src/lib/kms/` |
| **Package Manager** | npm | Verified |

---

## 3. Findings Summary Matrix

| ID | Title | Component | Severity | Status |
|---|---|---|---|---|
| **SEC-01** | Fail-Open Blockchain Oracle Fallback on Error | `src/lib/blockchain/oracle.ts` | **CRITICAL** | Remediated |
| **SEC-02** | Unauthenticated Remote Admin State Mutation | `src/app/api/sync/state/route.ts` | **CRITICAL** | Remediated |
| **SEC-03** | Unauthenticated User & Role Creation via Server Action | `src/app/actions/adminUsers.ts` | **CRITICAL** | Remediated |
| **SEC-04** | Hardcoded Zero-Valued KMS Master Key & Insecure Fallbacks | `src/lib/kms/index.ts`, `deviceStore.ts` | **HIGH** | Remediated |
| **SEC-05** | Chain-1 Oracle Authorization Bypassed by Local Record | `src/lib/blockchain/oracle.ts` | **HIGH** | Remediated |
| **SEC-06** | Mock Test Bypasses Present in Production Access Flow | `src/lib/api/access-flow.ts` | **HIGH** | Remediated |
| **SEC-07** | Insecure Admin Panic Lockout via Target IDOR | `src/app/api/admin/panic/route.ts` | **HIGH** | Remediated |
| **SEC-08** | Broken Object Level Authorization (BOLA) on Device Actions | `src/app/api/devices/route.ts` | **HIGH** | Remediated |
| **SEC-09** | Asset Registration Continuing After Object Storage Failures | `src/app/api/assets/upload/route.ts` | **MEDIUM** | Remediated |
| **SEC-10** | Binary Stream Corruption & Memory Buffering in Decryption | `src/app/api/assets/decrypt/route.ts` | **MEDIUM** | Remediated |
| **SEC-11** | Missing IP Context & Hollow Token Binding in Decryption Flow | `src/lib/api/access-flow.ts`, `decrypt/route.ts` | **MEDIUM** | Remediated |
| **SEC-12** | Suppressed Database Errors & Fail-Open Session Verification | `src/lib/api/access-flow.ts`, `kms/index.ts` | **MEDIUM** | Remediated |
| **SEC-13** | Dashboard Metrics Action Leaks Sensitive Data on Error | `src/app/actions/dashboard.ts` | **MEDIUM** | Remediated |
| **SEC-14** | Nonexistent Contract Method Called During Audit Verification | `src/app/api/audit/verify/route.ts` | **LOW** | Remediated |
| **SEC-15** | Hardcoded Third-Party RPC API Keys | `oracle.ts`, `client.ts`, `config.ts`, `verify/route.ts` | **LOW** | Remediated |
| **SEC-16** | Orphaned Backup Files Committed to Version Control | `src/app/api/devices/enrollment/complete/route.ts.bak` | **LOW** | Remediated |

---

## 4. Detailed Vulnerability Analyses

### SEC-01: Fail-Open Blockchain Oracle Fallback on Error (CRITICAL)
- **Affected File:** `src/lib/blockchain/oracle.ts` (lines 88–93)
- **Vulnerability Description:** When `verifyChain2Policy(assetId, sessionId)` encounters an RPC timeout, unreachable node, contract revert, or invalid address, the `catch` block returns `{ allowed: true, status: 'AUTHORIZED' }`.
- **Realistic Impact:** Total bypass of the Chain-2 Key Management Policy. If an attacker revokes a key on-chain, or if the blockchain network suffers an outage or RPC rate-limiting, the system fails open and authorizes decryption of protected assets.
- **Evidence from Source:**
  ```typescript
  } catch (error: any) {
    console.warn('Chain 2 Oracle fallback:', error.message);
    return { allowed: true, status: 'AUTHORIZED', chainId: targetChain.id, contractAddress }; 
  }
  ```
- **Remediation:** Enforce strict fail-closed semantics. Any blockchain or oracle query failure must return `{ allowed: false, status: 'UNAVAILABLE' | 'ERROR', reason: error.message }` and abort the authorization flow with HTTP 503.

---

### SEC-02: Unauthenticated Remote Admin State Mutation (CRITICAL)
- **Affected File:** `src/app/api/sync/state/route.ts` (lines 66–110)
- **Vulnerability Description:** The `POST /api/sync/state` route accepts state mutation commands (`APPROVE`, `REJECT`, `REVOKE`, `EXTEND`) and directly executes them using hardcoded administrator identities (`usr_admin_001`, `Administrator`) without verifying the caller's session cookie or administrative role.
- **Realistic Impact:** Any unauthenticated anonymous user on the network can approve pending access requests, mint NFT permits, revoke live grants, or extend permissions across any asset in the system.
- **Evidence from Source:**
  ```typescript
  export async function POST(req: Request) {
    const body = await req.json().catch(() => ({}));
    const { action, requestId, grantId, ttlMinutes, reason } = body;
    if (action === 'APPROVE' && requestId) {
      deviceStore.approveAccessRequest(requestId, 'usr_admin_001', ttlMinutes || 30);
    ...
  ```
- **Remediation:** Remove administrative bypass actions from public/sync routes. Enforce `getVerifiedSession()` and verify `session.role === UserRole.ADMIN` before performing any state modification.

---

### SEC-03: Unauthenticated User & Role Creation via Server Action (CRITICAL)
- **Affected File:** `src/app/actions/adminUsers.ts` (lines 56–167)
- **Vulnerability Description:** The Next.js Server Action `registerNewUserByAdmin` allows creating new users with pre-verified KYC status (`kyc_status: 'VERIFIED'`) and elevated roles (`MANAGER`, `AUDITOR`). It performs no session verification or role validation. Similarly, `getRegisteredPersonnel` allows anonymous callers to enumerate all system users.
- **Realistic Impact:** Privilege escalation and unauthorized user enrollment. An attacker can invoke `registerNewUserByAdmin` over HTTP and create an active Auditor or Manager account, generating valid device enrollment codes.
- **Remediation:** Call `getVerifiedSession()` at the beginning of each server action. Verify that `session.role === UserRole.ADMIN`. If unverified or non-admin, throw a `Forbidden` error.

---

### SEC-04: Hardcoded Zero-Valued KMS Master Key & Insecure Fallbacks (HIGH)
- **Affected Files:** `src/lib/kms/index.ts` (lines 6–10, 101–110), `src/lib/auth/deviceStore.ts` (lines 1173, 4133)
- **Vulnerability Description:** When `SECUREMAX_KMS_MASTER_KEY` is not provided in environment variables, the system defaults to 64 hex zeros (`'0000000000000000000000000000000000000000000000000000000000000000'`). In `fetchAndDecryptDEK`, if the primary master key fails, it explicitly attempts fallback decryption with the zero key.
- **Realistic Impact:** Cryptographic compromise. In deployments where environment variables are missing or misconfigured, all Data Encryption Keys (DEKs) are wrapped using a publicly known static key of all zeros, allowing anyone with ciphertext to decrypt confidential assets.
- **Remediation:** In production and runtime environments, fail fast if `SECUREMAX_KMS_MASTER_KEY` is missing, shorter than 64 hex characters, or equal to all zeros. Remove the zero-key fallback from `fetchAndDecryptDEK`.

---

### SEC-05: Chain-1 Oracle Authorization Bypassed by Local Record (HIGH)
- **Affected File:** `src/lib/blockchain/oracle.ts` (lines 27–35)
- **Vulnerability Description:** `verifyChain1Access(userId, assetId)` checks `if (deviceStore.assets.has(assetId))` and immediately returns `{ allowed: true, status: 'AUTHORIZED' }`.
- **Realistic Impact:** Completely invalidates the dual-chain security boundary. The on-chain `AssetRegistry` is never consulted if the asset exists locally. Furthermore, it does not check if `userId` is authorized on-chain—it authorizes access for ANY user simply because the asset exists.
- **Remediation:** Remove the local store check from `verifyChain1Access`. The oracle must verify the user's DID and assignment against `AssetRegistry` or return `DENIED`.

---

### SEC-06: Mock Test Bypasses Present in Production Access Flow (HIGH)
- **Affected File:** `src/lib/api/access-flow.ts` (lines 49–53, 88–92)
- **Vulnerability Description:** `authorizeAssetAccess` contains substring matching checks:
  ```typescript
  (userId?.includes('test') || userId?.includes('user-123') || userId === 'usr_admin_001' || userId?.startsWith('admin'))
  ```
  If matched, it synthesizes an active user record and creates an automatic assignment with `can_read: true, can_decrypt: true`.
- **Realistic Impact:** Authentication and authorization bypass. An attacker supplying a userId such as `"admin_hacker"` or `"user-123"` automatically receives full decrypt permissions without having an assignment in the database.
- **Remediation:** Remove all mock username and substring bypasses from production access flow logic. Test fixtures must set up explicit database state or use mock injection during unit tests.

---

### SEC-07: Insecure Admin Panic Lockout via Target IDOR (HIGH)
- **Affected File:** `src/app/api/admin/panic/route.ts` (lines 22–50)
- **Vulnerability Description:** The panic lockout endpoint attempts to verify the caller with `targetAdmin = await deviceStore.getUserByEmailOrId(adminId)` where `adminId = body.adminId`. If `targetAdmin.role === UserRole.ADMIN`, it executes `lockAdministrator`.
- **Realistic Impact:** Denial of Service against root administrator. An authenticated non-admin user (e.g. standard team member) can submit `{ adminId: "usr_admin_001" }`, causing the endpoint to verify that `targetAdmin` is indeed an admin, and lock the administrator out of the entire platform.
- **Remediation:** Verify that `session.role === UserRole.ADMIN` and that `session.userId === targetAdmin.id`. Non-admin sessions must receive HTTP 403.

---

### SEC-08: Broken Object Level Authorization (BOLA) on Device Actions (HIGH)
- **Affected File:** `src/app/api/devices/route.ts` (lines 249–290)
- **Vulnerability Description:** Device actions `suspend`, `reactivate`, `update_risk`, and `force_reauth` accept `deviceId` from the request body and execute changes on `deviceStore` without verifying that the caller owns the device or is an Administrator.
- **Realistic Impact:** Any authenticated user can suspend, alter risk states, or force re-authentication on any other user's hardware device, including administrator terminals.
- **Remediation:** Validate that the target device belongs to `session.userId` or that `session.role === UserRole.ADMIN`. Sensitive actions (`update_risk`, `suspend`) should be restricted to administrators.

---

### SEC-09: Asset Registration Continuing After Object Storage Failures (MEDIUM)
- **Affected File:** `src/app/api/assets/upload/route.ts` (lines 85–97)
- **Vulnerability Description:** The upload handler inserts the asset record into `deviceStore` before uploading the ciphertext to Supabase Storage. If storage upload fails with an error or throws an exception, it logs a warning and proceeds to return HTTP 200 `{ success: true }`.
- **Realistic Impact:** Data loss and phantom assets. The system records assets as encrypted and active, but their ciphertext does not exist in storage. When users attempt to decrypt the asset later, the endpoint fails with HTTP 500.
- **Remediation:** If Supabase Storage upload fails, delete/rollback the asset record from the store and return HTTP 502/500 with a clear storage error.

---

### SEC-10: Binary Stream Corruption & Memory Buffering in Decryption (MEDIUM)
- **Affected File:** `src/app/api/assets/decrypt/route.ts` (lines 115–136)
- **Vulnerability Description:** The decryption endpoint streams decrypted bytes through a `TextDecoder` to create a JavaScript string:
  ```typescript
  const reader = finalWebStream.getReader();
  let result = '';
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result += decoder.decode(value, { stream: true });
  }
  ```
- **Realistic Impact:**
  1. **Binary Corruption:** Any non-text file (PDF, XLSX, ZIP, PNG) contains byte sequences that are invalid UTF-8. `TextDecoder` replaces them with `\uFFFD`, irreversibly corrupting the file when downloaded.
  2. **Memory Exhaustion (DoS):** d-buffering multi-megabyte streams in a single contiguous string risks Vercel serverless OOM crashes.
- **Remediation:** Preserve binary fidelity. If returning JSON for the UI modal, encode binary output as Base64. For file downloads, stream the decrypted response directly with appropriate `Content-Type` and `Content-Disposition` headers.

---

### SEC-11: Missing IP Context & Hollow Token Binding in Decryption Flow (MEDIUM)
- **Affected Files:** `src/app/api/assets/decrypt/route.ts` (lines 56–81), `src/lib/api/access-flow.ts` (lines 147–152, 225)
- **Vulnerability Description:** While `issueTemporaryDecryptionToken` and `validateTemporaryDecryptionToken` support IP binding hashes, `authorizeAssetAccess` never supplied `clientIp`, defaulting it to `'0.0.0.0'`. Similarly, `decrypt/route.ts` never passed client IP context.
- **Realistic Impact:** Temporary decryption tokens are not bound to the client's network context, enabling tokens stolen from one IP to be replayed from a different location within the token's lifetime.
- **Remediation:** Extract `x-forwarded-for` or request client IP in `decrypt/route.ts` and pass it through `authorizeAssetAccess` and `prepareDecryptionStream` to enforce cryptographic IP binding.

---

### SEC-12: Suppressed Database Errors & Fail-Open Session Verification (MEDIUM)
- **Affected Files:** `src/lib/api/access-flow.ts` (lines 178–190, 228–240), `src/lib/kms/index.ts` (lines 88–90)
- **Vulnerability Description:** Database queries verifying session revocation catch all errors and only rethrow if `err.message === 'Session Revoked'`. Any other database connection timeout or query failure is suppressed, allowing decryption to proceed.
- **Realistic Impact:** If the session database is unavailable or degraded, revoked sessions may continue to successfully decrypt assets because the failure is swallowed.
- **Remediation:** Fail closed: if the session state cannot be verified against the database or cache, abort decryption and reject the request.

---

### SEC-13: Dashboard Metrics Action Leaks Sensitive Data on Error (MEDIUM)
- **Affected File:** `src/app/actions/dashboard.ts` (lines 79–109)
- **Vulnerability Description:** When `getVerifiedSession()` throws an unauthorized or forbidden error, the outer `catch` block catches the exception and returns `{ success: true, data: { totalUsers, activeAssets, recentAudits } }`.
- **Realistic Impact:** Information disclosure. Unauthorized users and anonymous visitors can access sensitive operational metrics and audit summaries intended only for administrators.
- **Remediation:** In the catch block of `getDashboardMetrics`, return `{ success: false, error: 'Unauthorized' }`.

---

### SEC-14: Nonexistent Contract Method Called During Audit Verification (LOW)
- **Affected File:** `src/app/api/audit/verify/route.ts` (line 74)
- **Vulnerability Description:** The route attempts to read `functionName: 'getLatestRoot'` from `AuditAnchor`. However, `AuditAnchor.sol` defines `getLatestAnchor()`, returning an `Anchor` struct.
- **Realistic Impact:** The on-chain audit verification call always fails with contract errors, leaving on-chain audit anchor comparison non-functional.
- **Remediation:** Update `audit/verify/route.ts` to call `getLatestAnchor()` and extract `merkleRoot` from the returned struct.

---

### SEC-15: Hardcoded Third-Party RPC API Keys (LOW)
- **Affected Files:** `src/lib/blockchain/oracle.ts`, `src/lib/blockchain/chain1/client.ts`, `src/lib/web3/config.ts`, `src/app/api/audit/verify/route.ts`
- **Vulnerability Description:** A live Alchemy API key (`alch_0qnxXuC1AluDumPOynCns`) is hardcoded as a fallback RPC URL in 4 source files.
- **Realistic Impact:** Credential leakage, API quota exhaustion, and unauthorized traffic routed through the developer's Alchemy project.
- **Remediation:** Remove hardcoded keys. Default to local RPC (`http://127.0.0.1:8545`) or require `NEXT_PUBLIC_CHAIN_RPC_URL` from environment configuration.

---

### SEC-16: Orphaned Backup Files Committed to Version Control (LOW)
- **Affected File:** `src/app/api/devices/enrollment/complete/route.ts.bak`
- **Vulnerability Description:** An outdated copy of the enrollment completion route was committed to the git repository.
- **Realistic Impact:** Code clutter, potential deployment of unmaintained code by build systems scanning subdirectories.
- **Remediation:** Remove `route.ts.bak` from git and ensure `.gitignore` excludes `*.bak` files.

---

## 5. Asset Lifecycle Trace & Verification

```
[ Upload ] ──────────> [ Encrypt ] ──────────> [ KMS Key Wrap ] ──────────> [ Storage ]
   (AES-256-GCM)       (Unique DEK per asset)   (KEK derived from Root)     (Supabase / Local)
                                                                                  │
                                                                                  ▼
[ Audit Anchor ] <──── [ Decrypt Stream ] <──── [ Temp Token ] <──── [ Multi-Domain Auth ]
  (Merkle Root)        (Zero-fill DEK)          (30-min bound)        (Chain1 + Chain2 + DB)
```

1. **Upload:** User provides file and metadata (`POST /api/assets/upload`).
2. **Key Generation & Encryption:** A fresh 256-bit DEK is generated via `crypto.randomBytes(32)`. Ciphertext is produced with 12-byte random IV and 16-byte GCM authentication tag. Additional Authenticated Data (AAD) is bound to `asset_data:<assetId>`.
3. **Key Wrapping:** The DEK is encrypted with a KEK derived from the KMS Master Key via PBKDF2/HKDF with asset ID salt.
4. **Storage:** Encrypted payload is uploaded to Supabase Storage bucket `securemax-vault`. (Now rolls back on failure).
5. **Access Request & Assignment:** Admin or owner grants assignment with discrete permission bits (`can_read`, `can_decrypt`, `can_download`, `can_edit`, `can_delete`).
6. **Decryption Authorization:** 
   - Step 1: Session validity and live user status (non-suspended).
   - Step 2: Device trust level (active hardware credential).
   - Step 3: Assignment active with `can_decrypt: true`.
   - Step 4: Chain-1 Identity & Asset Registry verification (fail-closed).
   - Step 5: Chain-2 Key Lifecycle & Policy verification (fail-closed).
   - Step 6: Temporary 30-minute token issued, cryptographically bound to session ID and client IP.
7. **Streaming Decryption:** The server fetches ciphertext, KMS unwraps DEK within memory boundary, streams AES-256-GCM decryption, zeroizes DEK memory buffer (`dekPlaintext.fill(0)`), and transmits binary or Base64 data.
8. **Revocation & Audit:** Immediate revocation invalidates assignments and live grants. All authorization, denial, and rotation events are logged to the cryptographic hash chain and anchored to `AuditAnchor`.

---

## 6. Honest Limitations & Architecture Notes

- **Software KMS vs HSM:** The current implementation uses a software-based Node.js KMS. In enterprise production, root key operations should be delegated to a FIPS 140-2 Level 3 Hardware Security Module (AWS KMS, Azure Key Vault, or HashiCorp Vault Transit).
- **Single-Node Testnet:** In the local development environment, Hardhat simulates both Chain-1 and Chain-2. In production, physically separated Layer-1 or application-specific rollups are recommended to prevent shared consensus failure modes.
- **Client WebAuthn Emulation:** In automated test environments, WebAuthn / P-256 signatures are evaluated using WebCrypto and Node.js crypto libraries. Hardware security keys (YubiKey, Apple Secure Enclave) should be used in physical production deployments.
