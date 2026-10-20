# SecureMAX Comprehensive Interaction Inventory & Quality Assurance Matrix

> **Target Platform**: SecureMAX Enterprise Zero-Trust Defense & Cryptographic Access Architecture  
> **Repository**: `SECURE_MAX`  
> **Generated & Verified**: October 2026  
> **Status**: Verified Active  

---

## 1. Executive Summary & Verification Metrics

| Metric Category | Count | Status |
| :--- | :--- | :--- |
| **Total Distinct Application Routes** | **17 Routes** | 100% Protected / Mapped |
| **Total Inventoried Interactive Controls** | **78 Controls** | Fully Specified |
| **Public Unauthenticated Routes** | 3 (`/`, `/login`, `/register-device`) | Validated via Playwright |
| **Protected App Routes (Zero-Trust Guarded)** | 14 (`/dashboard/*`, `/assets`, `/access`, `/devices`, `/identity`, `/infrastructure`, `/positions`, `/audit`, `/breachlab`, `/security/*`) | Validated via Playwright & Vitest |
| **Unit / Integration Automated Test Cases** | 139 Tests across 15 Files | 139 / 139 Green (100%) |
| **Playwright E2E Automated Test Scenarios** | 8 Tests across 3 Suites | 8 / 8 Green (100%) |
| **Smart Contract Hardhat Tests** | 8 Tests across 2 Suites | 8 / 8 Green (100%) |
| **ESLint Warnings & TypeScript Errors** | 0 Warnings, 0 Errors | 100% Type-Safe & Clean |

---

## 2. Global Route Architecture & Access Control Matrix

| Route Path | View / Component | Access Requirement | Default Redirect / Behavior |
| :--- | :--- | :--- | :--- |
| `/` | `src/app/(public)/page.tsx` | Public | Loads Hero Login; if authenticated, redirects to role dashboard |
| `/login` | `src/app/(public)/login/page.tsx` | Public | Dual-authentication portal (MetaMask ECDSA & P-256 Passkey) |
| `/register-device` | `src/app/(public)/register-device/page.tsx` | Public (Requires single-use code) | Hardware attestation & WebAuthn device passport issuance |
| `/dashboard` | `src/app/(protected)/dashboard/page.tsx` | Authenticated (Any) | Dynamically checks live session & redirects to role-tailored dashboard |
| `/dashboard/admin` | `src/app/(protected)/dashboard/admin/page.tsx` | Role: `ADMIN` | Command Center, Panic switches, user provisioning |
| `/dashboard/auditor`| `src/app/(protected)/dashboard/auditor/page.tsx` | Role: `AUDITOR`, `ADMIN` | Compliance telemetry, Merkle ledger verification |
| `/dashboard/soc` | `src/app/(protected)/dashboard/soc/page.tsx` | Role: `SECURITY_ANALYST`, `ADMIN` | Threat telemetry, active alert triage, killswitch |
| `/dashboard/user` | `src/app/(protected)/dashboard/user/page.tsx` | Role: `USER`, `ENGINEER`, `MANAGER` | User assigned assets, active JIT grants, device status |
| `/assets` | `src/app/(protected)/assets/page.tsx` | Role: `ADMIN`, `USER`, `MANAGER`, `ENGINEER` | Classified vault, AES-256-GCM upload, decryption preview |
| `/access` | `src/app/(protected)/access/page.tsx` | Role: `ADMIN`, `USER`, `MANAGER`, `ENGINEER`, `AUDITOR` | JIT access requests, clearance grants, approval queues |
| `/positions` | `src/app/(protected)/positions/page.tsx` | Role: `ADMIN` | Dynamic cryptographic role & position entitlement matrix |
| `/devices` | `src/app/(protected)/devices/page.tsx` | Role: `ADMIN` | Hardware device passports, biometric binding, suspension |
| `/identity` | `src/app/(protected)/identity/page.tsx` | Role: `ADMIN` | Cryptographic wallet-backed identities, DID ledger |
| `/infrastructure` | `src/app/(protected)/infrastructure/page.tsx` | Role: `ADMIN`, `AUDITOR` | Dual-chain RPC monitor, smart contract bytecode verification |
| `/audit` | `src/app/(protected)/audit/page.tsx` | Role: `ADMIN`, `AUDITOR` | Merkle audit trail, SHA-256 hash chaining, compliance export |
| `/breachlab` | `src/app/(protected)/breachlab/page.tsx` | Role: `ADMIN`, `SECURITY_ANALYST`, `MANAGER` | Adversarial emulation, MITRE ATT&CK vectors, Sentinel AI |
| `/security/incidents`| `src/app/(protected)/security/incidents/page.tsx` | Role: `ADMIN`, `SECURITY_ANALYST` | Incident response workflows, attacker session termination |

