# API Reference — Auth & KYC Service (Person 1)

Base URL: `http://localhost:4001`
Content type: `application/json`

Errors always have the shape:

```json
{ "error": { "code": "MACHINE_CODE", "message": "safe description", "details": [] } }
```

Authenticated endpoints accept either `Authorization: Bearer <token>` or the
`sid` HttpOnly cookie set at login.

---

## POST /api/auth/register

Creates the account and registers the user's public key. Public.

```json
{
  "email": "alice@example.test",
  "name": "Alice Example",
  "phone": "+911234567890",
  "algorithm": "ECDSA_P256_SHA256",
  "publicKey": "<base64 SPKI DER>"
}
```

`201`

```json
{
  "userId": "uuid",
  "email": "alice@example.test",
  "kycStatus": "PENDING",
  "identity": { "algorithm": "ECDSA_P256_SHA256", "publicKeyFingerprint": "sha256:..." },
  "createdAt": "2026-01-01T10:00:00.000Z"
}
```

Errors: `400 VALIDATION_ERROR`, `400 INVALID_PUBLIC_KEY`, `400 UNSUPPORTED_ALGORITHM`,
`409 EMAIL_IN_USE`, `409 PUBLIC_KEY_IN_USE`, `429 RATE_LIMITED` (10/hour per IP).

A request containing a `privateKey` field is rejected with `400`.

---

## POST /api/auth/challenge

Issues the message to be signed. Public. Supply `userId` **or** `email`.

`200`

```json
{
  "userId": "uuid",
  "challengeId": "uuid",
  "algorithm": "ECDSA_P256_SHA256",
  "message": "did-auth-v1\ndomain: localhost\nuserId: ...",
  "expiresAt": "2026-01-01T10:02:00.000Z"
}
```

Unknown accounts also receive `200` with a well-formed decoy challenge, so this
endpoint cannot be used to test whether an email is registered. Such a challenge
always fails at `/verify`. Any previously unused challenge for the user is
invalidated. Limit: 20/min per IP.

---

## POST /api/auth/verify

Exchanges a signature for a session.

```json
{ "userId": "uuid", "challengeId": "uuid", "signature": "<base64>" }
```

`200`

```json
{
  "token": "<opaque session token>",
  "sessionId": "uuid",
  "expiresAt": "2026-01-01T11:00:00.000Z",
  "user": {
    "userId": "uuid", "email": "...", "name": "...",
    "kycStatus": "PENDING", "publicKeyFingerprint": "sha256:..."
  }
}
```

Also sets `sid` (HttpOnly, SameSite=Strict, Secure when `COOKIE_SECURE=true`).

Errors: `401 AUTH_FAILED` for **every** failure — unknown user, expired,
reused or unknown challenge, wrong signature, wrong key — deliberately
indistinguishable; the reason is written only to the audit log.
`429 AUTH_TEMPORARILY_LOCKED` after 5 failures (5 min).

A session is issued regardless of KYC status; `kycStatus` is carried on the
session so callers can gate their own operations. Otherwise a `PENDING` user
could never authenticate to submit their KYC.

---

## GET /api/auth/me

Authenticated. Returns `userId`, `email`, `name`, `kycStatus`, `isReviewer`,
the active identity's algorithm and fingerprint, and session expiry.
`401 UNAUTHENTICATED` / `401 INVALID_SESSION`.

## POST /api/auth/logout

Authenticated. Revokes the current session and clears the cookie. `200 {"loggedOut": true}`.

## POST /api/auth/identity/rotate

Authenticated. `{ "algorithm": "...", "publicKey": "<base64 SPKI DER>" }`.
Revokes the old key and **all** sessions; the user must log in again with the
new key. Limit: 5/hour per user.

## GET /api/auth/identity/:userId

Public verification material: `algorithm`, `publicKey`, `publicKeyFingerprint`,
`kycStatus`. No PII. `404 IDENTITY_NOT_FOUND`.

---

## POST /api/kyc/submit

Authenticated. Off-chain only.

```json
{ "dateOfBirth": "1998-04-12", "governmentIdReference": "DEMO-ID-0042" }
```

`201 { "recordId": "uuid", "status": "PENDING", "submittedAt": "..." }`

Resubmission overwrites a `PENDING` or `REJECTED` record. Errors:
`400 VALIDATION_ERROR` (age must be 18–120; reference is 4–64 chars of
`[A-Za-z0-9-]`), `409 KYC_ALREADY_VERIFIED`, `429 RATE_LIMITED` (5/hour per user).

## POST /api/kyc/verify

Authenticated **reviewer**.

```json
{ "userId": "uuid", "decision": "VERIFIED", "reason": "optional" }
```

`reason` is required when rejecting. `REJECTED` revokes all of that user's
sessions. `200 { "userId": "...", "kycStatus": "VERIFIED", "updatedAt": "..." }`.
Errors: `403 REVIEWER_REQUIRED`, `403 SELF_REVIEW_FORBIDDEN`,
`404 KYC_NOT_SUBMITTED`, `409 KYC_ALREADY_DECIDED`.

## GET /api/kyc/status

Authenticated. Own status and submission metadata. Never returns the submitted
date of birth or ID reference.

## GET /api/kyc/pending

Authenticated reviewer. Queue of `{ userId, recordId, submittedAt }`. No PII.

---

## Internal (server-to-server)

Header: `X-Internal-Api-Key: <INTERNAL_API_KEY>`, compared in constant time.
Never expose these to the browser.

### GET /api/internal/identities/:userId

```json
{
  "userId": "uuid",
  "algorithm": "ECDSA_P256_SHA256",
  "publicKey": "<base64 SPKI DER>",
  "publicKeyFingerprint": "sha256:...",
  "kycStatus": "VERIFIED",
  "identityCreatedAt": "..."
}
```

### POST /api/internal/sessions/introspect

`{ "token": "<session token>" }` →
`{ "active": true, "userId": "uuid", "kycStatus": "VERIFIED", "expiresAt": "..." }`
or `{ "active": false }`.

---

## GET /health

`{ "status": "ok", "service": "auth-kyc", "env": "development" }`
