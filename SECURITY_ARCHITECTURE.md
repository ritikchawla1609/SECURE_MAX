# SecureMAX Security Architecture Document

**Document Version:** 1.0.0  
**Classification:** Confidential / System Architecture Specification  
**System Name:** SecureMAX (Zero-Trust Encrypted Document Sharing & Integrity Verification Platform)  
**Core Architectural Directive:** `AUTHORIZATION ≠ DECRYPTION`  
**Compliance Standard:** Zero-Trust Architecture (NIST SP 800-207), Defense-in-Depth, Cryptographic Envelope Isolation  

---

## 1. Executive Security Architectural Overview

In traditional enterprise file systems and cloud storage platforms, **authorization implicitly equals decryption**: if a user or system process passes an Access Control List (ACL) check or obtains database row-level permissions, the storage infrastructure automatically serves decrypted plaintext. Under this legacy model, any compromise of the database, cloud infrastructure, service account credentials, or API gateway results in immediate data exfiltration.

**SecureMAX eliminates this systemic failure mode through cryptographic separation of duty:**
1. **Chain-1 (Identity, RBAC, Asset Clearance, and Audit Anchoring):** Evaluates identity claims, decentralized identifiers (DIDs), organizational roles, asset security classifications, and assigns cryptographic audit anchors. It can grant or deny *authorization* to request an asset, but possesses **zero key material** and cannot perform cryptographic decryption.
2. **Chain-2 (Key Lifecycle, Key Policies, and Decryption Authorization):** Governs cryptographic key policies, key states (Active, Rotating, Rotated, Revoked, Destroyed), and records time-limited, session-bound Decryption Authorizations.
3. **Key Management System (KMS) & Envelope Cryptography:** Enforces multi-party access control before releasing ephemeral Data Encryption Keys (DEKs). Decryption requires an ephemeral, device-bound, session-bound Temporary Decryption Token validated against live Chain-2 policy state.
4. **Zero-Trust Compute Plane (Next.js 14 App Router):** Intermediates streams using AES-256-GCM without writing decrypted plaintext to disk or persisting unencrypted DEKs in application state.

```
+-----------------------------------------------------------------------------------------+
|                                    CLIENT BORDER                                        |
|  [ Web Browser / Native Client ]                                                        |
|    - Model A: MetaMask EVM Signatures (Admin)                                           |
|    - Model B: Web Crypto API ECDSA P-256 Key Pairs (Enterprise Users)                   |
|    - Model C: Device Trust Attestation & Device-Bound Enrollment                        |
+-----------------------------------------------------------------------------------------+
                                           |  HTTPS / TLS 1.3
                                           v
+-----------------------------------------------------------------------------------------+
|                                 TRUSTED COMPUTE ZONE                                    |
|  [ Next.js Serverless Execution Plane (server-only boundary) ]                          |
|    - Session Validation & Zero-Trust Invariant Verification (Session + User + Device)  |
|    - Sentinel Deterministic Threat & Attack Simulation Engine                           |
|    - AES-256-GCM Streaming Decryption Engine                                           |
|    - Canonical Additional Authenticated Data (AAD) Construction                         |
|                                                                                         |
|  [ Key Management System (KMS) Engine ]                                                 |
|    - DevSoftwareKMSProvider (Development / CI Test Only - Fails Closed in Prod)         |
|    - ExternalKMSProvider (AWS KMS, HashiCorp Vault, Cloud HSM)                         |
|    - HKDF-SHA256 Contextual Key Derivation (Master Key -> KEK)                          |
|    - Ephemeral DEK Wrapping & Unwrapping with Immediate Zeroization (`buf.fill(0)`)      |
+-----------------------------------------------------------------------------------------+
              |                                            |                        |
              v                                            v                        v
+-----------------------------+              +------------------------+  +-------------------+
|     TRUSTED STORAGE         |              |  CHAIN-1: PERMISSIONS  |  |  CHAIN-2: KEYS    |
| [ Supabase / PostgreSQL ]   |              |  [ Ethereum / Sepolia] |  |  [ EVM Chain ]    |
| - Encrypted Blob Storage    |              | - IdentityRegistry.sol |  | - KeyLifecycle    |
| - Wrapped DEK Payloads      |              | - RBACManager.sol      |  | - KeyPolicyManager|
| - Tamper-Evident Hash Chains|              | - AssetRegistry.sol    |  | - DecryptionAuth  |
| - Device / Session Registry |              | - AuditAnchor.sol      |  +-------------------+
+-----------------------------+              +------------------------+
```

