# SecureMAX Known Limitations & Engineering Disclosures

> **Standard**: Honest, transparent reporting for hackathon evaluation and production hardening.

---

## 1. Browser & CI Hardware Attestation
- **FIDO2 / WebAuthn Biometrics**: Physical biometric readers (Apple TouchID, YubiKey) cannot be physically touched by automated headless CI runners. In automated test environments (`npm test`, `npx playwright test`), hardware attestation is emulated using verified cryptographic P-256 SPKI key pairs.
- **Client Heap Zeroization**: While Node.js and browser `ArrayBuffer` instances are zero-filled using `buffer.fill(0)` upon stream close, JavaScript engines with generational garbage collectors (V8) may retain temporary string or chunk references until garbage collection cycles occur.

---

## 2. Blockchain & Cross-Chain Considerations
- **Local Devnet vs Public Mainnet**: In automated local environments, Chain-1 and Chain-2 execute against an in-process Hardhat EVM provider. When deploying to public testnets (e.g. Sepolia or Arbitrum Sepolia), transaction latency is subject to EVM block inclusion times (12–15s).
- **Oracle Confirmation Latency**: Cross-chain policy reconciliation relies on read-contract RPC calls. When RPC nodes suffer transient network disconnections, SecureMAX enforces fail-closed behavior (denying access until consensus is verified).

---

## 3. Database Persistence
- **Dual Persistence Architecture**: SecureMAX is engineered to run against a live Supabase PostgreSQL database. In offline or local development scenarios where Supabase environment variables are unconfigured, the application falls back transparently to its in-memory zero-trust store.
