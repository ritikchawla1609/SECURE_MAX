# SecureMax - Project Specification

## Executive Summary
SecureMax is a "Self-Defending Decentralized Identity & Secure Digital Asset Access Platform" developed for the SIH26125 challenge by Bharat Electronics Limited (BEL). It addresses the critical vulnerabilities of centralized identity and access management (IAM) systems in defense contexts by decentralizing access control and explicitly separating authorization from decryption.

## Problem Statement
In traditional defense networks, centralized IAM systems represent a single point of failure and a high-value target for adversaries. If the central directory or key server is compromised, the entire system's security collapses, allowing unauthorized access to highly sensitive digital assets. Furthermore, legacy systems often conflate the right to access a system with the ability to decrypt data, leading to broad data exposure upon compromise.

## Core Principle: AUTHORIZATION ≠ DECRYPTION
The fundamental architectural principle of SecureMax is the strict decoupling of authorization logic from cryptographic execution. 
- **Authorization** (who is allowed to access what, under what conditions) is governed by decentralized smart contracts on a blockchain (Chain-1).
- **Decryption** (the actual release of key material to decrypt data) is handled by a separate domain (Chain-2 and the KMS).
Even if an attacker compromises the application server, they cannot arbitrarily decrypt data without valid, time-bound cryptographic proofs from both chains.

## System Overview
The SecureMax architecture comprises several distinct components working in concert:
1. **Dual Blockchain Structure:** Separation of Identity/RBAC (Chain-1) and Key Management (Chain-2).
2. **DID Implementation:** Decentralized Identifiers for users.
3. **Authentication:** Wallet-based signature authentication.
4. **KMS Architecture:** Software-based Key Management System for envelope encryption.
5. **Encryption Scheme:** AES-256-GCM authenticated encryption.
6. **Asset Storage:** Supabase Storage for encrypted assets, PostgreSQL for metadata.
7. **Access Flow:** Multi-step verification spanning both chains before decryption.
8. **Sentinel Architecture:** Deterministic security testing and response engine.
9. **Audit Trail:** Hash-chained logging anchored to the blockchain.
10. **Database:** Relational storage for off-chain state and metadata.
11. **Smart Contracts:** Solidity contracts governing the decentralized logic.
12. **API Layer:** Next.js API routes mediating interactions.
13. **Frontend:** React/Next.js client interface.

## Functional Requirements
- **FR-001 (Identity):** The system shall support DID registration (`did:securemax:<address>`) on Chain-1.
- **FR-002 (Auth):** Users shall authenticate via wallet signature (SIWE) yielding a short-lived JWT.
- **FR-003 (RBAC):** Roles and permissions shall be managed via Chain-1 smart contracts.
- **FR-004 (Asset Registration):** Assets shall be registered on Chain-1 with metadata stored in the off-chain DB.
- **FR-005 (Encryption):** All assets shall be encrypted client-side or server-side using AES-256-GCM before storage.
- **FR-006 (Access Request):** Users must explicitly request access to assets, evaluated against RBAC and policies.
- **FR-007 (KMS):** A server-side KMS shall manage Data Encryption Keys (DEKs) wrapped by a Master Key (KEK).
- **FR-008 (Decryption Auth):** Chain-2 shall record and validate authorization events before KMS releases DEKs.
- **FR-009 (Sentinel):** The system shall include an automated security test runner (Sentinel) for validation.
- **FR-010 (Audit):** All critical actions shall be logged in a hash-chained audit trail.
- **FR-011 (Blockchain Anchoring):** Audit logs shall periodically anchor Merkle roots to Chain-1.
- **FR-012 (Emergency Access):** Admins shall have emergency break-glass procedures (configurable).
- **FR-013 (UI/Dashboard):** The system shall provide role-specific dashboards for managing access and viewing metrics.