---

## 2. Threat Model & Attacker Assumptions

### 2.1 Threat Actors & Capabilities

| Threat Actor | Capabilities & Resources | Primary Attack Objectives | System Defenses |
|---|---|---|---|
| **Malicious Insider / Rogue DBA** | Direct read/write access to PostgreSQL tables, object storage buckets, and server configuration. | Exfiltrate classified asset files, alter audit logs to conceal access, forge authorization records. | Ciphertext is encrypted at rest with AES-256-GCM. DEKs are wrapped with KMS KEKs derived from external master keys. Audit logs are hash-chained and anchored to Chain-1 `AuditAnchor.sol`. |
| **Network Eavesdropper / MitM** | Intercepts, replays, or injects traffic across public networks and client-server channels. | Replay authentication nonces, steal session tokens, intercept plaintext downloads. | TLS 1.3 mandatory, HSTS enabled, single-use cryptographically random challenges, HttpOnly SameSite=Strict cookies, IP & User-Agent session binding. |
| **Compromised User Device** | Attacker has compromised an endpoint or stolen an unprivileged user's credentials. | Access assets beyond classification level, impersonate administrators, pivot to other tenants. | Multi-tier RBAC (`USER`, `AUDITOR`, `SOC_ANALYST`, `SECURITY_OFFICER`, `ADMIN`), device assurance levels, dynamic step-up verification, hardware-bound Web Crypto P-256 private keys non-exportable from client TPM/Secure Enclave. |
| **Rogue / Compromised Blockchain RPC Node** | Malicious or desynchronized Ethereum node returning spoofed contract responses or timing out. | Forge `isAssigned` state or trigger fail-open bypasses to decrypt unauthorized assets. | **Strict Fail-Closed Architecture:** RPC timeouts, node errors, or ambiguous reverts immediately terminate access flows with HTTP 503 (`BLOCKCHAIN_UNAVAILABLE`). No local cache fallback on security boundaries. |
| **External Cyber Threat / APT** | Advanced exploit payloads against web API endpoints, server-side request forgery (SSRF), parameter tampering. | Bypass authentication, trigger administrative panic lockouts, invoke unauthenticated state synchronization. | Strict Zod payload validation, parameter-isolated SQL/Supabase clients, zero IDOR parameter trust, `server-only` boundary enforcement preventing credential leaks. |

### 2.2 Security Assets & Boundary Definitions

1. **Asset Plaintext Files:** Sensitive documents, technical schematics, and confidential corporate intelligence. Protected via client-side/server-side streaming AES-256-GCM.
2. **Data Encryption Keys (DEKs):** 256-bit cryptographically random symmetric keys generated per asset. Never stored in plaintext; stored wrapped under KEKs with canonical AAD.
3. **Key Encryption Keys (KEKs):** Ephemeral 256-bit keys derived on-demand via HKDF-SHA256 from the Master Key with domain-separated salt and canonical context parameters.
4. **Master Key Material:** Hardware-protected or environment-injected 256-bit root key (`SECUREMAX_KMS_MASTER_KEY`). Zero-fallback is strictly prohibited.
5. **Decentralized Identifiers & Public Keys:** Verifiable identities (`did:securemax:<address>`) and SPKI-formatted ECDSA P-256 public keys stored in PostgreSQL and `IdentityRegistry.sol`.
6. **Audit Records & Merkle Anchors:** Cryptographically chained event logs verifying chronological authenticity of all security actions.

---

## 3. Trust Boundaries & Data Flow Analysis

### 3.1 Data Flow 1: Secure Asset Upload & Envelope Encryption

