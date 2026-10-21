# SecureMAX Threat Model & Risk Analysis

> **Standard**: STRIDE / MITRE ATT&CK Defense Matrix  
> **Date**: October 2026  
> **Scope**: SecureMAX Enterprise Zero-Trust & Cryptographic Access Architecture  

---

## 1. System Assets & Trust Boundaries

### 1.1 Protected Assets
1. **Classified Document Payloads (Plaintext)**: Defense radar, electronic warfare, and avionics specifications.
2. **Cryptographic Key Material**:
   - Master Key (KEK derivation root).
   - Key Encryption Keys (KEKs derived per asset context).
   - Data Encryption Keys (DEKs unique per asset version).
3. **Identity & Authorization Evidence**:
   - User DIDs, private keys, and WebAuthn credentials.
   - JWT session tokens and temporary decryption authorization tokens.
   - Smart contract state (assignments, roles, key lifecycle status).
4. **Audit Logs & Merkle Proofs**:
   - Sequential SHA-256 hash chains and anchored Merkle roots on Chain-1.

### 1.2 Trust Boundaries
- **Boundary T1 (Client to Application Gateway)**: Untrusted network boundary. Client TLS connection, session cookies, and request payloads.
- **Boundary T2 (Application Gateway to Blockchain Oracle)**: Boundary connecting Next.js server to Sepolia / EVM RPC nodes.
- **Boundary T3 (Application Gateway to Database / Storage)**: Boundary between server compute and Supabase PostgreSQL / Object Storage.
- **Boundary T4 (KMS Cryptographic Enforcement Boundary)**: The isolated cryptographic enclave where DEK unwrapping occurs. Must independently validate authorization evidence.

---

## 2. Threat Actors & Attack Surfaces

### 2.1 Threat Actor Profiles
- **External Network Adversary**: Unauthenticated or low-privilege attacker attempting credential stuffing, session hijacking, or direct API manipulation.
- **Malicious Insider / Compromised Normal User**: Authenticated user attempting horizontal privilege escalation (cross-tenant data access) or vertical escalation (admin takeover).
- **Compromised Infrastructure / Rogue Service**: Compromised database server or RPC node attempting to tamper with state or inject forged contracts.
- **Rogue Administrator**: Privileged user attempting unauthorized access, key exfiltration, or audit trail deletion.

---

## 3. Comprehensive Threat Analysis (Mandated Vectors)

### 3.1 Compromised Application Server
- **Threat**: An adversary gains remote code execution on the Next.js runtime.
- **Impact**: Attacker inspects server memory, attempts to harvest plaintext files and keys.
- **Mitigation Architecture**:
  - Memory isolation: Plaintext DEKs are stored in short-lived Buffers and zeroized (`buffer.fill(0)`) immediately after decryption cipher initialization.
  - KMS decoupling: Application logic cannot arbitrarily request key unwrapping without valid Chain-1 and Chain-2 authorization proofs and verified session evidence.

### 3.2 Stolen or Replayed Authorization Tokens
- **Threat**: An adversary intercepts a temporary decryption token from client memory or transit and attempts to replay it.
- **Impact**: Unauthorized access to asset ciphertext.
- **Mitigation Architecture**:
  - Bound Claims: Tokens are bound to `userId`, `assetId`, `sessionId`, `clientIp`, `keyVersionId`, `operation: "decrypt"`.
  - Atomic One-Time Redemption: Server marks token `jti` as redeemed at the point of decryption; subsequent attempts fail immediately.
  - Short Expiry: TTL restricted to <= 5–15 minutes.

### 3.3 Unauthorized Role Escalation
- **Threat**: An unprivileged user tampers with client-side role claims or exploits predictable user IDs (e.g. `admin_xxx`) to gain administrative powers.
- **Impact**: Execution of administrative actions (panic lockout, key rotation, user suspension).
- **Mitigation Architecture**:
  - Complete elimination of ID-prefix inferences.
  - Server-side authoritative role lookup from verified database/contract state on every protected request.
  - Four-eyes acknowledgment on elevated position changes.