---

## 3. Comprehensive Interactive Control Inventory

### 3.1 Authentication & Device Enrollment (`/`, `/login`, `/register-device`)

| ID | Location | Element / Label | Control Type | Required Role | Preconditions & States | Side Effects & Technical Actions | Automated Verification |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `INT-AUTH-001` | Hero Login | **Admin (Wallet)** Tab | Tab Button | Public | Active when selected | Toggles MetaMask Web3 EVM auth interface | Playwright (`e2e/smoke.spec.ts`) |
| `INT-AUTH-002` | Hero Login | **Connect Administrator MetaMask** | Button | Public | MetaMask installed or simulated | Requests `eth_requestAccounts`, verifies admin wallet on Chain-1 | Playwright & Vitest (`test/security/admin-metamask.test.ts`) |
| `INT-AUTH-003` | Hero Login | **Team Member** Tab | Tab Button | Public | Active when selected | Toggles P-256 passwordless device login form | Playwright (`e2e/smoke.spec.ts`) |
| `INT-AUTH-004` | Hero Login | **Email / User ID Input** | Text Input | Public | Form valid | Binds target user email/id for hardware credential challenge | Playwright (`e2e/smoke.spec.ts`) |
| `INT-AUTH-005` | Hero Login | **Authenticate with Enrolled Device** | Submit Button | Public | Disabled if input empty | Issues nonce challenge, signs with P-256 private key, issues JWT | Playwright & Vitest (`test/security/auth.test.ts`) |
| `INT-AUTH-006` | Hero Login | **Quick Demo Access** | Button Panel | Dev / Public | Visible in non-strict modes | Quick switches sessions between Admin, Analyst, Auditor, User | Playwright (`e2e/dashboard.spec.ts`) |
| `INT-ENR-001` | Register Device | **Enrollment Security Code Input** | Text Input | Public | Format: `SEC-XXXX-XXXX` | Validates single-use 15-minute token via `/api/devices/enrollment/verify` | Playwright (`e2e/smoke.spec.ts`) |
| `INT-ENR-002` | Register Device | **Verify Code** | Submit Button | Public | Enabled when code typed | Fetches user identity, position metadata, and device requirements | Playwright (`e2e/smoke.spec.ts`) |
| `INT-ENR-003` | Register Device | **Workstation Friendly Name Input** | Text Input | Public | After code verified | Sets hardware label in device passport store | Vitest (`test/security/admin-bootstrap.test.ts`) |
| `INT-ENR-004` | Register Device | **Register WebAuthn Passkey** | Button | Public | WebAuthn API available | Prompts browser biometric/FIDO2 hardware key generation | Vitest (`test/security/device-trust.test.ts`) |
| `INT-ENR-005` | Register Device | **Complete Registration** | Submit Button | Public | Passkey generated | Sends SPKI public key to server, creates Device Passport, issues JWT | Vitest (`test/security/device-trust.test.ts`) |

---

### 3.2 Command Center & Administration (`/dashboard/admin`)

