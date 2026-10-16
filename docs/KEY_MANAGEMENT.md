# SecureMAX Key Management & Cryptographic Lifecycle Specification

**Version:** 1.0.0  
**Scope:** Key Management System (KMS), Envelope Cryptography, and Smart Contract Policies  
**Standard:** NIST SP 800-57 (Key Management Recommendations), Zero-Trust Cryptographic Separation  

---

## 1. Key Hierarchy & Architecture

SecureMAX utilizes a multi-tiered cryptographic key hierarchy enforcing the core principle: **Authorization ≠ Decryption**.

```
+-----------------------------------------------------------------------------------------+
|                                    MASTER KEY LAYER                                     |
|  [ SECUREMAX_KMS_MASTER_KEY / Cloud KMS Key ARN / HSM Root ]                            |
|    - 256-bit hardware-protected root secret or Cloud KMS managed key                    |
|    - Never exported, never leaves KMS boundary                                          |
+-----------------------------------------------------------------------------------------+
                                           |
                                           |  HKDF-SHA256 Contextual Derivation
                                           v
+-----------------------------------------------------------------------------------------+
|                             KEY ENCRYPTION KEY (KEK) LAYER                              |
|  [ Ephemeral Contextual KEKs ]                                                          |
|    - Derived per asset version: `kek:<assetId>:<keyVersion>:<tenantId>`                 |
|    - Salt: `SECUREMAX_KMS_KEK_SALT_v1`                                                  |
|    - Exists solely in volatile memory during wrap/unwrap; zeroized immediately (`.fill(0)`)|
+-----------------------------------------------------------------------------------------+
                                           |
                                           |  AES-256-GCM Envelope Wrap / Unwrap
                                           v
+-----------------------------------------------------------------------------------------+
|                             DATA ENCRYPTION KEY (DEK) LAYER                             |
|  [ Per-Asset Symmetric DEKs ]                                                           |
|    - 256-bit cryptographically random key (`crypto.randomBytes(32)`)                    |
|    - Stored strictly encrypted (wrapped) in database with Canonical AAD                 |
|    - Ephemeral release to authorized client streams via 5-min Decryption Tokens        |
+-----------------------------------------------------------------------------------------+
                                           |
                                           |  Bulk File Encryption / Decryption
                                           v
+-----------------------------------------------------------------------------------------+
|                                   CIPHERTEXT LAYER                                      |
|  [ Stored Document Ciphertext ]                                                         |
|    - AES-256-GCM authenticated ciphertext stream                                        |
|    - 96-bit random IV per file + 128-bit authentication tag                             |
+-----------------------------------------------------------------------------------------+
```

---

## 2. Key Lifecycle States

Keys managed in SecureMAX and tracked on-chain via `KeyLifecycle.sol` progress through well-defined lifecycle states:

```
  +--------------+
  |  Generation  |
  +--------------+
         |
         v
  +--------------+     rotateKey()     +--------------+
  |    ACTIVE    | ------------------> |   ROTATED    |
  +--------------+                     +--------------+
         |                                    |
         | revokeKey()                        | revokeKey()
         v                                    v
  +---------------------------------------------------+
  |                      REVOKED                      |
  +---------------------------------------------------+
                           |
                           | purgeExpired()
                           v
  +---------------------------------------------------+
  |                     DESTROYED                     |
  +---------------------------------------------------+
```

| State | Allowed Operations | Forbidden Operations | Smart Contract Enum |
|---|---|---|---|
| **`ACTIVE`** | Wrap (new uploads), Unwrap (decrypt current version), Rotate, Revoke | Re-registration | `KeyState.Active` (0) |
| **`ROTATING`**| Intermediate transition during bulk re-encryption batches | New uploads | `KeyState.Rotating` (1) |
| **`ROTATED`** | Unwrap (decrypt historical ciphertext versions), Revoke | Wrap (cannot encrypt new uploads) | `KeyState.Rotated` (2) |
| **`REVOKED`** | Audit inspection, metadata read | Wrap, Unwrap, Rotate (Fails Closed immediately) | `KeyState.Revoked` (3) |
| **`DESTROYED`**| None | All cryptographic and retrieval operations | `KeyState.Destroyed` (4) |

---

## 3. Key Wrapping & Canonical AAD Binding

To eliminate ciphertext swapping, cross-tenant attacks, and key replay vulnerabilities, every DEK wrapped by SecureMAX binds **Canonical Additional Authenticated Data (AAD)**:

