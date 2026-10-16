# SecureMAX — Zero-Trust Encrypted Document Sharing & Integrity Verification Platform

[![Build Status](https://img.shields.io/badge/Next.js-14.2.5-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636?style=for-the-badge&logo=solidity)](https://soliditylang.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Security Posture](https://img.shields.io/badge/Security-Fail--Closed-emerald?style=for-the-badge&logo=shield)](./SECURITY_ARCHITECTURE.md)
[![Tests Passing](https://img.shields.io/badge/Tests-170%20Passing-brightgreen?style=for-the-badge)](./test/)

> **"Your Files. Your Keys. Your Control."**  
> *The fundamental premise of SecureMAX is: **Authorization ≠ Decryption**. A user holding permissions to access an asset does not possess the cryptographic capability to decrypt that asset. Cryptographic key release is an independent, ephemeral, multi-chain security control.*

---

## 1. Executive Overview

**SecureMAX** is a production-grade, zero-trust cybersecurity platform for enterprise document sharing, envelope cryptography, and decentralized integrity verification. Engineered for high-assurance defense, aerospace, financial, and healthcare data sharing, SecureMAX ensures that data confidentiality remains intact even in the event of a full database leak, infrastructure compromise, or malicious database administrator (DBA) insider threat.

### Key Pillars:
1. **Cryptographic Separation of Duty:** Authorization rules (who is allowed to see what) live in **Chain-1 (Identity, RBAC, Asset Registry)**. Key management policies (who is cryptographically permitted to decrypt) live in **Chain-2 (Key Lifecycle, Key Policies, Decryption Auth)**.
2. **KMS Envelope Encryption:** Bulk file encryption utilizes **AES-256-GCM** with 96-bit random IVs and 128-bit authentication tags. Data Encryption Keys (DEKs) are wrapped under ephemeral Key Encryption Keys (KEKs) derived via **HKDF-SHA256** from the Master Key with Canonical Additional Authenticated Data (AAD).
3. **Strict Fail-Closed Architecture:** Zero-fallback elimination. RPC timeouts, network partitions, or contract reverts immediately terminate requests. No insecure fallbacks or mock bypasses exist in production paths.
4. **Hardware-Backed & Web3 Dual Authentication:**
   - **Model A (Administrators & SecOps):** MetaMask EVM wallet signature authentication (SIWE / EIP-712 challenges).
   - **Model B (Enterprise Employees):** Client-side Web Crypto API **ECDSA P-256 (secp256r1)** hardware-backed key pair authentication. Private keys never leave the user's browser or Secure Enclave.
   - **Model C (Device Trust & Assurance):** Single-use 6-digit cryptographic security code verification with hardware posture scoring.
5. **Sentinel Intrusion & Attack Simulation Engine:** Real-time security engine running deterministic attack simulations against sandbox environments to actively detect vulnerabilities and enforce defense-in-depth.
6. **Immutable Merkle Audit Trail:** Off-chain SHA-256 hash chaining periodically anchored to the Ethereum blockchain via `AuditAnchor.sol` for mathematical non-repudiation.

---

## 2. Target System Architecture

```
                                    +-----------------------+
                                    |     USER BROWSER      |
                                    | (MetaMask / P-256)   |
                                    +-----------------------+
                                                |
                                                | HTTPS / TLS 1.3
                                                v
+-----------------------------------------------------------------------------------------+
|                                  NEXT.JS COMPUTE PLANE                                  |
|   App Router 14.2.5 | Server Actions | Route Handlers | `server-only` Security Boundary |
+-----------------------------------------------------------------------------------------+
       |                                |                             |
       | Query / Ciphertext             | Ephemeral KEK Derive        | Query Latest
       v                                v                             v
+-----------------------+   +-----------------------+   +---------------------------------+
|  STORAGE & DATABASE   |   |   KMS KEY ENGINE      |   |        DUAL EVM CHAINS          |
|  (Supabase / Postgres)|   | (DevSoftware/External)|   |                                 |
| - Encrypted Blobs     |   | - AES-256-GCM Wrap    |   | CHAIN-1: IdentityRegistry.sol   |
| - Wrapped DEK Records |   | - Canonical AAD Bind  |   |          RBACManager.sol        |
| - Device / Sessions   |   | - Memory Zeroization  |   |          AssetRegistry.sol      |
| - Chained Audit Logs  |   +-----------------------+   |          AuditAnchor.sol        |
+-----------------------+                               |                                 |
                                                        | CHAIN-2: KeyLifecycle.sol       |
                                                        |          KeyPolicyManager.sol   |
                                                        |          DecryptionAuth.sol     |
                                                        +---------------------------------+
```

---

## 3. Technology Stack

- **Frontend & Serverless Framework:** Next.js 14.2.5 (React 18, App Router, React Server Actions)
- **Programming Languages:** TypeScript 5.5, Solidity 0.8.24
- **Styling & UI System:** Tailwind CSS, Radix UI Slot primitives, Lucide React, Framer Motion
- **Smart Contract Development:** Hardhat 2.22.6, OpenZeppelin Contracts v5.0.2, Ethers.js v6, Viem v2
- **Cryptographic Primitives:** Web Crypto API (Client ECDSA P-256), Node.js `crypto` (AES-256-GCM, HKDF-SHA256), Jose v5 (JWT/JWK)
- **Database & Storage:** PostgreSQL / Supabase JS Client v2 (with local fallback in `deviceStore`)
- **Test Automation:** Vitest 2.0.3, Hardhat Test Runner, Playwright 1.63.0

---

## 4. Prerequisites

- **Node.js:** `v20.14.0` or higher
- **npm:** `v10.0.0` or higher
- **Browser:** Modern Chromium, Firefox, or Safari supporting the Web Crypto API
- **Web3 Wallet (Optional):** MetaMask extension (required for Model A Administrator login)

---

## 5. Quick Start & Local Setup

### 5.1 Clone & Install Dependencies
```bash
git clone https://github.com/your-org/SecureMAX.git
cd SecureMAX
npm install
```

### 5.2 Configure Environment Variables
Copy the example environment configuration:
```bash
cp .env.example .env.local
```
Ensure key environment parameters are set:
```bash
JWT_SECRET=securemax-production-grade-jwt-secret-minimum-32-chars-long
SECUREMAX_KMS_MASTER_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
SECUREMAX_KMS_PROVIDER=software
NEXT_PUBLIC_CHAIN_RPC_URL=http://127.0.0.1:8545
```

### 5.3 Compile & Deploy Smart Contracts (Local Node)
```bash
# 1. Compile all 7 Solidity contracts
npm run contracts:compile

# 2. Run smart contract test suite to verify contract invariants
npm run contracts:test
```

### 5.4 Launch Development Server
```bash
npm run dev
```
Navigate to [http://localhost:3000](http://localhost:3000) to access the SecureMAX application.

---

## 6. Comprehensive Test & Build Pipeline

SecureMAX maintains a 100% test pass rate across unit, contract, cryptographic, and production build checks:

```bash
# 1. Next.js Production Linter (0 warnings, 0 errors)
npm run lint

# 2. Hardhat Smart Contract Test Suite (58/58 passing across 7 contracts)
npm run contracts:test

# 3. Vitest Security, Cryptography, and Sentinel Suite (112/112 passing across 13 test suites)
npm run test

# 4. Next.js Production Build (37/37 static and dynamic routes compiled successfully)
npm run build
```

---

## 7. Core Feature Workflows

### 7.1 Encrypted File Ingestion (Upload)
1. User drops a document into the File Management interface (`/assets`).
2. The browser initiates streaming upload to `POST /api/assets/upload`.
3. The KMS engine generates a unique 256-bit DEK, derives a contextual KEK via HKDF-SHA256, and encrypts the file stream with AES-256-GCM.
4. The wrapped DEK is stored in PostgreSQL alongside the canonical AAD hash.
5. The SHA-256 asset content hash is anchored in Chain-1 `AssetRegistry.sol`.
6. Memory buffers holding the plaintext DEK are immediately zeroized.

### 7.2 Clearance Request & Separation of Duty
1. User requests access to an asset.
2. System checks `isAssigned` on Chain-1 `AssetRegistry.sol` and permissions in `RBACManager.sol`.
3. If authorized, the system queries Chain-2 `KeyPolicyManager.sol` to ensure the key policy is satisfied and the key is `Active`.
4. The system records the clearance in `DecryptionAuth.sol` and issues a short-lived (5-minute TTL) **Temporary Decryption Token** bound to the user's active session and incoming IP.

### 7.3 Ephemeral Streaming Decryption
1. User clicks Decrypt / Download in `/assets`.
2. The browser presents the session cookie and the temporary decryption token to `GET /api/assets/decrypt`.
3. The server unwraps the DEK, verifies the canonical AAD, and pipes the ciphertext stream through an AES-256-GCM decipher stream directly to the response pipe.
4. The plaintext is delivered without ever being written to disk or stored unencrypted in memory.

### 7.4 Sentinel Live Threat Simulation
1. Security Officers can trigger real-time threat analysis from `/security/sentinel` or `/dashboard/soc`.
2. The Sentinel engine launches 8 deterministic sandbox attacks:
   - Unauthorized asset access attempts
   - Expired key acceptance
   - Revoked session decryption
   - Tampered ciphertext detection
   - Session IP replay
   - Missing AAD injection
   - Cross-tenant exfiltration
   - Admin panic lockdown verification
3. Live telemetry displays whether defenses successfully blocked each vector.

---

## 8. Repository Layout

```
SecureMAX-main/
├── contracts/                  # Solidity 0.8.24 Smart Contracts
│   ├── chain1/                 # Chain-1: Identity, RBAC, Asset, Audit
│   │   ├── AssetRegistry.sol
│   │   ├── AuditAnchor.sol
│   │   ├── IdentityRegistry.sol
│   │   └── RBACManager.sol
│   ├── chain2/                 # Chain-2: Key Management & Decryption Auth
│   │   ├── DecryptionAuth.sol
│   │   ├── KeyLifecycle.sol
│   │   └── KeyPolicyManager.sol
│   └── interfaces/             # Shared Interfaces (ISecureMax.sol)
├── docs/                       # Formal Technical & Operations Documentation
│   ├── API.md                  # Comprehensive API Endpoints Specification
│   ├── DEPLOYMENT.md           # Multi-Environment Deployment & Ops Guide
│   ├── INCIDENT_RESPONSE.md    # SOC Playbook & Emergency Panic Protocols
│   ├── KEY_MANAGEMENT.md       # Cryptographic Key Lifecycle Specification
│   └── specs/                  # Technical Deep-Dives & Architecture Specifications
│       ├── API_ARCHITECTURE.md
│       ├── ARCHITECTURE.md
│       ├── CHANGELOG.md
│       ├── DATABASE_SCHEMA.md
│       ├── DEPLOYMENT_ARCHITECTURE.md
│       ├── IMPLEMENTATION_PLAN.md
│       ├── PROJECT_SPEC.md
│       ├── SECURITY_MODEL.md
│       ├── SMART_CONTRACT_ARCHITECTURE.md
│       ├── TESTING_STRATEGY.md
│       └── THREAT_MODEL.md
├── scripts/                    # Deployment & Diagnostic Utilities
│   ├── client-keys.mjs         # Standalone Web Crypto P-256 client test runner
│   ├── deploy.ts               # Multi-chain Hardhat deployment orchestrator
│   └── verify-database-health.ts
├── src/
│   ├── app/                    # Next.js 14 App Router Pages & API Routes
│   │   ├── (protected)/        # Authenticated Operator Routes
│   │   │   ├── access/         # Access Management & Approvals
│   │   │   ├── assets/         # File Management & In-Page Dropzone
│   │   │   ├── audit/          # Cryptographic Audit Log Explorer
│   │   │   ├── dashboard/      # Role-Based Operational Dashboards
│   │   │   ├── security/       # SOC, Sentinel, and Incident Triage Views
│   │   │   └── settings/       # Operator Profile & Security Policies
│   │   ├── (public)/           # Public Landing & Auth Routes
│   │   │   ├── login/          # Zero-Trust Multi-Model Login
│   │   │   └── register-device/
│   │   ├── actions/            # Type-Safe React Server Actions
│   │   └── api/                # 27 Secure Next.js REST API Routes
│   ├── components/             # Reusable Design System & Security UI
│   │   ├── auth/               # Hero Login Card & Web3 Handlers
│   │   ├── dashboard/          # Metric Cards & Recharts Telemetry
│   │   ├── landing/            # 3D Shield & SVG Network Node Visualizer
│   │   ├── layout/             # AppShell, Sidebar, and Global Cursor
│   │   ├── ui/                 # Accessible Primitives (Button, Dialog, Dropdown, Toast)
│   │   └── vault/              # Vault Explorer, Previews, Share & Upload Modals
│   └── lib/                    # Core Security, Crypto, and KMS Libraries
│       ├── audit/              # Merkle Tree & Tamper-Evident Logger
│       ├── auth/               # Device Trust, Sessions, and Policies
│       ├── blockchain/         # Viem/Ethers Oracle & Smart Contract Clients
│       ├── crypto/             # AES-256-GCM, P-256 Web Crypto, Key Derivation
│       ├── kms/                # KMS Envelope Providers & Zero-Fallback Logic
│       └── sentinel/           # Automated Attack Simulation Engine
├── supabase/                   # Database Schemas & Migrations
│   ├── migrations/             # Timestamped SQL Migration Files
│   └── schemas/                # Consolidated Database Schema Definitions
├── test/
│   ├── contracts/              # Hardhat Smart Contract Unit Tests (58 tests)
│   └── security/               # Vitest Cryptographic & Zero-Trust Tests (112 tests)
├── SECURITY_ARCHITECTURE.md    # Comprehensive Threat Model & Security Specification
├── SECURITY_AUDIT.md           # Full Vulnerability Audit & Remediation Log
└── README.md                   # Primary Entrypoint & Architecture Reference
```

---

## 9. Security Documentation Index

- [Security Architecture Document (`SECURITY_ARCHITECTURE.md`)](./SECURITY_ARCHITECTURE.md)
- [Security Audit & Vulnerability Assessment Report (`SECURITY_AUDIT.md`)](./SECURITY_AUDIT.md)
- [API Reference Specification (`docs/API.md`)](./docs/API.md)
- [Key Management Specification (`docs/KEY_MANAGEMENT.md`)](./docs/KEY_MANAGEMENT.md)
- [Incident Response Playbook (`docs/INCIDENT_RESPONSE.md`)](./docs/INCIDENT_RESPONSE.md)
- [Deployment & Operations Guide (`docs/DEPLOYMENT.md`)](./docs/DEPLOYMENT.md)

### Technical Specifications & References (`docs/specs/`)
- [API Architecture Specification (`docs/specs/API_ARCHITECTURE.md`)](./docs/specs/API_ARCHITECTURE.md)
- [Database Schema & Constraints (`docs/specs/DATABASE_SCHEMA.md`)](./docs/specs/DATABASE_SCHEMA.md)
- [Smart Contract Architecture (`docs/specs/SMART_CONTRACT_ARCHITECTURE.md`)](./docs/specs/SMART_CONTRACT_ARCHITECTURE.md)
- [Security Threat Model (`docs/specs/THREAT_MODEL.md`)](./docs/specs/THREAT_MODEL.md)
- [Testing Strategy & Coverage Matrix (`docs/specs/TESTING_STRATEGY.md`)](./docs/specs/TESTING_STRATEGY.md)

---

## 10. License

This project is licensed under the MIT License — see the [LICENSE](./LICENSE) file for details.