## Non-Functional Requirements
- **Performance:** API responses < 500ms; decryption streaming optimized for file size.
- **Security:** Fail-closed design; no plaintext stored server-side; strict boundary between Auth and Decryption.
- **Availability:** Robust error handling for RPC failures (503 retries).
- **Scalability:** Stateless API layer; scalable off-chain storage (Supabase).
- **Compliance:** Tamper-evident audit trails suitable for defense auditing standards.

## User Roles & Permissions Matrix
| Permission | ADMIN | MANAGER | ENGINEER | AUDITOR | SECURITY_ANALYST |
|---|---|---|---|---|---|
| manage_users | ✓ | | | | |
| assign_roles | ✓ | | | | |
| register_assets | ✓ | ✓ | | | |
| assign_assets | ✓ | ✓ | | | |
| transfer_ownership | ✓ | ✓ | | | |
| request_access | ✓ | ✓ | ✓ | | |
| approve_access | ✓ | ✓ | | | |
| decrypt_assets | ✓ | ✓ | ✓ | | |
| view_audit_trail | ✓ | | | ✓ | ✓ |
| manage_keys | ✓ | | | | |
| rotate_keys | ✓ | | | | |
| run_security_scan | ✓ | | | | ✓ |
| view_findings | ✓ | | | ✓ | ✓ |
| emergency_access | ✓ | | | | |
| view_blockchain | ✓ | ✓ | ✓ | ✓ | ✓ |

## Synthetic Demonstration Data
**Users:**
- Aarav Mehta — ADMIN — `0x1111...1111`
- Riya Sharma — MANAGER — `0x2222...2222`
- Arjun Verma — ENGINEER — `0x3333...3333`
- Neha Kapoor — AUDITOR — `0x4444...4444`
- Kabir Singh — SECURITY_ANALYST — `0x5555...5555`

**Assets:**
- BEL-RDR-001: Radar Signal Processing Specification (HIGH, Radar Systems)
- BEL-EW-002: Electronic Warfare Test Procedure (RESTRICTED, Electronic Warfare)
- BEL-AVI-003: Secure Avionics Interface Specification (HIGH, Avionics)
- BEL-CYB-004: Cybersecurity Incident Response Manual (CONFIDENTIAL, Cybersecurity)

## Technology Stack
- **Frontend/Backend:** Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Database/Storage:** Supabase (PostgreSQL, Storage)
- **Blockchain:** Solidity, Hardhat, ethers.js (deployed to Sepolia Testnet for demo)
- **Cryptography:** Node.js native crypto (AES-256-GCM)

## Success Criteria / KPIs
- Successful demonstration of the decoupled authorization/decryption flow.
- Verifiable hash-chain audit logs anchored to the testnet.
- Sentinel successfully detecting and blocking simulated attacks in the sandbox.
- High code coverage (>80% lib, >90% contracts).

## Prototype Scope & Limitations
> [!IMPORTANT]
> Honest Compromises for SIH Prototype:
> 1. **Testnet Deployment:** Both chains operate on the same testnet (Sepolia) in different namespaces. Production requires physically separate networks.
> 2. **Software KMS:** Uses a server-side TypeScript KMS abstraction. Production requires HSM-backed services.
> 3. **Gas Fees:** Paid by deployer wallets. Production needs meta-transactions/gas stations.
> 4. **DID Resolution:** Simplified scheme without full W3C infrastructure.
> 5. **Sandbox Isolation:** Shares the same DB instance; production needs a fully isolated environment.
> 6. **Hardware Binding:** Lacks FIDO2/WebAuthn attestation.

## Glossary
- **DID (Decentralized Identifier):** A unique, blockchain-anchored identity.
- **DEK (Data Encryption Key):** Key used to encrypt the actual asset data.
- **KEK (Key Encryption Key):** Master key used to encrypt DEKs (Envelope Encryption).
- **AEAD (Authenticated Encryption with Associated Data):** Cryptographic scheme ensuring confidentiality and authenticity (e.g., AES-GCM).
- **RBAC:** Role-Based Access Control.
- **KMS (Key Management System):** System managing the lifecycle of cryptographic keys.
- **Sentinel:** SecureMax's automated security testing and response engine.
