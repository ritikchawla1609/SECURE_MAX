# SecureMAX Key Management Service (KMS) & Lifecycle Specification

> **Cryptographic Engine**: Web Crypto API / Node.js `crypto`  
> **Cipher**: AES-256-GCM (Authenticated Encryption with Associated Data)  
> **Key Derivation**: HKDF-SHA256 (RFC 5869)  
> **Authorization Model**: Request-Bound One-Time Tokens with Atomic Server Redemption

---

## 1. Architectural Envelope Encryption Design

SecureMAX implements hierarchical envelope encryption to protect classified documents at rest:

```
[ Master Key (KEK Root) ]  (Stored in Secure Enclave / Environment Variable)
           │
           ▼ HKDF-SHA256 (Context: assetId + tenantId + keyVersion)
   [ Key Encryption Key (KEK) ]
           │
           ▼ AES-256-GCM Wrap (AAD: "key_wrapping:{assetId}")
  [ Wrapped DEK Payload ] ──> Stored in Database (encryption_keys)
```

1. **Master Key (256-bit)**: Kept strictly within backend environment boundaries; never delivered to frontend bundles or emitted in logs.
2. **Key Encryption Key (KEK)**: Deterministically derived per asset and tenant using HKDF-SHA256.
3. **Data Encryption Key (DEK)**: 256-bit cryptographically secure random bytes generated via `crypto.randomBytes(32)` for each encrypted asset.
4. **Ciphertext Wrapping**: DEKs are encrypted with their respective KEK using AES-256-GCM, binding the asset ID in the Authenticated Associated Data (AAD) to prevent cross-asset key substitution.

---

## 2. Decryption Authorization & Replay Protection

When a user requests to preview or download a classified document:
1. The server verifies identity, active session, RBAC clearance, and asset assignment.
2. A cryptographically signed **Decryption Authorization Token** is generated with claims:
   - `sub`: Authenticated User ID
   - `assetId`: Target Asset ID
   - `tenantId`: Organization Tenant ID
   - `sessionId`: Active Session ID
   - `keyVersionId`: Valid Key Version
   - `operation`: `"decrypt"`
   - `jti`: Cryptographically random UUIDv4 token identifier
   - `exp`: Short-lived TTL (10 minutes)
3. **Atomic One-Time Redemption**:
   - The token must be redeemed via [`redeemDecryptionToken()`](file:///Users/ritikchawla/Downloads/securemax-sih-2026-main-4/src/lib/kms/redemption.ts).
   - The server maintains atomic consumption state. If the same `jti` is submitted again, redemption is denied immediately with `TOKEN_ALREADY_REDEEMED`.
   - Parallel concurrent redemption requests are serialized using an atomic lock; only the first request succeeds.

---

## 3. Cryptographic Fail-Closed Invariants

- **Zero-Key Fallbacks Prohibited**: In production mode (`NODE_ENV === 'production'`), master keys consisting of all-zeros or default strings cause immediate startup termination.
- **Tag Validation Mandatory**: Alterations to ciphertext or authentication tag bytes cause AEAD authentication to fail without releasing corrupted or partial plaintext.
- **Ephemeral In-Memory Handling**: Decrypted plaintext buffers are zeroed (`buffer.fill(0)`) immediately after streaming or display to prevent persistence in heap dumps.
