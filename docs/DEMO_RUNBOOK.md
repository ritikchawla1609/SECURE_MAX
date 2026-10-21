# SecureMAX Hackathon Demonstration Runbook

> **Audience**: Hackathon Judges, Security Auditors, Technical Evaluators  
> **Estimated Walkthrough Time**: 5–8 minutes  
> **Core Narrative**: *"SecureMAX combines zero-trust cryptographic access control with blockchain-backed evidence. Sentinel tests whether the authorization and cryptographic enforcement boundaries actually withstand adversarial requests."*

---

## 1. Step-by-Step Demonstration Flow

### Step 1: Decentralized Identity & Role Authentication
1. Open the application at `http://localhost:3000` (or `https://securemax.vercel.app`).
2. Show the **Hero Dual-Authentication Portal**:
   - **Administrator Login**: MetaMask Web3 EVM challenge-response verification against `IdentityRegistry.sol`.
   - **Team Member Login**: Passwordless P-256 WebAuthn / Passkey signature authentication against workstation device passport.
3. Use the **Quick Demo Access** switcher to authenticate as `ADMIN` (Ritik Chawla) or `USER` (Vasu Sharma).

### Step 2: Ingest & Encrypt Classified Document
1. Navigate to **Classified Asset Vault** (`/assets`).
2. Click **Upload Classified Asset** (`INT-AST-001`).
3. Select a synthetic test document (e.g. `TOP_SECRET_DEFENSE_REPORT.pdf`).
4. Select classification tier `TOP_SECRET`.
5. Click **Encrypt & Ingest Asset**:
   - Show that the file is encrypted client-side using **AES-256-GCM** with a newly generated random 256-bit DEK.
   - Show that the DEK is wrapped with KEK derived from Master Key + Asset ID.
   - Show the asset registered into `AssetRegistry.sol`.

### Step 3: Legitimate JIT Access Request & Decryption
1. Switch to user session `Vasu Sharma` (Role: `USER`).
2. Navigate to `/assets` — observe the document metadata is visible, but ciphertext is locked.
3. Click **Request Elevated Access** (`/access`). Set duration to 30 minutes.
4. As Admin, approve the request in the **Approvals Queue**.
5. Switch back to Vasu and click **Secure Decrypt & Preview**:
   - Show token issuance: short-lived, request-bound JWT.
   - Show atomic redemption: token is validated and consumed in real-time.
   - Show stream decryption in memory: plaintext preview opens in modal.
   - Close modal: in-memory plaintext buffer is immediately zeroed.

### Step 4: Adversarial Attack Emulation via Sentinel & BreachLab
1. Navigate to **BreachLab** (`/breachlab`).
2. Open the **Scenario Catalog**:
   - Show scenarios `S-01` through `S-30` mapped to MITRE ATT&CK tactics.
3. Select **S-08: Decryption Token Replay Attack**:
   - Click **Launch Adversarial Emulation**.
   - Observe live telemetry in **Execution Monitor**:
     - *Phase 1*: Capture valid one-time decryption token.
     - *Phase 2*: Attempt secondary replay with identical claims.
     - *Phase 3*: KMS redemption boundary detects duplicate `jti` and immediately blocks key release.
     - *Status*: **`BLOCKED`** (Zero plaintext leak).
4. Select **S-16: AES-256-GCM Ciphertext Tampering Attack**:
   - Mount bit-flip attack on ciphertext bytes.
   - Observe AEAD authentication tag failure and immediate containment.

### Step 5: Immediate Zero-Trust Revocation (Killswitch)
1. In `/access` or `/devices`, click **Revoke Clearance Immediately** on Vasu's grant.
2. Attempt decryption again in Vasu's browser window.
3. Demonstrate that decryption fails immediately (zero stale token window).

### Step 6: Immutable Audit Verification & Export
1. Navigate to `/audit`.
2. Click **Verify Ledger Hash Chain**:
   - System recomputes SHA-256 hashes across all events and confirms link integrity.
3. Run the standalone verifier tool in terminal:
   ```bash
   npx tsx scripts/verify-audit.ts
   ```
4. Demonstrate that modifying a single character in the exported JSON causes independent verification to fail.