```
Client                      Next.js API Engine                   KMS Provider                 Storage Bucket
  |                                 |                                 |                             |
  |-- 1. POST /api/assets/upload -->|                                 |                             |
  |   (Multipart File + Metadata)   |-- 2. Validate Session & Role -->|                             |
  |                                 |-- 3. createAssetKey(assetId) -->|                             |
  |                                 |                                 |-- 4. Generate 256-bit DEK   |
  |                                 |                                 |-- 5. HKDF Derive KEK        |
  |                                 |                                 |-- 6. AES-GCM Wrap DEK + AAD |
  |                                 |<-- 7. Return DEK + WrappedDEK --|                             |
  |                                 |-- 8. Stream AES-256-GCM Encrypt                               |
  |                                 |-- 9. Zeroize Plaintext DEK in Memory (`dek.fill(0)`)          |
  |                                 |-- 10. Store Ciphertext Stream -------------------------------->|
  |                                 |-- 11. Persist Wrapped DEK & AAD in DB                         |
  |                                 |-- 12. Register Asset in Chain-1 AssetRegistry.sol             |
  |<-- 13. HTTP 201 Created --------|                                                               |
```

1. **Authentication & Authorization Verification:** The server extracts the `securemesh_session` cookie and verifies user role and storage quota.
2. **Key Generation & Wrapping:** The KMS generates a fresh 32-byte cryptographically secure DEK (`crypto.randomBytes(32)`). The DEK is wrapped using the active KEK derived from the Master Key.
3. **Canonical AAD Binding:** A canonical JSON-serialized Additional Authenticated Data string is bound to the encryption:
   ```json
   {"algorithm":"aes-256-gcm","assetId":"ast_01H...","keyVersion":"v1","purpose":"key_wrapping","tenantId":"default"}
   ```
4. **Streaming Encryption:** The file stream is encrypted with AES-256-GCM, producing ciphertext, a 96-bit random IV, and a 128-bit authentication tag.
5. **Memory Zeroization:** Plaintext DEK buffers are immediately overwritten with zeros (`dek.fill(0)`).
6. **Persistence & Blockchain Registration:** Ciphertext is saved to storage. The wrapped DEK payload is recorded in PostgreSQL. The asset hash is registered on Chain-1 (`AssetRegistry.sol`).

---

### 3.2 Data Flow 2: Access Clearance & Temporary Decryption Authorization

```
Client                      Next.js API Engine              Chain-1 (RBAC/Asset)          Chain-2 (Policy)
  |                                 |                                 |                          |
  |-- 1. POST /api/assets/action -->|                                 |                          |
  |   (assetId, action: 'REQUEST')  |-- 2. Verify Session & Device -->|                          |
  |                                 |-- 3. Query isAssigned(asset,usr)|                          |
  |                                 |-------------------------------->|                          |
  |                                 |<-- 4. Returns true / false -----|                          |
  |                                 |-- 5. Query isPolicyActive(key)->|                          |
  |                                 |----------------------------------------------------------->|
  |                                 |<-- 6. Returns true / false --------------------------------|
  |                                 |-- 7. Issue Ephemeral Decryption Token (5 min TTL)          |
  |<-- 8. Return Temp Token --------|                                                            |
```

1. **Session & Device Assurance Check:** Ensures the requester's session is active and not revoked, the user account is active, and the client device trust level meets the asset clearance requirements.
2. **Chain-1 Clearance Verification:** Validates that the user's DID has an explicit assignment in `AssetRegistry.sol` and the necessary permissions in `RBACManager.sol`.
3. **Chain-2 Key Policy Verification:** Ensures the key assigned to the asset is `Active` and that the governing `KeyPolicy` in `KeyPolicyManager.sol` is satisfied.
4. **Temporary Token Issuance:** The KMS issues a signed JWT (`HS256` or `EdDSA`) with a strict **5-minute TTL**. The token is cryptographically bound to:
   - `userId` (DID)
   - `assetId`
   - `sessionId` (strictly verified against the active HTTP session cookie)
   - `clientIp` (incoming request client IP address)

---

### 3.3 Data Flow 3: Asset Decryption & Secure Streaming