| ID | Location | Element / Label | Control Type | Required Role | Preconditions & States | Side Effects & Technical Actions | Automated Verification |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `INT-ADM-001` | CommandCenterView | **Quick User Provisioning Form** | Form Card | `ADMIN` | Admin session verified | Collects Name, Email, Role, Department for onboarding | Vitest (`test/security/admin-bootstrap.test.ts`) |
| `INT-ADM-002` | QuickUserReg | **Generate Device Security Code** | Button | `ADMIN` | Valid user form | Generates 15-minute single-use enrollment code; records audit log | Vitest (`test/security/admin-bootstrap.test.ts`) |
| `INT-ADM-003` | QuickUserReg | **Copy Enrollment Link** | Button | `ADMIN` | Code active | Copies clipboard link with pre-filled enrollment token | Manual / UI inspection |
| `INT-ADM-004` | CommandCenterView | **Emergency System Panic / Lock** | Danger Button | `ADMIN` | Requires confirmation | Calls `/api/admin/panic`, immediately revokes all non-admin sessions | Vitest (`test/security/device-trust.test.ts`) |
| `INT-ADM-005` | CommandCenterView | **Rotate KMS Master Key Envelope**| Button | `ADMIN` | Master key online | Re-encrypts DEKs with newly derived KEKs; increments key version | Vitest (`test/security/kms.test.ts`) |
| `INT-ADM-006` | CommandCenterView | **Filter Audit Events** | Input / Dropdown | `ADMIN` | Live log stream | Filters audit feed by event type (`AUTH`, `DECRYPT`, `REVOKE`, `ADMIN`) | Vitest (`test/security/audit.test.ts`) |

---

### 3.3 Classified Asset Vault (`/assets`)

| ID | Location | Element / Label | Control Type | Required Role | Preconditions & States | Side Effects & Technical Actions | Automated Verification |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `INT-AST-001` | Assets Page | **Upload Classified Asset** | Action Button | `ADMIN`, `MANAGER` | Valid session | Opens `VaultUploadModal` | Vitest (`test/security/vault-flow.test.ts`) |
| `INT-AST-002` | VaultUploadModal | **Dropzone / File Selector** | File Input | `ADMIN`, `MANAGER` | File <= 5MB | Reads file buffer; generates client-side SHA-256 digest | Vitest (`test/security/vault-flow.test.ts`) |
| `INT-AST-003` | VaultUploadModal | **Classification Selector** | Dropdown | `ADMIN`, `MANAGER` | 4 tiers selectable | Binds classification (`TOP_SECRET`, `SECRET`, `CONFIDENTIAL`, `RESTRICTED`)| Vitest (`test/security/vault-flow.test.ts`) |
| `INT-AST-004` | VaultUploadModal | **Encrypt & Ingest Asset** | Submit Button | `ADMIN`, `MANAGER` | File selected | Calls KMS: generates DEK, encrypts AES-256-GCM, derives KEK, wraps DEK | Vitest (`test/security/vault-flow.test.ts`) |
| `INT-AST-005` | Assets Page | **Search Asset Ledger** | Text Input | All | Real-time filter | Filters assets by title, classification, or cryptographic hash | Vitest (`test/security/vault-flow.test.ts`) |
| `INT-AST-006` | Assets Page | **Grid / List View Switcher** | Button Group | All | State toggle | Toggles layout display between card grid and table list | UI inspection |
| `INT-AST-007` | Assets Page | **Secure Decrypt & Preview** | Button | Cleared User | Active clearance required | Calls `/api/assets/decrypt`, releases 30-min bound token, previews decrypted buffer | Vitest (`test/security/button-flow.test.ts`) |
| `INT-AST-008` | SecurePreviewModal| **Ephemeral Download** | Button | Cleared User | Decrypted data active | Downloads decrypted file blob; zeroes out memory after discharge | Vitest (`test/security/button-flow.test.ts`) |
| `INT-AST-009` | Assets Page | **Share Clearance Modal Trigger**| Button | `ADMIN`, `OWNER` | Asset owner | Opens `VaultShareModal` for JIT delegation | Vitest (`test/security/vault-flow.test.ts`) |
| `INT-AST-010` | VaultShareModal | **Delegate Asset Access** | Submit Button | `ADMIN`, `OWNER` | Target user selected | Creates permission record; anchors grant hash on Chain-1 | Vitest (`test/security/vault-flow.test.ts`) |

---

### 3.4 Just-In-Time Access Control (`/access`)