### 3.4 Cross-Tenant Data Access
- **Threat**: A user from Tenant Alpha attempts to request or decrypt assets owned by Tenant Beta.
- **Impact**: Confidential defense data breach across divisions.
- **Mitigation Architecture**:
  - Tenant ID bound in asset records, access requests, and decryption authorization tokens.
  - AAD binding in AES-GCM includes `tenantId` and `assetId`, making cross-tenant key unwrapping cryptographically impossible.

### 3.5 Revoked Identity or Session
- **Threat**: A user whose account or session has been revoked by an administrator attempts to continue using an existing active JWT.
- **Impact**: Bypassing administrative revocation.
- **Mitigation Architecture**:
  - Live zero-trust verification: `getVerifiedSession` and `fetchAndDecryptDEK` check live session status in the database/store on every request.
  - Revoked sessions are immediately rejected, regardless of JWT expiry timestamp.

### 3.6 KMS Compromise & Insecure Defaults
- **Threat**: Master keys are leaked or insecure default keys (`0000000...0000`) are used in execution paths.
- **Impact**: Full compromise of all asset encryption.
- **Mitigation Architecture**:
  - Elimination of all-zero default keys.
  - Strict startup validation failing closed if `SECUREMAX_KMS_MASTER_KEY` is missing or weak.
  - Unique context-bound KEK derivation via PBKDF2 for each asset.

### 3.7 Stale Blockchain State & Split-Brain
- **Threat**: Desynchronization between Chain-1 (Identity), Chain-2 (Keys), and off-chain database.
- **Impact**: Granting access based on outdated permissions.
- **Mitigation Architecture**:
  - Oracle queries check contract state with strict freshness timeouts.
  - Any blockchain timeout or contract revert fails closed (denying decryption).

### 3.8 Malicious or Corrupted Ciphertext
- **Threat**: Bit-flipping or data tampering during storage or transit.
- **Impact**: Silent data corruption or chosen-ciphertext attacks.
- **Mitigation Architecture**:
  - AES-256-GCM authenticated encryption with 128-bit authentication tags.
  - Associated Authenticated Data (AAD) binding context.
  - Corrupted data causes `decipher.final()` to fail immediately; zero plaintext is returned.

### 3.9 Database and RPC Failures (Fail-Closed)
- **Threat**: PostgreSQL drops connections or Sepolia RPC endpoints return 500/timeout.
- **Impact**: System fails open, allowing unverified requests through.
- **Mitigation Architecture**:
  - Strict fail-closed policy: All errors in session validation, DB lookup, or contract verification throw fatal access-denied errors.

### 3.10 Audit Record Tampering
- **Threat**: An insider deletes or alters database audit rows to cover their tracks.
- **Impact**: Loss of forensic accountability.
- **Mitigation Architecture**:
  - Cryptographic hash-chaining: Each event includes `event_hash = SHA256(prev_hash + event_data)`.
  - Merkle roots of audit batches anchored to Chain-1 `AuditAnchor.sol`.
  - Standalone verification script detects any single altered character or broken link.

### 3.11 Compromised Administrator Account
- **Threat**: Admin credentials or wallet private key compromised.
- **Impact**: System-wide administrative tampering.
- **Mitigation Architecture**:
  - Admin operations require MetaMask cryptographic signature matching `admin_wallets` on Chain-1.
  - Critical operations (e.g. panic lockout, position changes) log unalterable audit events and notify SOC.

### 3.12 Insider Misuse
- **Threat**: Authorized personnel downloading data for unauthorized purposes.
- **Impact**: Intellectual property exfiltration.
- **Mitigation Architecture**:
  - Just-in-Time (JIT) access requests with required administrative approval.
  - Detailed telemetry: Device passport, IP address, and biometric assurance bound to each access log.

### 3.13 Supply-Chain Compromise
- **Threat**: Malicious dependency in npm package tree.
- **Impact**: Key exfiltration or backdoor execution.
- **Mitigation Architecture**:
  - `package-lock.json` integrity pinning.
  - Secrets loaded only through server-only modules (`import 'server-only'`).
  - Strict linting and automated CI security gates.