### 3.1 Canonical AAD Construction
```typescript
export interface CanonicalAADParams {
  assetId: string;
  tenantId?: string;
  keyVersion: string;
  purpose: 'key_wrapping' | 'external_kms_wrap';
  algorithm: string;
}

export function buildCanonicalAAD(params: CanonicalAADParams): string {
  return JSON.stringify({
    algorithm: params.algorithm,
    assetId: params.assetId,
    keyVersion: params.keyVersion,
    purpose: params.purpose,
    tenantId: params.tenantId || 'default',
  });
}
```

### 3.2 Invariant Verification on Unwrap
During `unwrapDEK`, the KMS reconstructs the expected canonical AAD from request parameters and compares it byte-for-byte against the stored AAD. If any attribute (tenant, version, algorithm, asset ID) differs, unwrapping fails closed with `Integrity Failure: AAD mismatch during key unwrapping`.

---

## 4. Key Rotation Procedures

### 4.1 On-Demand Asset Key Rotation
When an asset key is rotated:
1. **New DEK Generation:** A fresh 256-bit DEK is generated.
2. **Version Increment:** The version is incremented (e.g., `v1` $\rightarrow$ `v2`).
3. **Smart Contract State Update:** `KeyLifecycle.sol` updates the existing key status to `Rotated` and registers the new key ID as `Active`.
4. **Historical Ciphertext Compatibility:** Ciphertext encrypted under `v1` remains decryptable by authorized users because `v1` wrapped DEK is retained in `key_versions`.
5. **Re-encryption Batch:** A background worker can stream-decrypt using `v1` DEK and re-encrypt using `v2` DEK, updating the database record once completed.

### 4.2 Emergency Revocation Procedure
In the event of suspected key compromise:
1. **API / Contract Trigger:** The Security Officer invokes `POST /api/admin/panic` or calls `KeyLifecycle.revokeKey(keyId)`.
2. **Immediate Lockout:** Both `KeyLifecycle.sol` and the KMS provider mark the key as `Revoked`.
3. **Fail-Closed Enforcement:** Any ongoing or subsequent calls to `unwrapDEK` abort immediately with:
   ```
   Access Denied: Key has been revoked on KMS
   ```
4. **Session Termination:** All temporary decryption tokens associated with the key are invalidated across all active sessions.

---

## 5. Provider Configuration: Development vs Production

SecureMAX enforces strict separation between testing/development and production cryptographic environments.

### 5.1 Development: `DevSoftwareKMSProvider`
- **Class:** `DevSoftwareKMSProvider` in `src/lib/kms/provider.ts`
- **Environment:** `NODE_ENV !== 'production'`
- **Behavior:** Derives KEKs in-memory using Node.js `crypto` with a local master key.
- **Production Guard:** Explicitly throws a fatal error if invoked in production:
  ```typescript
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL SECURITY CONFIGURATION: DevSoftwareKMSProvider cannot be used in a production environment.');
  }
  ```

### 5.2 Production: `ExternalKMSProvider`
- **Class:** `ExternalKMSProvider` in `src/lib/kms/provider.ts`
- **Supported Backends:**
  - **AWS Key Management Service (AWS KMS):** Hardware HSM-backed envelope encryption using `kms:Encrypt` / `kms:Decrypt`.
  - **HashiCorp Vault Transit Secrets Engine:** Enterprise secret management with automated key versioning.
  - **Google Cloud KMS:** Cloud HSM key rings with multi-region replication.
- **Configuration Variables:**
  - `SECUREMAX_KMS_PROVIDER=external`
  - `KMS_KEY_ARN=arn:aws:kms:us-east-1:123456789012:key/...`
  - `KMS_ENDPOINT=https://vault.internal.corp:8200/v1/transit`
  - `KMS_AUTH_TOKEN=s.vault-token-xyz`

---

## 6. Zero-Fallback & Anti-Tamper Guarantees

1. **Zero-Key Elimination:** The system strictly prohibits fallback to 64-character zeros (`0000...0000`). If `SECUREMAX_KMS_MASTER_KEY` is set to zeros or omitted in production, the application refuses to boot.
2. **Memory Zeroization:** All plaintext key buffers (`Buffer`) are overwritten with zeros immediately upon completion of cryptographic operations:
   ```typescript
   try {
     // Cryptographic operations
   } finally {
     kekBuffer.fill(0);
     dekBuffer.fill(0);
   }
   ```
3. **No Private Keys in Database:** Web Crypto P-256 and MetaMask private keys are generated on client devices and never transmitted over the network or stored in database tables.