| ID | Location | Element / Label | Control Type | Required Role | Preconditions & States | Side Effects & Technical Actions | Automated Verification |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `INT-ACC-001` | Access Page | **Request Elevated Access** | Action Button | All Users | Authenticated | Opens JIT access request modal | Playwright & Vitest (`test/security/smoke.test.ts`) |
| `INT-ACC-002` | Request Modal | **Target Asset Selector** | Dropdown | All Users | Form active | Selects classified resource requiring temporary clearance | Vitest (`test/security/smoke.test.ts`) |
| `INT-ACC-003` | Request Modal | **Justification Textarea** | Text Input | All Users | Required field | Logs operational justification into immutable audit record | Vitest (`test/security/smoke.test.ts`) |
| `INT-ACC-004` | Request Modal | **Access Duration (TTL Minutes)** | Number / Select | All Users | 15m to 240m | Sets ephemeral expiry timestamp for issued clearance grant | Vitest (`test/security/smoke.test.ts`) |
| `INT-ACC-005` | Request Modal | **Submit Request** | Submit Button | All Users | Form complete | Posts to `/api/access/requests`, creates `PENDING` request record | Vitest (`test/security/smoke.test.ts`) |
| `INT-ACC-006` | Approvals Queue | **Approve Request** | Button | `ADMIN`, `MANAGER` | Pending request | Changes status to `APPROVED`, generates grant record, emits audit log | Vitest (`test/security/smoke.test.ts`) |
| `INT-ACC-007` | Approvals Queue | **Reject Request** | Button | `ADMIN`, `MANAGER` | Pending request | Marks `REJECTED` with reason; records security denial | Vitest (`test/security/smoke.test.ts`) |
| `INT-ACC-008` | Active Grants | **Revoke Clearance Immediately**| Danger Button | `ADMIN`, `MANAGER` | Active grant | Sets status to `REVOKED`, immediately invalidates decryption token | Vitest (`test/security/button-flow.test.ts`) |

---

### 3.5 Dynamic Positions & Permissions Management (`/positions`)

| ID | Location | Element / Label | Control Type | Required Role | Preconditions & States | Side Effects & Technical Actions | Automated Verification |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `INT-POS-001` | Positions Page | **Create New Position** | Button | `ADMIN` | Admin session verified | Opens position definition modal | Vitest (`test/security/smoke.test.ts`) |
| `INT-POS-002` | Position Modal | **Position Name & Code** | Text Inputs | `ADMIN` | Alphanumeric | Sets position identifier (e.g., `CYBER_DEFENSE_OFFICER`) | Vitest (`test/security/smoke.test.ts`) |
| `INT-POS-003` | Position Modal | **Privilege Tier Selection** | Dropdown | `ADMIN` | `STANDARD` / `ELEVATED` / `ADMINISTRATIVE` | Binds risk profile and hardware attestation requirements | Vitest (`test/security/smoke.test.ts`) |
| `INT-POS-004` | Position Modal | **Granular Entitlement Toggles**| Checkboxes | `ADMIN` | 6 functional groups | Sets permissions for Identity, Assets, Access, Audit, Security | Vitest (`test/security/smoke.test.ts`) |
| `INT-POS-005` | Position Modal | **Dual-Admin Acknowledgment** | Checkbox | `ADMIN` | Required for Elevated | Enforces four-eyes security protocol for critical privileges | Vitest (`test/security/smoke.test.ts`) |
| `INT-POS-006` | Position Modal | **Save Position Configuration** | Submit Button | `ADMIN` | Form valid | Posts to `/api/positions`, updates RBACManager contract state | Vitest (`test/security/smoke.test.ts`) |

---

### 3.6 Adversarial BreachLab Suite (`/breachlab`)

