# SecureMAX Cryptographic & Security Invariants

> **Status**: FORMAL SECURITY SPECIFICATION  
> **Classification**: CONFIDENTIAL DEFENSE INVARIANTS  
> **Date**: October 2026  

---

## 1. Core Security Invariants

The SecureMAX platform mathematically and architecturally enforces the following nine non-negotiable security invariants across all execution paths.

---

### Invariant 1: Unauthorized Users Cannot Obtain Plaintext Through Any Path
- **Rule**: No user may access or decrypt an asset without an active, explicit assignment where `can_decrypt == true`.
- **Enforcement**: Server-side RBAC and assignment verification in `authorizeAssetAccess` and `prepareDecryptionStream`.
- **Verification**: Sentinel S-01, BreachLab SCN-AUTH-01, automated unit tests.

### Invariant 2: Frontend State Is Never Treated as Proof of Authorization
- **Rule**: Client-side assertions, cookies containing claim flags, or HTTP query parameters are untrusted.
- **Enforcement**: All permissions and roles are authoritatively verified from the server-side session, database records, and smart contracts on each request.
- **Verification**: Sentinel S-04, S-30.

### Invariant 3: The KMS Does Not Trust Client-Supplied Authorization Flags
- **Rule**: The KMS enforcement boundary (`fetchAndDecryptDEK`) will reject any request lacking cryptographically verifiable authorization evidence.
- **Enforcement**: `fetchAndDecryptDEK` independently verifies token cryptographic signature, session binding, and asset binding before releasing a DEK.
- **Verification**: Sentinel S-06, KMS regression tests.

### Invariant 4: Missing Security State Does Not Create an Implicit Grant
- **Rule**: Incomplete records, uninitialized tables, absent users, or missing assignments must fail closed.
- **Enforcement**: Absence of an assignment, user record, or key policy returns `Access Denied` / `403 Forbidden`. Implicit wildcard grants or test-user bypasses are prohibited.
- **Verification**: Sentinel S-14, S-15.

### Invariant 5: Stale Authorization Cannot Silently Override a Revocation
- **Rule**: Revocation of an identity, role, session, or asset assignment takes effect immediately across all subsequent requests.
- **Enforcement**: Live zero-trust checks against `deviceStore` and Supabase `access_sessions` execute on every protected endpoint and within the KMS boundary.
- **Verification**: Sentinel S-03, S-09, BreachLab SCN-AUTH-02.

### Invariant 6: Tokens Cannot Be Substituted Across Contexts
- **Rule**: Authorization tokens issued for User $U_1$, Asset $A_1$, Session $S_1$, Key Version $V_1$ cannot be redeemed for User $U_2$, Asset $A_2$, Session $S_2$, or Key Version $V_2$.
- **Enforcement**: Cryptographic token claims bind `sub`, `assetId`, `sessionId`, `keyVersionId`, `tenantId`, and `operation: "decrypt"`. AES-GCM Additional Authenticated Data (AAD) cryptographically binds the asset ID during key unwrapping and file decryption.
- **Verification**: Sentinel S-07, BreachLab SCN-CRYP-05.

### Invariant 7: All Decryption Paths Use Consistent Enforcement Rules
- **Rule**: Streaming decryption, buffered decryption, and administrative preview must all pass through the identical 12-step authorization pipeline.
- **Enforcement**: Direct access to `fetchAndDecryptDEK` is restricted to server-internal calls carrying validated tokens; all routes funnel through `prepareDecryptionStream`.
- **Verification**: Sentinel S-06, API route tests.

### Invariant 8: Blockchain Evidence Is Checked for Relevance, Freshness, and Integrity
- **Rule**: Blockchain oracle checks must verify that contract responses are unexpired, relevant to the target entity, and originate from the authoritative contract address. Any RPC failure, timeout, or contract revert fails closed.
- **Enforcement**: `src/lib/blockchain/oracle.ts` validates contract status, returns structured status (`AUTHORIZED`, `DENIED`, `UNAVAILABLE`), and denies access on timeouts.
- **Verification**: Sentinel S-22, BreachLab SCN-BC-06.

### Invariant 9: Audit Events Do Not Contain Secrets or Unnecessary Plaintext
- **Rule**: Plaintext file content, raw DEKs, master keys, and passwords must never appear in audit logs, telemetry, terminal logs, or client responses.
- **Enforcement**: Audit event payload sanitization, hash generation, and log redacting in `src/lib/audit/logger.ts` and `src/lib/breachlab/sanitizer.ts`.
- **Verification**: BreachLab sanitizer tests, Sentinel evidence checks.
