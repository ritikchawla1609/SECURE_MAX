# Auth & KYC Service (Person 1)

Backend module for the decentralised identity / RBAC / NFT platform.
Owns **KYC registration and verification**, **challenge–response cryptographic
authentication**, and **session management**. Nothing else.

Not in this module (owned by others): DID contracts (Person 2), RBAC contracts
(Person 3), NFT/asset logic (Person 4), frontend (Person 5). There is no
MetaMask or wallet-extension code anywhere in this service.

---

## Two rules this module is built around

**1. The backend never sees a private key.**
The client generates its own key pair with the Web Crypto API and sends only the
public key (base64 SPKI DER). No endpoint accepts a private key, and
`registerSchema` is `.strict()`, so a request containing a `privateKey` field is
rejected with 400 rather than quietly ignored. Signing happens on the client.

**2. KYC data never goes on-chain.**
KYC lives in PostgreSQL. Date of birth and the government ID reference are
AES-256-GCM encrypted at rest and are never returned by any endpoint. The
server-to-server interface exposed to Persons 2/3/4 returns identifiers, public
keys and KYC *status* only, so no downstream module can write PII to a contract
even by mistake.

---

## Setup

```bash
cd backend
cp .env.example .env          # then fill in the two generated secrets
npm install
createdb identity_platform
npm run migrate
npm start                     # http://localhost:4001
```

Generate the secrets:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"        # KYC_ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"  # INTERNAL_API_KEY
```

`npm start` refuses to boot if either is missing or too short.

### Bootstrapping a reviewer

Somebody has to approve the first KYC submission:

```bash
# register the reviewer's account through the API first, then:
npm run seed:reviewer -- reviewer@example.test
```

### Try the whole flow

```bash
node client-example/client-keys.mjs http://localhost:4001 alice@example.test "Alice"
```

This generates a key pair, registers, requests a challenge, signs it locally and
logs in. It is also the reference implementation for Person 5.

---

## Authentication flow

```
client                                    server
------                                    ------
generate P-256 key pair (local)
POST /api/auth/register {publicKey}  -->  store public key, kyc_status=PENDING
POST /api/auth/challenge {userId}    -->  random 256-bit nonce, single-use, 120s TTL
                                     <--  full message to sign
sign(message) with private key
POST /api/auth/verify {signature}    -->  consume challenge, verify signature
                                     <--  session token (+ HttpOnly cookie)
```

The signed message binds domain, userId, challengeId, nonce and both timestamps,
so a captured signature is useless for another user, another challenge or
another deployment.

```
did-auth-v1
domain: localhost
userId: <uuid>
challengeId: <uuid>
nonce: <base64url, 32 bytes>
issuedAt: <ISO-8601>
expiresAt: <ISO-8601>
```

Sign the string **verbatim** as UTF-8 (LF line endings, no trailing newline).
The server always returns the full message — never rebuild it client-side.

Supported suites: `ECDSA_P256_SHA256` (default; Web Crypto emits raw r||s, which
the server verifies with `dsaEncoding: 'ieee-p1363'`) and `ED25519`.

---

## Security controls

| Threat | Control |
|---|---|
| Replay of a captured signature | Challenge consumed by an atomic single-use `UPDATE`, before verification |
| Stale challenge | 120s TTL enforced in SQL; issuing a new challenge invalidates the old one |
| Cross-user / cross-deployment replay | userId and domain are inside the signed message |
| Brute force | Per-IP rate limits plus per-user lockout after 5 failures (5 min) |
| User enumeration | `/challenge` returns a decoy challenge for unknown accounts; every `/verify` failure returns the same 401 `AUTH_FAILED` |
| Session theft from a DB dump | Only the SHA-256 hash of the token is stored |
| SQL injection | Parameterised queries only; no string-built SQL |
| Mass assignment | `.strict()` zod schemas; unknown fields rejected |
| Sensitive data exposure | Encrypted KYC fields, redacting logger, generic 500s, IPs stored only as hashes |
| Session lifetime | 1h expiry, revocation on logout, on key rotation and on KYC rejection |

Rate limiting and lockout are deliberate trade-offs, not perfect defences — see
Known limitations.

---

## Tests

```bash
npm run test:unit    # crypto suite, no database needed
npm test             # full suite; integration tests need TEST_DATABASE_URL
```

```bash
createdb identity_platform_test
NODE_ENV=test npm run migrate
npm test
```

Covered: valid/invalid registration, duplicate email, invalid public key, a
private key submitted as a public key, KYC submit/verify/reject, reviewer
authorisation, valid signature, invalid signature, signature from the wrong key,
expired challenge, reused challenge, superseded challenge, account lockout,
session expiry, logout revocation, encryption at rest, injection-style input,
and the internal interface.

---

## Known limitations

- **Prototype KYC.** A human clicks approve. No document authenticity, liveness,
  sanctions or government data source. Do not present this as real KYC.
- **Reviewer authorisation is interim.** It uses a local `users.is_reviewer`
  flag; the project's authoritative RBAC is Person 3's on-chain module.
- **Rate limiting is per process.** In-memory fixed windows; needs a shared
  store (Redis) before running more than one instance.
- **Encryption key lives in the environment.** Protects database dumps, not a
  compromised application process. A KMS/HSM would be the production answer.
- **No key recovery.** Lose the private key and the account is unreachable
  until an out-of-band reset process is agreed with the team.
- **No email/phone ownership verification** (no confirmation link or OTP).
- **Session tokens are bearer tokens.** Prefer the HttpOnly cookie in the
  browser; if Person 5 stores the token in JS, any XSS is a session compromise.
- **Audit log is off-chain and mutable by a DB admin**, unlike the on-chain
  trail owned by Persons 2/3/4.
