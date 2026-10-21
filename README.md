# SecureMAX — Zero-Trust Encrypted Document Sharing & Adversarial Validation Platform

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-black.svg)](https://nextjs.org/)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.20-lightgrey.svg)](https://soliditylang.org/)
[![Security Verified](https://img.shields.io/badge/Security_Tests-175%2F175_Passed-success.svg)](#test-automation-and-verification)
[![Smart Contracts](https://img.shields.io/badge/Contract_Tests-32%2F32_Passed-success.svg)](#smart-contract-tests)
[![E2E Smoke](https://img.shields.io/badge/Playwright_E2E-8%2F8_Passed-success.svg)](#end-to-end-browser-tests)

---

## 1. Problem Statement & Mission

Traditional enterprise file-sharing platforms rely almost entirely on application-layer access controls (such as web server middleware, cookies, and database ACLs). If the application server, API gateway, or database administrator credentials are compromised, attackers can bypass access controls and extract unencrypted documents directly from storage.

**SecureMAX** solves this problem by ensuring that ordinary application-layer authorization checks are **not** the sole barrier protecting encrypted assets. The cryptographic enforcement boundary (KMS Envelope + Hardware Passports + Smart Contract Registries) independently validates the authorization required for decryption, and **Sentinel** continuously tests whether those guarantees hold under adversarial pressure.

---

## 2. Core Differentiators

1. **Independent Cryptographic Enforcement Boundary**:
   - Access to an encrypted asset requires an atomic, request-bound **Decryption Authorization Token** that is cryptographically validated at the point of decryption.
   - The Key Management Service (KMS) never trusts client-supplied authorization flags or implicit administrative username checks.
2. **Atomic One-Time Token Redemption & Anti-Replay**:
   - Tokens feature cryptographically unique token IDs (`jti`), 10-minute maximum lifetimes, and atomic single-use redemption that defeats replay and concurrent race conditions.
3. **Dual-Chain EVM Authorization Evidence**:
   - **Chain-1 (Identity & Asset Domain)**: Tracks decentralized identities, asset registrations, and granular RBAC bitmask permissions.
   - **Chain-2 (Key Governance & Audit Domain)**: Records key lifecycle rotations, policy activation states, and Merkle root batch anchors.
4. **Sentinel Adversarial Security Engine**:
   - A genuine automated red-team validation engine executing 30 deterministic attack scenarios (`S-01` to `S-30`) covering unauthorized access, token replays, cross-tenant key substitution, ciphertext tampering, and RPC failures.
5. **Standalone Verifier & Immutable Audit Hash Chains**:
   - SHA-256 hash chaining and RFC 6962 Merkle trees allow external evaluators to verify the integrity of the audit log independently of the web dashboard.

---

## 3. High-Level Architecture & End-to-End Data Flow

```
[ Client / Browser ]
        │
   (1) Dual Authentication (MetaMask EVM ECDSA or P-256 WebAuthn Hardware Key)
        ▼
[ Application Shell & Edge Middleware ]
        │
   (2) Active Session & Tenant Verification (Zero-Trust Live DB Check)
        ▼
[ Access Control Layer (/api/access/requests) ]
        │
   (3) Just-In-Time (JIT) Clearance Request & Multi-Party Approval
        ▼
[ Decryption Authorization Issuer (src/lib/kms/redemption.ts) ]
        │
   (4) Issues Request-Bound, Signed JWT (sub, assetId, tenantId, jti, exp: 10m)
        ▼
[ Cryptographic Enforcement Boundary (src/app/api/assets/decrypt) ]
        │
   (5) Independent KMS Validation:
       ├── Validates JWT Signature & Claims
       ├── Checks Atomic One-Time Redemption (Blocks Replay & Race Conditions)
       └── Derives KEK via HKDF-SHA256 & Unwraps DEK via AES-256-GCM
        ▼
[ Authenticated Decryption Stream ]
        │
   (6) Memory-Only Ingestion (Plaintext buffer zeroed immediately after display)
        ▼
[ Audit & Blockchain Anchoring (src/lib/audit/) ]
        │
   (7) Event hashed into SHA-256 Chain ──> Merkle Tree ──> Anchored on Chain-2
```

---

## 4. Technology Stack

- **Frontend & App Framework**: Next.js 14 (App Router), React 18, Tailwind CSS, Lucide Icons
- **Type Safety**: TypeScript 5.9 with strict type checking (`tsc --noEmit`)
- **Cryptography**: Web Crypto API & Node.js `crypto` (AES-256-GCM, HKDF-SHA256, P-256 ECDSA, FIDO2 WebAuthn)
- **Database & Persistence**: Supabase PostgreSQL with Row-Level Security (RLS) + In-Memory Fallback Proxy
- **Smart Contracts & EVM**: Solidity `^0.8.20`, Hardhat `v2.22`, Viem / Ethers.js
- **Testing & QA**: Vitest (Unit & Integration), Hardhat (Smart Contracts), Playwright (End-to-End Browser)

---

## 5. Quickstart & Local Setup

### Prerequisites
- Node.js >= 18.17.0
- npm >= 9.x

### Installation
```bash
# 1. Clone repository
git clone git@github.com:ritikchawla1609/SECURE_MAX.git
cd SECURE_MAX

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env.local
```

### Reproducible Smoke Suite (Single Command)
```bash
npm run test:smoke
```
*Executes both the Vitest cryptographic integration suite and Playwright real-browser tests in a single command.*

---

## 6. Comprehensive Verification Commands

```bash
# 1. Run all 175 Vitest unit & integration tests
npm test

# 2. Run all 32 Hardhat EVM smart contract tests
npx hardhat test

# 3. Run all 8 Playwright browser E2E tests
npx playwright test

# 4. Run TypeScript typecheck (0 errors)
npx tsc --noEmit

# 5. Run ESLint code quality inspection (0 warnings, 0 errors)
npm run lint

# 6. Compile optimized production build (44/44 routes)
npm run build

# 7. Run standalone independent audit verifier
npx tsx scripts/verify-audit.ts
```

---

## 7. Documentation Matrix

- [**`docs/SECURITY_BASELINE.md`**](file:///Users/ritikchawla/Downloads/securemax-sih-2026-main-4/docs/SECURITY_BASELINE.md): Comprehensive baseline security audit and initial state assessment.
- [**`docs/THREAT_MODEL.md`**](file:///Users/ritikchawla/Downloads/securemax-sih-2026-main-4/docs/THREAT_MODEL.md): Assets, trust boundaries, threat actors, attack surfaces, and mitigations.
- [**`docs/SECURITY_INVARIANTS.md`**](file:///Users/ritikchawla/Downloads/securemax-sih-2026-main-4/docs/SECURITY_INVARIANTS.md): Non-negotiable cryptographic and authorization rules.
- [**`docs/SECURITY_TEST_REPORT.md`**](file:///Users/ritikchawla/Downloads/securemax-sih-2026-main-4/docs/SECURITY_TEST_REPORT.md): Full test results across 215 automated assertions.
- [**`docs/SMART_CONTRACT_SECURITY.md`**](file:///Users/ritikchawla/Downloads/securemax-sih-2026-main-4/docs/SMART_CONTRACT_SECURITY.md): EVM access control and lifecycle specification.
- [**`docs/KMS_AND_KEY_LIFECYCLE.md`**](file:///Users/ritikchawla/Downloads/securemax-sih-2026-main-4/docs/KMS_AND_KEY_LIFECYCLE.md): Envelope encryption, KEK/DEK derivation, and anti-replay tokens.
- [**`docs/AUDIT_VERIFICATION.md`**](file:///Users/ritikchawla/Downloads/securemax-sih-2026-main-4/docs/AUDIT_VERIFICATION.md): Hash-chain and Merkle tree verification runbook.
- [**`docs/DEMO_RUNBOOK.md`**](file:///Users/ritikchawla/Downloads/securemax-sih-2026-main-4/docs/DEMO_RUNBOOK.md): Step-by-step 8-stage presentation guide for hackathon judges.
- [**`docs/KNOWN_LIMITATIONS.md`**](file:///Users/ritikchawla/Downloads/securemax-sih-2026-main-4/docs/KNOWN_LIMITATIONS.md): Transparent disclosures regarding test fixtures and latency.
- [**`docs/qa/INTERACTION_INVENTORY.md`**](file:///Users/ritikchawla/Downloads/securemax-sih-2026-main-4/docs/qa/INTERACTION_INVENTORY.md): Central QA matrix mapping 78 interactive controls across 17 routes.

---

## 8. Presentation Narrative & Conclusion

> *"SecureMAX combines zero-trust cryptographic access control with blockchain-backed evidence. Sentinel tests whether the authorization and cryptographic enforcement boundaries actually withstand adversarial requests."*

### Release Status
**`READY_FOR_DEMO`** — The core demonstration and all required security invariants have been verified across automated suites with zero unresolved critical blockers.
