# SecureMAX Target Data Flow Specification

> **Classification**: TARGET DATA FLOW (TO-BE)  
> **Date**: October 2026  
> **Scope**: 12-Step Canonical Authorization and Decryption Pipeline  

---

## 1. Canonical End-to-End Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    actor Client as Client / Enrolled Device
    participant API as API Route (/api/assets/decrypt)
    participant Guard as Session Guard (getVerifiedSession)
    participant Flow as Access Flow Engine (authorizeAssetAccess)
    participant Oracle as Blockchain Oracle (Chain-1 & Chain-2)
    participant KMS as KMS Enforcement Boundary
    participant Ledger as Atomic Redemption Ledger
    participant Storage as Supabase Storage (Encrypted Vault)
    participant Audit as Audit Subsystem & Chain-1 Anchor

    Note over Client,Audit: STEP 1: AUTHENTICATION & IDENTITY VERIFICATION
    Client->>API: POST /api/assets/decrypt { assetId } (Session Cookie)
    API->>Guard: getVerifiedSession()
    Note over Guard: Verifies JWT signature, user active status, device active status
    Guard-->>API: Validated SessionPayload { userId, role, sessionId, deviceId, tenantId }

    Note over Client,Audit: STEP 2: ACTIVE SESSION & TENANT ISOLATION
    API->>Flow: authorizeAssetAccess(userId, assetId, sessionId, deviceId)
    Flow->>Flow: Verify active unexpired session in store/database
    Flow->>Flow: Verify tenant clearance and asset assignment (can_decrypt == true)

    Note over Client,Audit: STEP 3: DUAL BLOCKCHAIN VERIFICATION
    Flow->>Oracle: verifyChain1Access(userId, assetId)
    Note over Oracle: Checks IdentityRegistry & AssetRegistry on Chain-1
    Oracle-->>Flow: { allowed: true, status: 'AUTHORIZED' }

    Flow->>Oracle: verifyChain2Policy(assetId, sessionId)
    Note over Oracle: Checks KeyLifecycle status == Active & KeyPolicyManager on Chain-2
    Oracle-->>Flow: { allowed: true, status: 'AUTHORIZED' }

    Note over Client,Audit: STEP 4: BOUND TEMPORARY AUTHORIZATION ISSUANCE
    Flow->>Oracle: recordDecryptionAuthorization(authId, userDid, assetId, ...)
    Flow->>KMS: issueTemporaryDecryptionToken({ sub, assetId, tenantId, sessionId, jti, ... })
    Note over KMS: Signs short-lived JWT (TTL 5m-15m) with standard bound claims
    KMS-->>Flow: tempToken
    Flow-->>API: { tempToken, authorized: true, authId }

    Note over Client,Audit: STEP 5: INDEPENDENT KMS ENFORCEMENT & ATOMIC REDEMPTION
    API->>Flow: prepareDecryptionStream(assetId, iv, authTag, tempToken, sessionId)
    Flow->>KMS: fetchAndDecryptDEK(assetId, { token: tempToken, sessionId, authId })
    Note over KMS: Validates signature, claims (sub, assetId, tenantId, operation)
    KMS->>Ledger: redeemTokenAtomically(jti, assetId, sessionId)
    alt Already Redeemed (Replay Attack)
        Ledger-->>KMS: REDEMPTION_FAILED (Duplicate JTI)
        KMS-->>Flow: Throw "Token already redeemed (replay detected)"
    else Fresh Token
        Ledger-->>KMS: REDEMPTION_SUCCESS
    end

    Note over KMS: Rechecks live session & identity revocation status
    KMS->>KMS: Retrieve wrapped DEK from active key version
    KMS->>KMS: deriveKEK(masterKey, assetId) using PBKDF2 with context AAD
    KMS->>KMS: decryptData(wrappedDEK, kek, iv, authTag, AAD)
    Note over KMS: Zeroize KEK; returns plaintext DEK Buffer
    KMS-->>Flow: dekPlaintext

    Note over Client,Audit: STEP 6: AUTHENTICATED STREAMING DECRYPTION
    Flow->>Flow: createDecryptionStream(dekPlaintext, iv, authTag, aadString)
    Note over Flow: Zeroize dekPlaintext buffer immediately (dek.fill(0))
    Flow-->>API: Decipher Stream
    API->>Storage: Stream encrypted asset blob
    Storage-->>API: Encrypted stream
    API->>API: Pipe encrypted stream through Decipher (validates 128-bit GCM tag)

    Note over Client,Audit: STEP 7: DURABLE AUDIT & BLOCKCHAIN ANCHORING
    API->>Audit: logAuditEvent(TEMPORARY_KEY_AUTHORIZED / ASSET_DECRYPTED)
    Note over Audit: Computes SHA-256 hash chain: event_hash = H(prev_hash, event)
    opt Batch Interval Met
        Audit->>Oracle: anchorMerkleRoot(batchStart, batchEnd, merkleRoot)
    end
    API-->>Client: 200 OK { success: true, decryptedData: "..." }
```

---

## 2. Security Boundaries & Failure Behavior

1. **Session Failure**: Session revoked or expired returns HTTP 401 Unauthorized immediately.
2. **Assignment Failure**: User without active `can_decrypt` assignment returns HTTP 403 Forbidden.
3. **Chain-1 / Chain-2 Failure**: Timeout or revert returns HTTP 403 / 503; fails closed.
4. **Replay / Re-use Attempt**: Second attempt using the same `tempToken` fails at Step 5 (`Token already redeemed`).
5. **Ciphertext Tampering**: Bit-flipping causes `decipher.final()` to throw integrity error; connection closed without emitting plaintext.
