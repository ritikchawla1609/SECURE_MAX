# SecureMAX Current Data Flow (As-Is)

> **Classification**: ARCHITECTURAL DATA FLOW (AS-IS)  
> **Date**: October 2026  
> **Repository**: `SECURE_MAX` (SIH26125)  

---

## 1. Endpoints Granting Access, Issuing Tokens, or Releasing Plaintext

| Endpoint / Method | Component | Capability | Current Security Enforcement | Weaknesses / Gaps |
| :--- | :--- | :--- | :--- | :--- |
| `POST /api/auth/login` | `src/app/api/auth/login/route.ts` | Issues `securemesh_session` cookie | Verifies EVM / P-256 signature against challenge | Permits fallback demo logins if demo mode enabled |
| `POST /api/access/requests` | `src/app/api/access/requests/route.ts` | Creates/Approves access requests | Requires active session; approval requires `ADMIN` or `MANAGER` | `session.role` verified, but relies on caller session state |
| `POST /api/assets/decrypt` | `src/app/api/assets/decrypt/route.ts` | **Returns Plaintext Asset Data** | Calls `authorizeAssetAccess` and `prepareDecryptionStream` | Bypasses assignment check if `session.userId?.startsWith('admin')`; no one-time token redemption |
| `authorizeAssetAccess()` | `src/lib/api/access-flow.ts` | **Issues KMS Temporary Decryption Token** | Verifies User, Device, Assignment, Chain-1, Chain-2 | Contains implicit grant for `userId.includes('test')` or `user-123`; assigns synthetic clearances |
| `fetchAndDecryptDEK()` | `src/lib/kms/index.ts` | **Releases Plaintext DEK in KMS Boundary** | Requires temporary token, checks session revocation | Silently falls back to all-zero master key on unwrap failure |

---

## 2. Complete Identity-to-Decryption Data Flow (Current)

```mermaid
sequenceDiagram
    autonumber
    actor Client as User / Wallet
    participant API as /api/assets/decrypt
    participant Guard as Session Guard
    participant Flow as access-flow.ts
    participant Oracle as Blockchain Oracle
    participant KMS as KMS (fetchAndDecryptDEK)
    participant Storage as Supabase Storage / Store

    Client->>API: POST { assetId } (with securemesh_session cookie)
    API->>Guard: getVerifiedSession()
    Note over Guard: Checks JWT signature & store session status
    Guard-->>API: SessionPayload { userId, role, sessionId }

    alt session.userId starts with 'admin'
        API->>API: Bypass assignment check! (Implicit Grant)
    else Normal User
        API->>API: Check deviceStore.getAssignment(userId, assetId)
    end

    API->>Flow: authorizeAssetAccess(userId, assetId, sessionId, deviceId)
    
    alt userId includes 'test' or 'user-123'
        Flow->>Flow: Fabricate synthetic active user & assignment!
    else Real User
        Flow->>Flow: deviceStore.getUserById(userId)
    end

    opt If not Admin
        Flow->>Oracle: verifyChain1Access(userId, assetId)
        Oracle-->>Flow: { allowed: true }
        Flow->>Oracle: verifyChain2Policy(assetId, sessionId)
        Oracle-->>Flow: { allowed: true }
    end

    Flow->>Oracle: recordDecryptionAuthorization(authId, ...)
    Flow->>KMS: issueTemporaryDecryptionToken({ userId, assetId, sessionId, permissions })
    KMS-->>Flow: tempToken (30m JWT)
    Flow-->>API: { tempToken, authorized: true }

    API->>Flow: prepareDecryptionStream(assetId, iv, authTag, tempToken, sessionId)
    Flow->>KMS: fetchAndDecryptDEK(assetId, { token: tempToken, sessionId })
    Note over KMS: Validates tempToken claims & signature
    Note over KMS: Checks live session status

    KMS->>Storage: Retrieve wrapped DEK
    Storage-->>KMS: { encrypted_dek, dek_iv }
    KMS->>KMS: deriveKEK(masterKey, assetId) & decryptData()
    
    alt Decryption fails with primary masterKey
        KMS->>KMS: Insecure fallback to 00000000...0000!
    end

    KMS-->>Flow: dekPlaintext Buffer
    Flow-->>API: crypto.Decipher Decryption Stream
    API->>Storage: Fetch ciphertext blob
    Storage-->>API: Ciphertext stream
    API->>API: Stream through Decipher (decrypts in memory)
    API-->>Client: 200 OK { decryptedData: "...", ... }
```

---

## 3. Discovered Vulnerability Paths in Current Flow

1. **Adversary with `admin-` prefix**:
   If an adversary can register an identity whose ID begins with `admin`, the access flow bypasses assignment validation and Chain-1/Chain-2 contract verification.
2. **Token Replay within 30 Minutes**:
   A valid `tempToken` issued to a session can be submitted repeatedly to `fetchAndDecryptDEK` without atomic invalidation.
3. **Decryption Retry with All-Zero Key**:
   If an asset was encrypted with an improper key or a corrupted master key is loaded, KMS will attempt decryption with the all-zero key fallback.
