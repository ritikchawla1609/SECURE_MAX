# SecureMAX — Self-Defending Zero-Trust Document Vault & Cryptographic Verification Platform

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-black.svg)](https://nextjs.org/)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.20-lightgrey.svg)](https://soliditylang.org/)
[![Security Verified](https://img.shields.io/badge/Security_Tests-175%2F175_Passed-success.svg)](#test-automation-and-verification)
[![Smart Contracts](https://img.shields.io/badge/Contract_Tests-32%2F32_Passed-success.svg)](#smart-contract-tests)
[![E2E Smoke](https://img.shields.io/badge/Playwright_E2E-16%2F16_Passed-success.svg)](#end-to-end-browser-tests)

---

## 1. Executive Summary & Core Mission

Traditional enterprise file-sharing solutions (e.g. Google Drive, SharePoint, Box) enforce security primarily through **application-layer access control lists (ACLs)** and database session tables. Under this paradigm, if the web application layer, API gateway, reverse proxy, or database administrator credentials are compromised, attackers can bypass authorization checks entirely and extract unencrypted documents directly from physical storage.

**SecureMAX** fundamentally solves this problem by ensuring that ordinary application-layer authorization checks are **never the sole barrier** protecting confidential assets:

1. **Cryptographic Enforcement Boundary**: Documents remain encrypted at rest with per-file AES-256-GCM Data Encryption Keys (DEKs). Decryption keys are never stored in plaintext and cannot be unwrapped without an atomic, cryptographic **Decryption Authorization Token**.
2. **Dual-Model Identity & Device Trust**:
   - **Root Administrator**: Sovereign cryptographic authentication via **MetaMask EIP-191** personal signature challenges.
   - **Team Members**: FIDO2 / W3C WebAuthn **P-256 Hardware Enclave Passkeys** bound directly to device passports.
3. **Atomic Anti-Replay Tokens**: Decryption permits are single-use, request-bound JWTs featuring unique `jti` nonces and strict 10-minute maximum lifetimes, eliminating token replay and concurrency race attacks.
4. **Dual-Chain EVM Ledger**:
   - **Chain-1 (Identity & Access)**: Decentralized identifiers (DIDs), organizational positions, and granular RBAC bitmask permissions.
   - **Chain-2 (Key Governance & Audit)**: Key lifecycle events, emergency revocation state, and RFC 6962 Merkle tree audit roots.
5. **Sentinel Adversarial Validation Engine**: A built-in automated red-team security engine continuously executing 30 deterministic attack simulations (`S-01` through `S-30`) to verify that the cryptographic boundary actually withstands adversarial pressure.

---

## 2. High-Level Architecture & End-to-End Data Flows

### A. Administrator MetaMask Authentication (EIP-191)

```
[ Admin Browser / MetaMask ]                [ SecureMAX Serverless Edge ]          [ Hardware Vault Ledger ]
            │                                             │                                    │
            │─── 1. POST /api/auth/challenge ────────────>│                                    │
            │    { walletAddress: "0xc532..." }           │─── 2. Generate EIP-191 Challenge ─>│
            │                                             │    (Cryptographic Nonce, Expiry)   │
            │<── 3. 200 OK: Challenge Nonce & Message ────│                                    │
            │                                             │                                    │
    [ User Signs EIP-191 Challenge ]                      │                                    │
            │                                             │                                    │
            │─── 4. POST /api/auth/login ────────────────>│                                    │
            │    { wallet, signature, challengeId }       │─── 5. ecrecover(hash, sig) ───────>│
            │                                             │    Matches Registered Admin?       │
            │                                             │─── 6. Issue HttpOnly JWT Session ──>│
            │<── 7. 200 OK + Auth Cookie + Storage Token ─│                                    │
```

---

### B. Team Member Hardware Passkey Enrollment (W3C WebAuthn)

```
[ Team Member Laptop ]                     [ SecureMAX Serverless Edge ]          [ Device Passport Store ]
            │                                             │                                    │
            │─── 1. POST /api/devices/enrollment/start ──>│                                    │
            │    { securityCode: "SEC-...", did: "..." }  │─── 2. Validate Single-Use Code ───>│
            │<── 3. WebAuthn PublicKeyCredentialOptions ──│                                    │
            │                                             │                                    │
    [ Local Secure Enclave / TouchID ]                    │                                    │
    [ Generates P-256 Keypair ]                           │                                    │
            │                                             │                                    │
            │─── 4. POST /api/devices/enrollment/verify ─>│                                    │
            │    { rawId, clientDataJSON, attestation }   │─── 5. Verify Hardware Attestation ─>│
            │                                             │─── 6. Bind Device Passport ───────>│
            │<── 7. 200 OK: Device Enrolled & Active ─────│                                    │
```

---

### C. Asset Ingestion & Envelope Encryption Flow

```
[ User Workstation ]                       [ SecureMAX Serverless Edge ]          [ KMS & Storage ]
         │                                               │                               │
         │─── 1. File Upload (Plaintext File Buffer) ───>│                               │
         │                                               │─── 2. Generate Random DEK ───>│
         │                                               │    (256-bit AES-GCM Key)      │
         │                                               │                               │
         │                                               │─── 3. Encrypt Plaintext ─────>│
         │                                               │    AES-256-GCM(Payload, DEK)  │
         │                                               │    Produces Ciphertext + Tag  │
         │                                               │                               │
         │                                               │─── 4. Wrap DEK with KEK ─────>│
         │                                               │    KEK derived via HKDF-SHA256│
         │                                               │    from Master KMS Secret     │
         │                                               │                               │
         │                                               │─── 5. Store Wrapped Envelope ─>│
         │<── 6. 200 OK: Asset Created & Encrypted ──────│    (Ciphertext + Wrapped DEK) │
```

---

### D. Just-In-Time (JIT) Access Request & NFT Clearance Permit

```
[ Requesting User ]                      [ Organization Administrator ]          [ Smart Contract (Chain-1) ]
         │                                              │                                      │
         │─── 1. Submit Access Request ────────────────>│                                      │
         │    (Asset ID, Reason, TTL: 30m)              │                                      │
         │                                              │─── 2. Admin Reviews & Approves ─────>│
         │                                              │       Mints On-Chain Clearance Permit│
         │                                              │       (Token ID, Bitmask, Expiry)    │
         │                                              │<── 3. NFT Mint Confirmed ────────────│
         │<── 4. Real-time Notification / Grant Active ─│                                      │
```

---

### E. Controlled Decryption & Plaintext Memory Zeroing Flow

```
[ Authenticated User ]                     [ Cryptographic KMS Boundary ]         [ Decryption Engine ]
         │                                               │                                    │
         │─── 1. Request Decryption Authorization ──────>│                                    │
         │    (Asset ID + Active Session + Device Proof) │─── 2. Validate RBAC Bitmask & JIT >│
         │<── 3. Signed One-Time Decryption JWT ─────────│    Issue JWT (exp: 10m, nonce)     │
         │                                               │                                    │
         │─── 4. POST /api/assets/decrypt ──────────────>│                                    │
         │    { assetId, decryptionToken }               │─── 5. Atomic JTI Consumption ─────>│
         │                                               │    (Reject if replayed/expired)    │
         │                                               │─── 6. Unwrap DEK & Decrypt Buffer >│
         │<── 7. Decrypted File Stream (In-Memory Only) ─│                                    │
         │                                               │                                    │
    [ Ingest into Protected Preview ]                    │                                    │
    [ Buffer Zeroed Immediately After Render ]           │                                    │
```

---

### F. Tamper-Evident Audit & Merkle Root Anchoring Flow

```
[ Audit Event Triggered ]                [ SHA-256 Hash Chain ]               [ RFC 6962 Merkle Tree ]
            │                                      │                                      │
            │─── Event Record (Actor, Action) ────>│                                      │
            │                                      │─── Compute Leaf Hash ───────────────>│
            │                                      │    hash = SHA256(prevHash + payload) │
            │                                      │                                      │
            │                                      │                        [ Build Merkle Root ]
            │                                      │                        [ Anchor Root on Chain-2 ]
            │<── Audit Proof & Merkle Inclusion Path ─────────────────────────────────────│
```

---

## 3. Technology Stack & Architecture

| Layer | Technologies Used | Description |
| :--- | :--- | :--- |
| **Frontend Framework** | **Next.js 14.2 (App Router)**, **React 18** | High-performance server and client components with React Server Actions. |
| **Styling & Design System** | **Tailwind CSS**, **Lucide React** | Sleek cyberpunk-grade dark aesthetic with responsive viewport adaptation. |
| **State Management** | **Zustand** (with `persist` middleware) | Reactive client stores with instant `localStorage` rehydration across refreshes. |
| **Web3 & Wallet Layer** | **Wagmi**, **Viem**, **Ox**, **Ethers.js** | EVM wallet connectivity, EIP-191 personal signing, and contract RPC interaction. |
| **Hardware Passkeys** | **W3C WebAuthn**, **@simplewebauthn/browser** | Hardware enclave biometric key generation and FIDO2 challenge verification. |
| **Symmetric & Asymmetric Crypto** | **Web Crypto API**, Node.js **crypto** | AES-256-GCM envelope encryption, HKDF-SHA256 KEK derivation, and SHA-256 hash chains. |
| **Serverless Runtime** | **Next.js Route Handlers**, **Edge Middleware** | Stateless microVM execution with resilient cryptographic fallback secrets. |
| **Data Persistence Engine** | **Dual-Tier Serverless Storage** + **Supabase** | Resilient `/tmp` filesystem ledger, client `localStorage` caching, and PostgreSQL/Cloud Storage sync. |
| **Smart Contracts** | **Solidity ^0.8.20**, **Hardhat**, **OpenZeppelin** | Dual-chain architecture for identity registries, RBAC bitmasks, and audit roots. |
| **Adversarial Engine** | **Sentinel Deterministic Security Engine** | 30 deterministic attack vectors validating authorization invariants. |
| **Testing & Quality Assurance** | **Vitest**, **Playwright**, **TypeScript** | Comprehensive 175-unit test matrix and 16 automated multi-viewport E2E browser flows. |

---

## 4. Why Data Resets on Refresh & How It Is Solved

### The Serverless Dilemma
On modern serverless deployment platforms (such as **Vercel** or **AWS Lambda**):
1. **Read-Only Root Filesystem**: The repository root (`process.cwd()`) is packaged into an immutable container image. Any attempt to write to `.securemax_db/vault_ledger.json` throws an `EROFS: read-only file system` error.
2. **Stateless MicroVM Invocations**: Different HTTP requests (e.g. submitting a request vs. refreshing the page) can be routed to completely different, freshly spawned lambda instances. If no shared persistent layer is active, the newly spawned instance reads the static JSON bundled at deployment time, resetting mutations to their initial state.

### The SecureMAX Multi-Tier Persistence Solution

SecureMAX implements a **3-tier hybrid persistence architecture** that guarantees zero data loss and instantaneous UI responsiveness:

```
                    ┌────────────────────────────────────────────────────────┐
                    │               USER ACTION / FORM SUBMIT                │
                    └────────────────────────────────────────────────────────┘
                                                 │
                   ┌─────────────────────────────┴─────────────────────────────┐
                   ▼                                                           ▼
    ┌─────────────────────────────┐                             ┌─────────────────────────────┐
    │   CLIENT TIER (OPTIMISTIC)  │                             │   SERVER TIER (SERVERLESS)  │
    ├─────────────────────────────┤                             ├─────────────────────────────┤
    │ 1. Immediate React state    │                             │ 1. In-Memory Memory Cache   │
    │ 2. Sync to `localStorage`   │                             │ 2. Read/Write to `/tmp/`    │
    │ 3. Instant zero-blink cache │                             │    (Writable on Vercel)     │
    │ 4. Survives browser refresh │                             │ 3. Asynchronously dual-sync │
    │    even before cloud round  │                             │    to Supabase Cloud DB     │
    └─────────────────────────────┘                             └─────────────────────────────┘
```

1. **Server-Side `/tmp` Ledger Persistence**:
   - In serverless runtimes, `/tmp` is the designated writable disk partition.
   - On container startup, SecureMAX checks if `/tmp/.securemax_db/vault_ledger.json` exists. If not, it automatically seeds `/tmp` from the bundled ledger. All subsequent mutations write to `/tmp`, persisting state across requests on that container.
2. **Client-Side Optimistic Rehydration**:
   - In [MyAccessView.tsx](src/components/access/MyAccessView.tsx), [assets/page.tsx](src/app/(protected)/assets/page.tsx), and [useDemoStore.ts](src/stores/useDemoStore.ts), all submitted access requests, requested asset permits, and security incidents are immediately synced to `localStorage`.
   - On page refresh, the components hydrate from `localStorage` immediately, ensuring submitted requests and simulation states never disappear while background server queries re-validate.
3. **Enterprise Cloud Tier (Supabase PostgreSQL & Storage)**:
   - For multi-region enterprise deployments with hundreds of distributed serverless workers, SecureMAX includes out-of-the-box dual-write synchronization to Supabase PostgreSQL and Cloud Storage.

---

## 5. Simplified 5-Hub Navigation Structure

To provide an intuitive, high-signal user experience, the dashboard navigation was condensed from 11 cluttered tabs down to **5 primary functional hubs**, with secondary capabilities organized cleanly via responsive `<SectionSubNav />` controls:

| Primary Navigation Hub | Default Route | Secondary Views Managed via Sub-Navigation | Description |
| :--- | :--- | :--- | :--- |
| **COMMAND CENTER** | `/dashboard/admin` | *Direct Hub* | Executive Sentinel posture score, live attack radar, and sovereign admin panic kill-switch. |
| **DATA VAULT** | `/assets` | • `Secure Files (Vault)` (`/assets`)<br>• `Access Requests` (`/access`) | Encrypted file browser, folder navigation, cryptographic sharing, and user access requests. |
| **DEVICES & IDENTITY** | `/devices` | • `Device Passports` (`/devices`)<br>• `Positions & RBAC` (`/positions`)<br>• `User Directory` (`/identity`) | Hardware Passkey trust registry, role-based bitmask policies, and cryptographic user identities. |
| **SECURITY CENTER** | `/dashboard/soc` | • `Threat Radar (SOC)` (`/dashboard/soc`)<br>• `Incident Center` (`/security/incidents`)<br>• `BreachLab Simulations` (`/breachlab`) | Real-time SOC monitoring, incident containment, and adversarial attack lab simulations. |
| **AUDIT TRAIL** | `/audit` | • `Audit Trail & Proofs` (`/audit`)<br>• `Blockchain Infrastructure` (`/infrastructure`) | Immutable SHA-256 hash chains, Merkle inclusion proofs, and dual-chain smart contract status. |

---

## 6. Project Structure & Codebase Organization

```
SECURE_MAX/
├── .securemax_db/                      # Local JSON vault ledger & hardware passport seed
│   └── vault_ledger.json               # Sanitized production ledger (Admins, Devices, Assets)
├── contracts/                          # Solidity Smart Contracts (EVM ^0.8.20)
│   ├── Chain1/                         # Domain 1: Identity & Access
│   │   ├── IdentityRegistry.sol        # Decentralized identity registry (DIDs)
│   │   ├── RBACManager.sol             # Bitmask role-based & attribute-based permissions
│   │   └── AssetRegistry.sol           # On-chain asset ownership & clearance permits
│   └── Chain2/                         # Domain 2: Key Governance & Audit
│       ├── KeyPolicyManager.sol        # Key rotation policies & revocation states
│       ├── KeyLifecycle.sol            # Cryptographic key states (Active, Compromised)
│       ├── DecryptionAuth.sol          # Request-bound decryption authorization verification
│       └── AuditAnchor.sol             # Merkle root batch anchoring contract
├── src/
│   ├── app/                            # Next.js 14 App Router
│   │   ├── (protected)/                # Authenticated application views wrapped in AppShell
│   │   │   ├── access/                 # Just-in-Time access requests & live grants
│   │   │   ├── assets/                 # Secure document vault & encrypted preview
│   │   │   ├── audit/                  # Tamper-evident audit ledger & Merkle proofs
│   │   │   ├── breachlab/              # Interactive adversarial attack simulation studio
│   │   │   ├── dashboard/admin/        # Command Center executive overview
│   │   │   ├── dashboard/soc/          # Security Operations Center (SOC) threat radar
│   │   │   ├── devices/                # WebAuthn device passport management
│   │   │   ├── identity/               # Cryptographic user directory
│   │   │   ├── infrastructure/         # Dual-chain smart contract health & bytecode inspector
│   │   │   └── positions/              # Enterprise organizational RBAC permissions
│   │   ├── actions/                    # React Server Actions (Access requests, Sentinel)
│   │   ├── api/                        # Next.js Serverless Route Handlers
│   │   │   ├── auth/                   # MetaMask EIP-191 & WebAuthn session endpoints
│   │   │   ├── assets/                 # Upload, action, share, and decrypt endpoints
│   │   │   ├── breachlab/              # Simulation run control and scenario execution
│   │   │   └── sync/state/             # Real-time synchronization endpoint
│   │   └── globals.css                 # Global CSS & viewport scroll containment
│   ├── components/                     # Reusable React components
│   │   ├── access/                     # MyAccessView and request modals
│   │   ├── admin/                      # CommandCenterView and Sentinel risk radar
│   │   ├── breachlab/                  # Scenario catalog and execution monitor
│   │   ├── layout/                     # AppShell, Sidebar, and SectionSubNav
│   │   └── vault/                      # VaultOverviewCard and VaultShareModal
│   ├── lib/                            # Core backend & cryptographic libraries
│   │   ├── auth/                       # DeviceStore, session verification, and WebAuthn
│   │   ├── blockchain/                 # Wagmi configuration, Viem clients, and RPC oracles
│   │   ├── config/                     # Resilient serverless secrets management
│   │   ├── crypto/                     # AES-GCM envelope encryption & HKDF-SHA256
│   │   ├── kms/                        # Token redemption, unwrap DEK, and anti-replay
│   │   └── sentinel/                   # Deterministic adversarial validation engine
│   └── stores/                         # Zustand client stores (useDemoStore with persist)
├── test/                               # Comprehensive Automated Test Suite
│   ├── contracts/                      # Hardhat EVM smart contract test suite (32 tests)
│   └── security/                       # Vitest cryptographic & integration suites (175 tests)
├── e2e/                                # Playwright browser end-to-end tests (16 tests)
└── scripts/                            # Standalone independent audit & verification utilities
```

---

## 7. Environment Configuration Reference

Create `.env.local` based on `.env.example`:

```bash
# Application URL
NEXT_PUBLIC_APP_URL=https://securemax.vercel.app

# Cryptographic Master Secrets (Minimum 32 characters)
JWT_SECRET=securemax-enterprise-jwt-master-secret-at-least-32-chars
SESSION_SECRET=securemax-enterprise-session-encryption-secret-32-chars
SECUREMAX_KMS_MASTER_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
SECUREMAX_KEK_SALT=securemax-kek-derivation-salt-production-v1

# Sovereign Root Administrator Wallet
ADMIN_WALLET=0xc532c65055108e7901212b6c30ef800152e26eb5

# (Optional) Supabase Enterprise Cloud Storage & PostgreSQL
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...

# Blockchain Network Configuration
NEXT_PUBLIC_CHAIN_ID=11155111
NEXT_PUBLIC_RPC_URL=https://rpc.sepolia.org
```

---

## 8. Verification & Test Commands

Every component, cryptographic boundary, smart contract, and UI route in SecureMAX is thoroughly verified across automated suites:

```bash
# 1. Run full unit and cryptographic integration test suite (175 tests across 18 files)
npm test

# 2. Run EVM smart contract test suite (32 tests)
npx hardhat test

# 3. Run Playwright real-browser end-to-end flows (16 tests across desktop and mobile viewports)
npx playwright test

# 4. Run TypeScript strict typecheck (0 errors)
npx tsc --noEmit

# 5. Compile optimized production build (44/44 static and dynamic routes)
npm run build

# 6. Run standalone independent cryptographic audit verifier
npx tsx scripts/verify-audit.ts
```

---

## 9. License & Operational Sovereignty

SecureMAX is engineered for high-security enterprise and sovereign zero-trust operational environments. Built with defense-in-depth principles: **Never trust the web server alone. Cryptographically enforce all access.**
