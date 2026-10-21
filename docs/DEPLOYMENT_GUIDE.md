# SecureMAX Deployment & Configuration Guide

> **Stack**: Next.js 14 App Router, TypeScript 5, Node.js >= 18, Supabase PostgreSQL, EVM Local / Testnet  
> **Production Target**: Vercel / Docker Container / Bare Metal

---

## 1. Prerequisites

- **Node.js**: `v18.17.0` or higher (Tested on `v20.x` and `v24.x`)
- **Package Manager**: `npm`
- **Optional External Services**:
  - Supabase Project (PostgreSQL + RLS + Storage)
  - Ethereum JSON-RPC Endpoint (or local Hardhat node)

---

## 2. Environment Configuration

Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

### Required Configuration Variables
```env
# Cryptographic Master Key (Must be 64-character hex string / 256 bits)
SECUREMAX_KMS_MASTER_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# JWT Signing Secret (Minimum 32 characters long)
JWT_SECRET=securemax-production-jwt-secret-minimum-32-chars-long-secure-padding

# Supabase Persistence (Optional: if unset, in-memory zero-trust store is active)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Blockchain RPC Providers (Optional: defaults to local Hardhat node)
NEXT_PUBLIC_CHAIN1_RPC_URL=http://127.0.0.1:8545
NEXT_PUBLIC_CHAIN2_RPC_URL=http://127.0.0.1:8545
```

---

## 3. Installation & Verification

```bash
# 1. Install dependencies strictly from package-lock.json
npm install

# 2. Run smart contract test suite
npx hardhat test

# 3. Run unit and integration security suite
npm test

# 4. Run automated smoke tests (Vitest + Playwright)
npm run test:smoke

# 5. Typecheck & Lint
npx tsc --noEmit
npm run lint

# 6. Build production package
npm run build
```

---

## 4. Starting the Server

```bash
# Production server
npm start

# Development mode
npm run dev
```
Navigate to `http://localhost:3000`.