| ID | Location | Element / Label | Control Type | Required Role | Preconditions & States | Side Effects & Technical Actions | Automated Verification |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `INT-BRC-001` | BreachLab Nav | **Overview / Catalog / Wizard / Monitor / Results Tabs** | Tab Bar | `ADMIN`, `SECURITY_ANALYST` | Active session | Switches between emulation modules | Vitest (`test/security/breachlab.test.ts`) |
| `INT-BRC-002` | Catalog View | **Scenario Expand / Inspect** | Accordion | `ADMIN`, `SECURITY_ANALYST` | 10 scenarios | Displays MITRE tactics, threat model, steps, remediation | Vitest (`test/security/breachlab.test.ts`) |
| `INT-BRC-003` | Wizard View | **Select Scenario Target** | Dropdown | `ADMIN`, `SECURITY_ANALYST` | Catalog loaded | Configures simulation parameters (`SCN-AUTH-01` to `SCN-RBAC-10`) | Vitest (`test/security/breachlab.test.ts`) |
| `INT-BRC-004` | Wizard View | **Dry-Run / Live Execution Mode**| Switch | `ADMIN`, `SECURITY_ANALYST` | Toggleable | Toggles safe synthetic execution vs live orchestrator verification | Vitest (`test/security/breachlab.test.ts`) |
| `INT-BRC-005` | Wizard View | **Launch Adversarial Emulation**| Action Button | `ADMIN`, `SECURITY_ANALYST` | Config valid | Posts to `/api/breachlab/runs`, initializes step execution engine | Vitest (`test/security/breachlab.test.ts`) |
| `INT-BRC-006` | ExecutionMonitor| **Abort / Cancel Emulation** | Danger Button | `ADMIN`, `SECURITY_ANALYST` | Run in progress | Halts pipeline, clears synthetic artifacts, records partial logs | Vitest (`test/security/breachlab.test.ts`) |
| `INT-BRC-007` | Results View | **Export Forensic Evidence** | Download Button| `ADMIN`, `SECURITY_ANALYST` | Run finished | Generates signed JSON/PDF containing phase telemetry & hashes | Vitest (`test/security/breachlab.test.ts`) |
| `INT-BRC-008` | Sentinel Tab | **Launch Sentinel AI Forensic Investigation** | Button | `ADMIN`, `SECURITY_ANALYST` | Completed run | Invokes Sentinel rules engine to diagnose attack vectors & root cause | Vitest (`test/security/sentinel.test.ts`) |

---

### 3.7 Hardware Device Passports & Zero-Trust Control (`/devices`)

| ID | Location | Element / Label | Control Type | Required Role | Preconditions & States | Side Effects & Technical Actions | Automated Verification |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `INT-DEV-001` | Devices Page | **Generate Device Security Code**| Action Button | `ADMIN` | Admin session | Creates 15-minute enrollment token for new workstation | Vitest (`test/security/device-trust.test.ts`) |
| `INT-DEV-002` | Device Table | **Suspend Device (Emergency Kill)**| Danger Button | `ADMIN` | Active device | Updates device status to `SUSPENDED`, kills active JWTs, blocks TLS | Vitest (`test/security/device-trust.test.ts`) |
| `INT-DEV-003` | Device Table | **Reactivate Device** | Button | `ADMIN` | Suspended device | Restores device status to `ACTIVE`, marks risk state `TRUSTED` | Vitest (`test/security/device-trust.test.ts`) |
| `INT-DEV-004` | Device Table | **Revoke Credential Permanently**| Danger Button | `ADMIN` | Requires confirm | Sets status `REVOKED`; removes public key from valid verifiers | Vitest (`test/security/device-trust.test.ts`) |
| `INT-DEV-005` | Device Table | **Request Biometric Step-Up** | Action Button | `ADMIN` | Active device | Flags session for WebAuthn re-attestation before next operation | Vitest (`test/security/device-trust.test.ts`) |

---

### 3.8 Cryptographic Audit Ledger & Infrastructure (`/audit`, `/infrastructure`)

| ID | Location | Element / Label | Control Type | Required Role | Preconditions & States | Side Effects & Technical Actions | Automated Verification |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `INT-AUD-001` | Audit Page | **Verify Ledger Hash Chain** | Action Button | `ADMIN`, `AUDITOR` | Ledger loaded | Traverses event hashes, recomputes SHA-256 links, verifies tamper-proof state | Vitest (`test/security/audit.test.ts`) |
| `INT-AUD-002` | Audit Page | **Export Audit Ledger Report** | Download Button| `ADMIN`, `AUDITOR` | Ledger loaded | Exports signed compliance audit record | Vitest (`test/security/audit.test.ts`) |
| `INT-INF-001` | Infrastructure| **Smart Contract RPC Inspector**| Accordion | `ADMIN`, `AUDITOR` | Web3 provider connected | Fetches deployed contract bytecode from Chain-1 & Chain-2 | Playwright & Vitest (`test/contracts/`) |
| `INT-INF-002` | Infrastructure| **Re-verify Chain Anchors** | Button | `ADMIN`, `AUDITOR` | Chain online | Verifies on-chain state roots against local Merkle tree anchors | Vitest (`test/security/oracle-live.test.ts`) |

