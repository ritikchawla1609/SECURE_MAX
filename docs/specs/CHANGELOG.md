# Changelog

All notable changes to the SecureMax SIH26125 project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Fixed - Final Hostile Security Audit Phase
- **CRITICAL Vulnerability Fixed (Authentication Bypass)**: `src/middleware.ts` was previously trusting unverified Base64 encoded session JWTs during the foundation UI phase. Upgraded to enforce strict cryptographic signature validation using `jose` (`jwtVerify`), making privilege escalation impossible.
- **CRITICAL Vulnerability Fixed (Data Leakage & IDOR)**: Next.js Server Actions (`src/app/actions/dashboard.ts`, `src/app/actions/sentinel.ts`) were utilizing `supabaseAdmin` (Service Role key) without explicitly validating the caller's session, enabling unauthenticated access to highly sensitive Sentinel findings and dashboard metrics. Built `src/lib/auth/session.ts` (`getVerifiedSession`) and secured all server actions with explicit Role Checks.
- **HIGH Vulnerability Fixed (Blockchain Injection)**: `logTransaction` server action accepted arbitrary payload inputs to log transactions to the database. Added strict session and validation boundaries to prevent malicious poisoning of the transaction status tracker.
- **HIGH Vulnerability Fixed (TOCTOU & KMS Bypass)**: `src/lib/api/access-flow.ts` `executeDecryption` previously relied on the outer API route to validate the `tempToken`. Refactored `executeDecryption` to inherently demand the `tempToken` and execute `validateTemporaryDecryptionToken` within the KMS execution boundary, satisfying the fail-closed KMS constraint.
- **Security Testing**: Wrote regression test suite (`test/security/audit.test.ts`) guaranteeing Server Actions reject IDOR, Privilege Escalation, and Data Leakage. Ran the full 13-test suite; all passed.

### Added - Product UI/UX Refinement Phase
- **Premium Cybersecurity Visuals**: Implemented dark, sophisticated enterprise styling across all components using custom Tailwind configuration.
- **Defense-In-Depth Landing Page**: Fully built `src/app/(public)/page.tsx` with all 16 requested sections.
- **Role-Based Dashboards**: Rebuilt completely for Admin, User/Engineer, Auditor, and Security Analyst roles using live deterministic data.
- **Responsive & Accessible AppShell**: Overhauled the `AppShell` and `Sidebar` layouts to support all 13 breakpoints.

### Added - Sentinel Security Engine Phase
- **Deterministic Sandbox Execution**: Implemented `src/lib/sentinel/engine.ts`. This engine orchestrates rigorous security verification without faking logic, applying actual attack vectors.

### Added - Core KMS & Cryptography Phase
- **Encryption Engine**: Implemented AES-256-GCM authenticated encryption and envelope KMS architecture.

### Added - Smart Contract Phase
- **Chain-1 & Chain-2**: Implemented the dual-domain blockchain security model using Solidity, Hardhat, and Wagmi.

### Added - Foundation Phase
- **Architecture**: App router, Supabase Schema, API standards.
