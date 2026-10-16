# SecureMAX API Reference Specification

**Version:** 1.0.0  
**Base URL:** `https://<domain>/api` (or `http://localhost:3000/api`)  
**Standard Envelope:** All API responses adhere to the standard envelope format:
```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "meta": {
    "timestamp": "2026-10-15T12:00:00.000Z",
    "requestId": "req_..."
  }
}
```
When an error occurs, `success` is `false`, `data` is `null`, and `error` contains:
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "Safe human-readable error description without sensitive details."
  },
  "meta": {
    "timestamp": "2026-10-15T12:00:00.000Z"
  }
}
```

---

## 1. Authentication & Session Endpoints

### 1.1 `POST /api/auth/challenge`
- **Description:** Generates a cryptographically random, single-use authentication challenge for either MetaMask EVM address or Web Crypto P-256 public key.
- **Auth Required:** None (Public).
- **Request Body:**
  ```json
  {
    "address": "0x1234567890abcdef1234567890abcdef12345678", // Optional for EVM
    "userId": "did:securemax:usr_...",                       // Optional for P-256
    "algorithm": "ECDSA_P256_SHA256"                          // Optional
  }
  ```
- **Response `200 OK`:**
  ```json
  {
    "challengeId": "chl_01H...",
    "nonce": "a4f8e91c...",
    "message": "SecureMAX Authentication Challenge\nNonce: a4f8e91c...\nTimestamp: 1729000000",
    "expiresAt": "2026-10-15T12:02:00.000Z"
  }
  ```
- **Errors:** `400 VALIDATION_ERROR`, `429 RATE_LIMITED`

### 1.2 `POST /api/auth/login`
- **Description:** Authenticates user via signed cryptographic challenge (MetaMask SIWE signature or Web Crypto P-256 signature) or email/password fallback. Sets `securemesh_session` HttpOnly cookie.
- **Auth Required:** None (Public).
- **Request Body (Web3 / P-256):**
  ```json
  {
    "type": "METAMASK",
    "address": "0x1234567890abcdef1234567890abcdef12345678",
    "signature": "0xabc...",
    "challengeId": "chl_01H..."
  }
  ```
- **Response `200 OK`:**
  ```json
  {
    "sessionToken": "eyJhbGciOi...",
    "user": {
      "id": "usr_01H...",
      "did": "did:securemax:0x1234...",
      "email": "admin@securemax.corp",
      "name": "Security Administrator",
      "role": "ADMIN",
      "status": "ACTIVE"
    }
  }
  ```
- **Errors:** `401 AUTH_FAILED`, `400 VALIDATION_ERROR`

### 1.3 `POST /api/auth/register`
- **Description:** Registers a new user identity, assigns role, and records public key in Identity Registry.
- **Auth Required:** None or Admin depending on registration policy.
- **Request Body:**
  ```json
  {
    "email": "analyst@securemax.corp",
    "name": "Sarah Connor",
    "password": "SecurePassword#2026",
    "publicKey": "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE...",
    "algorithm": "ECDSA_P256_SHA256"
  }
  ```
- **Response `201 Created`:**
  ```json
  {
    "userId": "usr_01H...",
    "did": "did:securemax:usr_01H...",
    "status": "ACTIVE"
  }
  ```

### 1.4 `GET /api/auth/session`
- **Description:** Validates active session cookie and returns current user identity, role, and registered devices.
- **Auth Required:** Active `securemesh_session` cookie.
- **Response `200 OK`:**
  ```json
  {
    "user": {
      "id": "usr_01H...",
      "email": "user@securemax.corp",
      "role": "USER",
      "did": "did:securemax:0x..."
    },
    "deviceId": "dev_01H...",
    "assuranceLevel": "HIGH"
  }
  ```
- **Errors:** `401 AUTH_REQUIRED`

### 1.5 `POST /api/auth/logout`
- **Description:** Invalidates the server-side session in `deviceStore` / PostgreSQL and clears the session cookie.
- **Auth Required:** Active `securemesh_session` cookie.
- **Response `200 OK`:** `{ "success": true }`

---

## 2. Asset & Cryptography Endpoints

### 2.1 `POST /api/assets/upload`
- **Description:** Ingests document file stream, triggers KMS envelope encryption (AES-256-GCM), records wrapped DEK in database, and registers asset in Chain-1 `AssetRegistry.sol`.
- **Auth Required:** Active session (`USER`, `ADMIN`, `SECURITY_OFFICER`).
- **Request Format:** `multipart/form-data`
  - `file`: Binary file stream
  - `name`: String filename
  - `classification`: `"PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED" | "TOP_SECRET"`
  - `description`: String description
- **Response `201 Created`:**
  ```json
  {
    "assetId": "ast_01H...",
    "contentHash": "0x7f83b165...",
    "encryptedSize": 1048576,
    "keyVersion": "v1",
    "classification": "CONFIDENTIAL",
    "status": "ENCRYPTED"
  }
  ```
- **Errors:** `400 VALIDATION_ERROR`, `401 AUTH_REQUIRED`, `503 STORAGE_ERROR`

### 2.2 `POST /api/assets/action`
- **Description:** Requests authorization clearance to decrypt or share an asset. Evaluates Chain-1 RBAC and Chain-2 Key Policies. On success, issues a temporary, short-lived (5-minute TTL) Decryption Token.
- **Auth Required:** Active session.
- **Request Body:**
  ```json
  {
    "assetId": "ast_01H...",
    "action": "DECRYPT_REQUEST",
    "reason": "Incident triage report review"
  }
  ```
- **Response `200 OK`:**
  ```json
  {
    "temporaryDecryptionToken": "eyJhbGciOi...",
    "expiresAt": "2026-10-15T12:05:00.000Z",
    "assetId": "ast_01H...",
    "clearanceGranted": true
  }
  ```
- **Errors:** `403 ACCESS_DENIED`, `401 AUTH_REQUIRED`, `503 BLOCKCHAIN_UNAVAILABLE`

### 2.3 `GET /api/assets/decrypt`
- **Description:** Streams decrypted binary plaintext. Requires both the `securemesh_session` cookie and the `x-decryption-token` HTTP header. Unwraps DEK via KMS, verifies canonical AAD, decrypts stream with AES-256-GCM, and zeroizes key material in memory.
- **Auth Required:** Active session + Valid unexpired temporary decryption token bound to session and client IP.
- **Request Headers:**
  - `Cookie: securemesh_session=<jwt>`
  - `x-decryption-token: <temp_token>`
  - `x-asset-id: <assetId>`
- **Response `200 OK`:** Binary stream (`application/octet-stream` or MIME type).
- **Errors:** `401 AUTH_REQUIRED`, `403 TOKEN_EXPIRED`, `403 IP_MISMATCH`, `403 KEY_REVOKED`, `500 DECRYPTION_FAILED`

### 2.4 `POST /api/assets/share`
- **Description:** Assigns read or decrypt permissions for an asset to another user DID. Calls `AssetRegistry.assignAsset`.
- **Auth Required:** Asset owner or `ADMIN`.
- **Request Body:**
  ```json
  {
    "assetId": "ast_01H...",
    "targetUserDid": "did:securemax:usr_target",
    "permission": "READ_DECRYPT",
    "expiresAt": "2026-10-22T00:00:00.000Z"
  }
  ```
- **Response `200 OK`:** `{ "shared": true, "assignmentId": "asg_01H..." }`

---

## 3. Device Trust & Assurance Endpoints

### 3.1 `POST /api/devices/enrollment/start`
- **Description:** Initiates hardware device trust enrollment. Issues a cryptographically secure 6-digit one-time security code.
- **Auth Required:** Active session.
- **Request Body:**
  ```json
  {
    "deviceName": "MacBook Pro M3 Max",
    "deviceType": "LAPTOP",
    "platform": "macOS 15.0"
  }
  ```
- **Response `200 OK`:**
  ```json
  {
    "enrollmentId": "enr_01H...",
    "securityCode": "849201",
    "expiresAt": "2026-10-15T12:10:00.000Z"
  }
  ```

### 3.2 `POST /api/devices/enrollment/verify`
- **Description:** Submits the 6-digit security code and client hardware fingerprint telemetry to complete device enrollment and establish baseline assurance level.
- **Auth Required:** Active session.
- **Request Body:**
  ```json
  {
    "enrollmentId": "enr_01H...",
    "code": "849201",
    "fingerprint": {
      "webglRenderer": "Apple M3 Max",
      "hardwareConcurrency": 16,
      "screenResolution": "3024x1964",
      "userAgent": "Mozilla/5.0..."
    }
  }
  ```
- **Response `200 OK`:**
  ```json
  {
    "enrolled": true,
    "deviceId": "dev_01H...",
    "assuranceLevel": "HARDENED"
  }
  ```

### 3.3 `POST /api/devices/revoke`
- **Description:** Revokes trust for a compromised or lost device. Immediately terminates all active sessions associated with the device.
- **Auth Required:** Device owner or `ADMIN`.

---

## 4. Administrative & Governance Endpoints

### 4.1 `POST /api/admin/panic`
- **Description:** Emergency system-wide lockdown. Revokes active sessions, freezes key release on KMS, and switches Sentinel into lockdown posture.
- **Auth Required:** Verified `ADMIN` session only.
- **Request Body:**
  ```json
  {
    "reason": "Suspected exfiltration attempt on confidential radar assets",
    "lockdownScope": "ALL_DECRYPTION"
  }
  ```
- **Response `200 OK`:** `{ "status": "PANIC_LOCKDOWN_ACTIVE" }`

### 4.2 `POST /api/admin/recovery`
- **Description:** Restores normal platform operations following security incident resolution. Requires secondary administrative quorum verification.
- **Auth Required:** Verified `ADMIN` session with multi-sig approval.

### 4.3 `GET /api/admin/security-status`
- **Description:** Returns real-time security posture: active nodes, Sentinel threat status, KMS provider health, and unanchored audit batch size.
- **Auth Required:** `ADMIN` or `SECURITY_OFFICER`.

---

## 5. Audit & Telemetry Endpoints

### 5.1 `POST /api/audit/verify`
- **Description:** Verifies an off-chain audit record against the on-chain Merkle root anchored in Chain-1 `AuditAnchor.sol`.
- **Auth Required:** Authenticated user or `AUDITOR`.
- **Request Body:**
  ```json
  {
    "eventId": "evt_01H...",
    "eventHash": "0x4e07408562bedb8b60ce05c1decfe3ad16b72230967de01f640b7e4729b49fce",
    "anchorIndex": 1
  }
  ```
- **Response `200 OK`:**
  ```json
  {
    "verified": true,
    "onChainRoot": "0x12a8b7...",
    "blockNumber": 6512390,
    "timestamp": "2026-10-15T10:00:00.000Z"
  }
  ```

---

## 6. Safe Error Response Architecture

SecureMAX endpoints enforce defense-in-depth in error handling:
1. **No Stack Trace Leakage:** Server exceptions are caught, logged internally with full stack traces to secure audit sinks, and returned to clients as safe generic codes (`INTERNAL_ERROR`).
2. **Timing Attack Protection:** Authentication and challenge endpoints return deterministic generic messages (`AUTH_FAILED`) regardless of whether the user exists or the password/signature failed.
3. **Cryptographic Key Shielding:** Raw DEKs, KEKs, and Master Keys are never serialized into error objects or response bodies.
