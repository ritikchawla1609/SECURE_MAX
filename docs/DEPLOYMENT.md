# SecureMAX Production Deployment & Operations Guide

**Version:** 1.0.0  
**Target Environments:** Vercel (Edge & Node.js Serverless), Supabase / PostgreSQL, EVM Networks (Ethereum Sepolia / Mainnet / Base)  

---

## 1. Environment Architecture & Separation

SecureMAX strictly isolates environments across three tiers:

```
+-----------------------------------------------------------------------------------------+
|                                  ENVIRONMENT MATRIX                                     |
+-------------------+---------------------------+-----------------------------------------+
| Environment       | KMS Provider              | Blockchain Target                       |
+-------------------+---------------------------+-----------------------------------------+
| **Development**   | `DevSoftwareKMSProvider`  | Hardhat Local Node (`127.0.0.1:8545`)   |
| **Staging / CI**  | `DevSoftwareKMSProvider`  | Ethereum Sepolia Testnet                |
| **Production**    | `ExternalKMSProvider`     | Base / Ethereum Mainnet / Private EVM   |
+-------------------+---------------------------+-----------------------------------------+
```

---

## 2. Secrets Management & Environment Configuration

### 2.1 Required Environment Variables

Create `.env.local` for local execution or inject via cloud secrets management (e.g., Vercel Secrets, AWS Secrets Manager, Doppler):

```bash
# ==============================================================================
# SECUREMAX RUNTIME ENVIRONMENT CONFIGURATION
# ==============================================================================
NODE_ENV=production

# --- Next.js Application Core ---
NEXT_PUBLIC_APP_URL=https://securemax.corp
PORT=3000

# --- Cryptographic & JWT Secrets ---
# Minimum 32-character high-entropy secret for signing session tokens
JWT_SECRET=c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7

# Master Key for KMS Envelope Cryptography (64 hex characters = 32 bytes)
# PROHIBITED: Do not use zero-valued or default keys in production!
SECUREMAX_KMS_MASTER_KEY=4a8f9c1b2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a

# --- KMS Provider Selection ---
# Options: 'software' (Dev only) | 'external' (AWS KMS, Vault, Cloud HSM)
SECUREMAX_KMS_PROVIDER=external
KMS_KEY_ARN=arn:aws:kms:us-east-1:123456789012:key/b63c9b74-3c8e-4a61-9c6a-4f516a2b8e39
KMS_ENDPOINT=
KMS_AUTH_TOKEN=

# --- Database & Storage (Supabase) ---
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
STORAGE_BUCKET_NAME=securemax-encrypted-assets

# --- Blockchain Network (Chain-1 & Chain-2) ---
NEXT_PUBLIC_CHAIN_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
CHAIN_DEPLOYER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# --- Deployed Smart Contract Addresses (Sepolia / Mainnet) ---
NEXT_PUBLIC_ASSET_REGISTRY_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
NEXT_PUBLIC_IDENTITY_REGISTRY_ADDRESS=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
NEXT_PUBLIC_RBAC_MANAGER_ADDRESS=0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
NEXT_PUBLIC_AUDIT_ANCHOR_ADDRESS=0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
NEXT_PUBLIC_KEY_LIFECYCLE_ADDRESS=0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9
NEXT_PUBLIC_KEY_POLICY_MANAGER_ADDRESS=0x5FC8d32690cc91D4c39d9d3abcBD16989F875707
NEXT_PUBLIC_DECRYPTION_AUTH_ADDRESS=0x0165878A594ca255338adfa4d48449f69242Eb8F
```

---

## 3. Database Migrations & Initial Setup

SecureMAX utilizes PostgreSQL with Row-Level Security (RLS) policies.

### 3.1 Executing Database Migrations
Run database schema scripts via Supabase CLI or direct `psql` connection:
```bash
# Push schema migrations
npm run db:migrate

# Seed administrative accounts and baseline demo assets
npm run db:seed
```

### 3.2 Storage Bucket Provisioning
In the Supabase / S3 dashboard:
1. Create private bucket named `securemax-encrypted-assets`.
2. Disable public reads (`public: false`).
3. Set upload file size limit: `50MB` (or organization quota).
4. Restrict allowed MIME types to `application/octet-stream` (all uploads are stored as encrypted binary blobs).

---

## 4. Smart Contract Compilation & Deployment

The platform relies on 7 Solidity 0.8.24 smart contracts compiled via Hardhat.

### 4.1 Compiling Smart Contracts
```bash
npm run contracts:compile
```

### 4.2 Local Testnet Deployment (Hardhat Node)
```bash
# In Terminal 1: Run local node
npx hardhat node

# In Terminal 2: Deploy all 7 contracts and write deployed-addresses.json
npm run contracts:deploy:local
```

### 4.3 Sepolia Testnet Deployment
Ensure `CHAIN_DEPLOYER_PRIVATE_KEY` has Sepolia test ETH for gas:
```bash
npm run contracts:deploy:sepolia
```
The deployment script outputs contract addresses and updates `deployed-addresses.json` automatically.

---

## 5. Build & Verification Procedures

Before deploying to staging or production, execute the complete verification pipeline:

```bash
# 1. Static Linting & Style Validation
npm run lint

# 2. Smart Contract Unit Tests (50/50 passing)
npm run contracts:test

# 3. Cryptographic, Authentication & Sentinel Test Suite (107/107 passing)
npm run test

# 4. Next.js Production Build (37/37 static/dynamic routes compiled)
npm run build
```

---

## 6. Monitoring, Health Checks & Observability

1. **System Health Endpoint:**
   `GET /api/health` returns status of the database connection, KMS provider, and blockchain RPC nodes:
   ```json
   {
     "status": "HEALTHY",
     "components": {
       "database": "CONNECTED",
       "kms": "READY",
       "chain1": "ONLINE",
       "chain2": "ONLINE"
     }
   }
   ```
2. **Sentinel Threat Engine:**
   Regularly triggers sandbox attacks via background cron or SOC triggers to confirm defense-in-depth posture remains intact.
3. **Audit Anchoring Monitor:**
   Tracks the delta between the latest database audit event and the latest confirmed anchor index on `AuditAnchor.sol`. Alerts SOC if the unanchored batch size exceeds 500 events.
