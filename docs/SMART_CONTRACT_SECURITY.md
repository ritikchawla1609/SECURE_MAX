# SecureMAX Smart Contract Security & Architecture Specification

> **EVM Tooling**: Hardhat v2.22.x, Solidity ^0.8.20  
> **Target Dual-Chain Architecture**: Chain-1 (Identity & Asset Domain) & Chain-2 (Key Governance & Audit Anchoring)

---

## 1. On-Chain Contracts Overview

| Contract Name | Domain | Primary Purpose | State-Changing Functions |
| :--- | :--- | :--- | :--- |
| **`IdentityRegistry.sol`** | Chain-1 | Decentralized identity & KYC status management | `registerIdentity`, `updateRole`, `updateStatus` |
| **`AssetRegistry.sol`** | Chain-1 | Classified asset metadata and user assignments | `registerAsset`, `assignAsset`, `revokeAssignment` |
| **`RBACManager.sol`** | Chain-1 | Cryptographic role definitions & bitmask permissions | `assignRole`, `revokeRole`, `updatePermissions` |
| **`KeyLifecycle.sol`** | Chain-2 | Key metadata, version lifecycle, and revocation | `registerKey`, `rotateKey`, `revokeKey` |
| **`KeyPolicyManager.sol`**| Chain-2 | Policy condition hashing and activation state | `createPolicy`, `updatePolicy`, `deactivatePolicy` |
| **`DecryptionAuth.sol`** | Chain-2 | On-chain authorization evidence & audit log | `recordAuthorization`, `recordCompletion`, `recordDenial` |
| **`AuditAnchor.sol`** | Chain-2 | Merkle root batch anchoring for audit logs | `anchorBatch`, `getAnchor` |

---

## 2. Access Control Model & Privilege Separation

1. **Role-Based Execution Boundary**:
   - Every external and public state-mutating function is guarded with strict `onlyOwner` or explicit administrative modifiers.
   - Non-admin callers attempting to mutate identity, asset assignments, keys, or policies cause immediate EVM reverts (`revert("Unauthorized")` or custom error).
2. **Four-Eyes Principle for High-Risk Entitlements**:
   - Elevated position changes (`ELEVATED`, `ADMINISTRATIVE`) in `RBACManager` require dual-admin transaction acknowledgment before on-chain status activation.
3. **Zero Private Key / Secret Invariant**:
   - Contracts store **hashes, public keys, metadata, and timestamps only**.
   - No plaintext Data Encryption Keys (DEKs), master keys, or decrypted documents are ever committed on-chain.

---

## 3. Threat Analysis & Vulnerability Mitigations

- **Reentrancy Protection**: All external interactions follow the Checks-Effects-Interactions (CEI) pattern. Contracts do not perform raw ether transfers or untrusted external call delegation.
- **Integer Overflow**: Compiled using Solidity `^0.8.20` featuring built-in checked arithmetic for all operations.
- **Denial of Service (DoS)**: Loops over unbounded dynamic arrays are prohibited in state-modifying functions; queries utilize mapping index lookups with bounded pagination where applicable.
- **Idempotency & Replay**: Batch anchoring and decryption authorization calls require unique identifiers (`authId`, `batchStartId`) and revert on duplicates.

---

## 4. Verification Evidence

All contracts compile and execute cleanly in Hardhat:
```bash
npx hardhat test
```
Result: **32 passing tests (100% green)** across all 7 contracts.