```
Client                      Next.js API Engine                   KMS Provider                 Storage Bucket
  |                                 |                                 |                             |
  |-- 1. GET /api/assets/decrypt -->|                                 |                             |
  |   (Headers: Token + Session)    |-- 2. Validate Token & IP Binding|                             |
  |                                 |-- 3. Fetch Wrapped DEK from DB  |                             |
  |                                 |-- 4. unwrapDEK(wrappedPayload)->|                             |
  |                                 |                                 |-- 5. HKDF Derive KEK        |
  |                                 |                                 |-- 6. Decipher DEK + AuthTag |
  |                                 |                                 |-- 7. Zeroize KEK            |
  |                                 |<-- 8. Return Plaintext DEK -----|                             |
  |                                 |-- 9. Fetch Ciphertext Stream -------------------------------->|
  |                                 |<-- 10. Pipe Ciphertext Stream --------------------------------|
  |                                 |-- 11. AES-256-GCM Streaming Decrypt                           |
  |                                 |-- 12. Zeroize Plaintext DEK (`dek.fill(0)`)                   |
  |<-- 13. Plaintext Binary Stream -|                                                               |
```

1. **Token Cryptographic Validation:**
   - Validates signature against KMS secret.
   - Rejects expired tokens (`Date.now() > exp`).
   - Validates that `payload.sessionId === session.sessionId`.
   - Validates that `payload.assetId === req.assetId`.
   - Validates that `payload.ip === req.ip`.
2. **Key Unwrapping:** The KMS retrieves the wrapped DEK, verifies the canonical AAD, derives the contextual KEK, decrypts the DEK, and zeroizes the KEK in memory immediately.
3. **Binary Streaming Decryption:** Plaintext is streamed directly to the HTTP response pipe using node crypto decipher streams. The DEK is never exposed to the client and zeroized on stream end or abort.

---

### 3.4 Data Flow 4: Hash-Chained Audit Trail & Merkle Anchoring

1. **Off-Chain Hash Chaining:** Every security-relevant event (logins, key access, policy modifications, revocations, file access) is hashed using SHA-256:
   $$\text{Hash}_i = \text{SHA256}(\text{EventData}_i \parallel \text{Hash}_{i-1})$$
2. **Merkle Batching:** Periodically or upon reaching a batch threshold, audit event hashes are arranged into a Merkle Tree (`src/lib/audit/merkle.ts`).
3. **On-Chain Anchoring:** The Merkle root is anchored into Chain-1 (`AuditAnchor.sol`) via `anchorRoot(merkleRoot, startId, endId)`.
4. **Independent Public Verification:** Any auditor can verify any historical log entry by requesting its Merkle audit path and verifying it against the immutable root on Ethereum.

---

## 4. Identity & Authentication Architecture

SecureMAX implements three rigorous authentication models suited for zero-trust environments:

```
+-----------------------------------------------------------------------------------------+
|                               SECUREMAX AUTHENTICATION SUITE                            |
+-----------------------------------------------------------------------------------------+
|  MODEL A: Web3 MetaMask EVM Authentication (Administrators & SecOps)                    |
|    - EIP-712 / SIWE-Compliant Domain Separation                                         |
|    - Nonce-based cryptographic challenge with 120s TTL                                  |
|    - Direct verification via `ethers.verifyMessage` or `viem.verifyMessage`              |
|    - Maps to `did:securemax:<address_lowercase>`                                         |
+-----------------------------------------------------------------------------------------+
|  MODEL B: Web Crypto ECDSA P-256 Authentication (Enterprise Employees & Analysts)       |
|    - Local hardware-backed key pair generation via `crypto.subtle` (P-256 / secp256r1)  |
|    - Private key NEVER leaves client device or Secure Enclave                           |
|    - Server stores base64 SPKI DER public key fingerprint                               |
|    - Single-use challenge signed as IEEE-P1363 raw (r || s) scalar components           |
+-----------------------------------------------------------------------------------------+
|  MODEL C: Device Trust & Assurance Enrollment (Hardware Binding & Zero-Trust Posture)   |
|    - Single-use 6-digit cryptographic security code verification                        |
|    - Client fingerprinting: WebGL renderer, OS platform, CPU concurrency, hardware specs |
|    - Cryptographic posture evaluation (`LOW`, `MEDIUM`, `HIGH`, `HARDENED`)             |
|    - Contextual step-up authentication required if device posture changes               |
+-----------------------------------------------------------------------------------------+
```

### 4.1 Session Token Management