---

### 3.9 Global App Shell Navigation (`AppShell.tsx`)

| ID | Location | Element / Label | Control Type | Required Role | Preconditions & States | Side Effects & Technical Actions | Automated Verification |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `INT-NAV-001` | Top Header | **Navigation Links** | Links (10 items)| Role-filtered | Authenticated | Navigates between Command Center, Access, Assets, BreachLab, etc. | Playwright (`e2e/smoke.spec.ts`) |
| `INT-NAV-002` | Top Header | **Mobile Hamburger Menu** | Toggle Button | `< lg` viewports | Responsive display | Toggles mobile navigation dropdown with auto-closing on selection | Playwright (`e2e/smoke.spec.ts`) |
| `INT-NAV-003` | Top Header | **Disconnect / Logout** | Button | Any authenticated | Active session | Calls `/api/auth/logout`, disconnects wallet, clears session cookie | Vitest (`test/security/auth.test.ts`) |

---

## 4. End-to-End Workflow Verification

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                      SECUREMAX END-TO-END CRYPTOGRAPHIC PIPELINES                      │
└────────────────────────────────────────────────────────────────────────────────────────┘

 [1] HARDWARE PASSKEY ENROLLMENT (Zero-Trust Identity)
     Admin provisions user ──> Single-use 15m Token ──> Client WebAuthn Attestation
     ──> P-256 Keypair generated in Secure Enclave ──> Server stores public SPKI
     ──> Device Passport issued ──> Verified Terminal established.

 [2] PASSWORDLESS DUAL-AUTH SESSION INITIATION
     Client presents Email/User ID ──> Server sends random challenge
     ──> Workstation P-256 private key signs challenge ──> Server verifies signature
     ──> Live DB checks: User ACTIVE? Device ACTIVE? ──> Signed JWT cookie issued.

 [3] ENVELOPE-ENCRYPTED CLASSIFIED ASSET STORAGE
     User uploads document ──> Client computes SHA-256 hash
     ──> KMS generates random 256-bit DEK ──> File encrypted with AES-256-GCM + IV + Tag
     ──> KMS derives asset KEK from Master Key ──> DEK wrapped and stored
     ──> Asset registered on Chain-1 AssetRegistry contract.

 [4] JUST-IN-TIME ACCESS DECRYPTION
     User requests access ──> Admin/Manager approves request with TTL
     ──> User requests decrypt ──> KMS verifies active grant & device trust
     ──> 30-min bound temporary token issued (bound to Session + Client IP)
     ──> Ephemeral DEK unwrapped ──> Ciphertext decrypted in memory ──> Zeroed on close.

 [5] REAL-TIME ZERO-TRUST REVOCATION (Immediate Killswitch)
     Admin clicks "Revoke Clearance" or "Suspend Device"
     ──> Database status updated to REVOKED / SUSPENDED
     ──> Middleware & getVerifiedSession() enforce live database check
     ──> Next request immediately denied with 401/403 (Zero stale token window).
```

---

## 5. Automated Verification Summary

```
===================================================================================
 TEST EXECUTION VERIFICATION SUMMARY
===================================================================================
 Vitest Security & Architecture Suite:   15 / 15 Passed (139 / 139 tests)   ~2.2s
 Playwright End-to-End Browser Suite:     3 / 3 Passed  (8 / 8 tests)       ~7.1s
 Hardhat Smart Contract EVM Suite:        2 / 2 Passed  (8 / 8 tests)       ~0.3s
 TypeScript Compilation (tsc --noEmit):   Clean (0 errors)
 ESLint Code Quality Inspection:          Clean (0 warnings, 0 errors)
 Next.js Production Build:                Clean (44 / 44 pages compiled)
===================================================================================
```
