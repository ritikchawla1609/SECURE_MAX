# SecureMAX Incident Response & Security Playbook

**Document Version:** 1.0.0  
**Classification:** Restricted / Security Operations Center (SOC) Operational Manual  
**Applies To:** SecureMAX Core Infrastructure, Smart Contracts, KMS, and Cloud Storage  

---

## 1. Incident Severity Classification Matrix

| Level | Identifier | Trigger Conditions | Maximum SLA | Incident Commander |
|---|---|---|---|---|
| **P1** | **CRITICAL** | Master Key compromise, Sentinel unauthorized decryption detection, active DBA data exfiltration, private key leak. | **15 Minutes** | Chief Information Security Officer (CISO) |
| **P2** | **HIGH** | Single asset DEK compromise, blockchain RPC node outage / desync, admin session hijacking, device trust bypass. | **1 Hour** | Lead Security Engineer / SOC Lead |
| **P3** | **MEDIUM** | Repeated brute-force authentication failures, non-fatal Sentinel anomaly, Merkle anchor delay. | **4 Hours** | SOC Analyst on Duty |
| **P4** | **LOW** | Minor audit log formatting anomaly, single-device enrollment code expiration, non-exploitable warning. | **24 Hours** | Security Operations Team |

---

## 2. Threat Vector Playbooks

### 2.1 Playbook A: Credential & Session Compromise

#### Symptoms:
- Concurrent logins detected across divergent geographic IP addresses.
- User session IP mismatch detected in `validateTemporaryDecryptionToken`.
- Web Crypto P-256 public key replacement attempt without step-up authentication.

#### Action Procedures:
1. **Immediate Session Revocation:**
   Invoke the revocation endpoint to terminate the target user's active sessions:
   ```bash
   curl -X POST https://api.securemax.corp/api/devices/revoke \
     -H "Cookie: securemesh_session=$ADMIN_SESSION" \
     -H "Content-Type: application/json" \
     -d '{"targetUserId": "usr_compromised", "revokeAllSessions": true}'
   ```
2. **Device Trust Invalidation:**
   Mark the compromised device hardware fingerprint as `REVOKED` in `deviceStore` / PostgreSQL.
3. **On-Chain Identity Suspension:**
   Admin invokes `IdentityRegistry.updateIdentityStatus(userDid, IdentityStatus.Suspended)`.
4. **Audit Trail Review:**
   Filter audit logs for all events initiated by `usr_compromised` in the preceding 72 hours.

---

### 2.2 Playbook B: Key Material Compromise (DEK or Master Key)

#### Symptoms:
- Stolen ciphertext and wrapped DEK database dump detected.
- Master Key (`SECUREMAX_KMS_MASTER_KEY`) exposed in configuration repository or logs.
- Sentinel alert: `tampered_ciphertext_detected` or `unauthorized_dek_unwrapped`.

#### Action Procedures:
1. **Activate System Panic Lockdown:**
   Immediately trigger emergency panic lockout:
   ```bash
   curl -X POST https://api.securemax.corp/api/admin/panic \
     -H "Cookie: securemesh_session=$ADMIN_SESSION" \
     -H "Content-Type: application/json" \
     -d '{"reason": "Master Key exposure detected in build logs", "lockdownScope": "ALL_DECRYPTION"}'
   ```
   *Impact:* Freezes all decryption unwrapping across both KMS providers; aborts active file streams.
2. **On-Chain Key Revocation:**
   Call `KeyLifecycle.revokeKey(compromisedKeyId)` directly via administrative multi-sig.
3. **Cloud KMS Master Key Rotation:**
   - If using AWS KMS: Invoke `aws kms disable-key` and update `KMS_KEY_ARN` to an uncompromised key ring.
   - If using HashiCorp Vault: Rotate transit key engine version via `vault write -f transit/keys/securemax-key/rotate`.
4. **Ciphertext Re-encryption:**
   Execute offline background worker to decrypt with historical backup key in isolated secure enclave and re-encrypt under newly provisioned Master Key.

---

### 2.3 Playbook C: Blockchain RPC Tampering & Node Desynchronization

#### Symptoms:
- Sentinel alert: `blockchain_rpc_tampered` or `oracle_inconsistent_state`.
- Public client RPC timeouts exceeding 1500ms.
- Conflicting responses between primary RPC and secondary consensus nodes.

#### Action Procedures:
1. **Verify Fail-Closed Invariants:**
   Confirm that all decryption requests are returning HTTP 503 (`BLOCKCHAIN_UNAVAILABLE`). The system must **never** fall back to local assumptions or fail open.
2. **Switch RPC Provider Endpoints:**
   Update `NEXT_PUBLIC_CHAIN_RPC_URL` to failover provider (e.g., Alchemy / Infura / QuickNode failover pool).
3. **Validate Smart Contract State:**
   Execute automated script:
   ```bash
   npm run contracts:test
   ```
   to confirm contract bytecodes and state variables remain intact on the network.

---

### 2.4 Playbook D: Audit Trail Integrity Breaches

#### Symptoms:
- `POST /api/audit/verify` returns `verified: false`.
- Merkle root computed from database records does not match `AuditAnchor.sol` latest anchor.
- Hash chaining discontinuity: $\text{SHA256}(\text{Event}_i \parallel \text{Hash}_{i-1}) \neq \text{Hash}_i$.

#### Action Procedures:
1. **Isolate PostgreSQL Instance:**
   Revoke write permissions for non-essential service accounts to preserve forensic evidence.
2. **Locate Point of Discontinuity:**
   Run the forensic audit integrity utility to identify the exact event record where the chain broke:
   ```bash
   npm run test:audit
   ```
3. **Compare Against On-Chain Anchors:**
   Query `AuditAnchor.getAnchor(anchorIndex)` to determine the last confirmed immutable Merkle root. Any database modification occurring after that anchor index has been tampered with and must be restored from encrypted offsite write-once-read-many (WORM) storage.

---

## 3. Panic Mode & Recovery Workflows

### 3.1 Activating Emergency Panic Mode
The panic endpoint (`/api/admin/panic`) is protected by strict role checks (`UserRole.ADMIN`). When invoked:
1. All pending access requests are purged.
2. Live decryption tokens are blacklisted immediately.
3. The KMS provider rejects all `unwrapDEK` calls.
4. Sentinel switches to active defensive monitoring.
5. All connected client dashboards display emergency incident lockdown banners.

### 3.2 Operational Recovery Procedure
Recovery from panic mode requires authorized administrator quorum:
1. **Threat Elimination Verification:** Root cause identified, credentials rotated, compromised devices purged.
2. **Administrative Recovery Request:**
   ```bash
   curl -X POST https://api.securemax.corp/api/admin/recovery \
     -H "Cookie: securemesh_session=$ADMIN_SESSION" \
     -H "Content-Type: application/json" \
     -d '{"resolutionNotes": "Attacker IP blocked, master key rotated, integrity verified"}'
   ```
3. **Post-Mortem Documentation:** Generate forensic incident report within 24 hours detailing incident timeline, affected assets, and remediation steps.