- **Format:** High-entropy JWT signed with `HS256` or `Ed25519` using `SECUREMAX_JWT_SECRET`.
- **Storage:** Stored exclusively in an `HttpOnly`, `SameSite=Strict`, `Secure` cookie named `securemesh_session`.
- **Lifetime:** Strict 1-hour expiry. No infinite sessions.
- **Zero-Trust Session Verification (`getVerifiedSession()`):** Every protected request validates:
  1. Cryptographic JWT integrity and non-expiry.
  2. Live database session status: Must be `ACTIVE` (reverts if marked `REVOKED` in `deviceStore` or Supabase).
  3. Live user account status: Must be `ACTIVE` (reverts immediately if user was suspended or deactivated).
  4. Live device trust status: Must be `ACTIVE` (reverts immediately if device was revoked by an admin).

---

## 5. Authorization & RBAC Architecture

SecureMAX enforces five distinct authorization tiers:

| Role | Role Level | Scope of Permissions | Key Management Access |
|---|---|---|---|
| `ANONYMOUS` | 0 | Landing page, login/registration, challenge request. | None |
| `USER` | 1 | Upload assets, manage owned documents, request access to shared assets, decrypt authorized assets. | Permitted to request DEKs for assigned assets. |
| `AUDITOR` | 2 | View audit trails, verify Merkle roots against `AuditAnchor.sol`, inspect compliance history. | Read-only audit logs. No DEK decryption access. |
| `SOC_ANALYST` | 3 | Monitor Sentinel intrusion alarms, inspect anomalous device activity, triage threats. | Access to security logs and threat telemetry. |
| `SECURITY_OFFICER` | 4 | Manage key policies in `KeyPolicyManager.sol`, initiate key rotations, trigger emergency key revocations. | Key lifecycle governance. |
| `ADMIN` | 5 | Assign RBAC roles in `RBACManager.sol`, register assets in `AssetRegistry.sol`, bootstrap devices, trigger panic lockout. | Administrative governance. |

---

## 6. Smart Contract Separation of Concerns

```
+---------------------------------------+       +---------------------------------------+
|        CHAIN-1: AUTHORIZATION         |       |        CHAIN-2: KEY MANAGEMENT        |
|      (Identity, RBAC, Asset, Audit)   |       |    (Key Policies & Decryption Auth)   |
+---------------------------------------+       +---------------------------------------+
| 1. IdentityRegistry.sol               |       | 1. KeyLifecycle.sol                   |
|    - Registers DIDs & Public Keys     |       |    - Registers Key IDs & Algorithms   |
|    - Tracks IdentityStatus (Active,   |       |    - State: Active, Rotated, Revoked  |
|      Suspended, Revoked)              |       |    - Prevents use of revoked keys     |
|                                       |       |                                       |
| 2. RBACManager.sol                    |       | 2. KeyPolicyManager.sol               |
|    - Bitmask permissions              |       |    - Time-bound access policies       |
|    - Multi-tenant role assignments    |       |    - Cryptographic conditions hash    |
|                                       |       |    - Dynamic deactivation controls    |
| 3. AssetRegistry.sol                  |       |                                       |
|    - Asset metadata & content hash    |       | 3. DecryptionAuth.sol                 |
|    - Security Classification levels   |       |    - Ephemeral authorization records  |
|    - Explicit `isAssigned` checks     |       |    - AuthResult: Authorized, Denied,  |
|                                       |       |      Completed, Pending               |
| 4. AuditAnchor.sol                    |       |                                       |
|    - Merkle Root on-chain anchoring   |       |                                       |
|    - Batch ranges & timestamp proofs  |       |                                       |
+---------------------------------------+       +---------------------------------------+
```

---

## 7. Cryptographic Design & Envelope Key Architecture

### 7.1 Cipher Suite Specifications

- **Bulk Encryption:** AES-256-GCM (NIST SP 800-38D).
  - Key Length: 256 bits (32 bytes).
  - Initialization Vector (IV): 96 bits (12 bytes), cryptographically random per encryption. IV reuse probability $< 2^{-32}$.
  - Authentication Tag: 128 bits (16 bytes).
- **Key Derivation Function (KDF):** HKDF-SHA256 (RFC 5869).
  - Salt: `SECUREMAX_KMS_KEK_SALT_v1`.
  - Context Info: `kek:<assetId>:<keyVersion>:<tenantId>`.
- **Identity & Signatures:**
  - Administrative: ECDSA secp256k1 (Keccak-256).
  - Standard Users: ECDSA secp256r1 / P-256 (SHA-256) via Web Crypto API.

### 7.2 Key Lifecycle State Machine

```
              +----------------+
              |   (Generate)   |
              +----------------+
                      |
                      v
              +----------------+
              |     ACTIVE     |<------+ (Re-encryption)
              +----------------+       |
                |            |         |
     (Rotate)   |            | (Revoke)|
                v            |         |
       +----------------+    |         |
       |    ROTATED     |    |         |
       +----------------+    |         |
                |            |         |
       (Revoke) |            v         |
                +----->+----------------+
                       |    REVOKED     |
                       +----------------+
                               |
                        (Secure Purge)
                               v
                       +----------------+
                       |   DESTROYED    |
                       +----------------+
```

1. **Active:** Key is authorized for both encryption (wrap) and decryption (unwrap).
2. **Rotated:** Key is retired from new uploads. Permitted solely for decrypting historical ciphertext versions until re-encryption occurs.
3. **Revoked:** Key is immediately forbidden from all unwrapping operations. Any unwrap request fails closed with `Access Denied: Key has been revoked`.
4. **Destroyed:** Ephemeral material and database records purged.

---

## 8. Failure Behavior & Sentinel Defensive Controls

### 8.1 Fail-Closed Invariants

- **No Zero-Key Fallbacks:** Any initialization with zero-valued keys (`0000...0000`) or missing production KMS configuration triggers an immediate fatal startup error.
- **Strict RPC Error Handling:** In `src/lib/blockchain/oracle.ts`, any RPC timeout, connection reset, or contract revert returns:
  ```typescript
  { allowed: false, status: 'UNAVAILABLE', reason: 'RPC Failure or Contract Revert' }
  ```
  The caller fails closed and terminates the decryption request.
- **Binary Stream Safety:** The decryption handler streams binary byte arrays without passing binary buffers through character decoding routines (`TextDecoder`), preventing corrupted downloads and memory exhaustion.

### 8.2 Sentinel Real-Time Intrusion Engine

SecureMAX incorporates the **Sentinel Threat Engine** (`src/lib/sentinel/engine.ts`), which runs deterministic attack vectors in sandbox environments:
1. `checkUnauthorizedAccess`: Verifies unassigned users cannot obtain DEKs.
2. `checkExpiredKey`: Verifies expired temporary JWT tokens are rejected.
3. `checkRevokedPermission`: Verifies revoked sessions cannot decrypt data.
4. `checkTamperedCiphertext`: Verifies AES-GCM authentication tags catch single-bit tampering.
5. `checkSessionIpMismatch`: Verifies IP address binding prevents token replay.
6. `checkMissingAad`: Verifies key wrapping without canonical AAD is rejected.
7. `checkCrossTenantLeak`: Verifies multi-tenant isolation boundaries.
8. `checkAdminPanicLockout`: Verifies system-wide lockdown during active compromise.

---

## 9. Prototype Limitations & Production Roadmap

While the SecureMAX hackathon demonstration codebase features a complete, working cryptographic engine, dual EVM smart contracts, and real-time dashboard UI, the following prototype limitations should be transitioned for enterprise production deployment:

1. **Software KMS Emulator:** In development, keys are derived via `DevSoftwareKMSProvider`. Production deployments must bind to hardware-backed HSMs (AWS KMS, Google Cloud KMS, or HashiCorp Vault) using `ExternalKMSProvider`.
2. **Blockchain Deployment:** Current contracts are tested on local Hardhat nodes and configured for Sepolia testnet. Enterprise production should deploy to Ethereum Mainnet or high-throughput Layer 2s (e.g., Base, Arbitrum).
3. **Decentralized Storage:** Binary blobs currently reside in Supabase Storage. For decentralized trustlessness, storage adapters can pipe encrypted ciphertext streams directly to Filecoin / IPFS or Arweave.
4. **Hardware Key Attestation:** Web Crypto P-256 keys are client-generated. Enterprise deployments can enforce FIDO2 / WebAuthn hardware device attestation (YubiKey / Apple Secure Enclave) via client assertion verification.
