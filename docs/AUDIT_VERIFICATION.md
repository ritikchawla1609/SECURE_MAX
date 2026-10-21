# SecureMAX Audit Integrity & Independent Evidence Verification

> **Integrity Mechanisms**: SHA-256 Hash Chaining, RFC 6962 Compliant Merkle Trees, Chain-2 Blockchain Anchoring  
> **Standalone Verifier Tool**: `scripts/verify-audit.ts`

---

## 1. Audit Ledger Architecture

Every security-sensitive operation (authentication, key generation, access grant, revocation, and decryption) creates an immutable audit event with the canonical structure:

```json
{
  "id": "evt_uuid",
  "eventType": "DECRYPT",
  "actorId": "usr_vasu_002",
  "targetId": "ast_alpha",
  "timestamp": "2026-10-21T11:00:00.000Z",
  "details": {
    "keyVersion": "v1",
    "ipAddress": "192.168.1.10"
  },
  "previousHash": "a1b2c3...",
  "hash": "d4e5f6..."
}
```

### Hash-Chain Invariant
The event `hash` is computed deterministically as:
$$\text{hash}_n = \text{SHA256}(\text{previousHash}_{n-1} \parallel \text{id} \parallel \text{eventType} \parallel \text{actorId} \parallel \text{timestamp} \parallel \text{canonicalJSON}(\text{details}))$$

If an attacker alters any field in event $k$, the hash mismatch cascades through all subsequent events $k+1 \dots N$.

---

## 2. Merkle Tree Batch Anchoring

Periodically, completed audit sequences are grouped into batches:
1. Each event hash forms a Merkle leaf node.
2. The Merkle root is computed via pairwise SHA-256 hashing.
3. The Merkle root is anchored into the `AuditAnchor.sol` smart contract on Chain-2 via `anchorBatch(root, startId, endId)`.
4. Anyone can extract a Merkle inclusion proof to demonstrate that a specific access record was captured in the on-chain anchor without revealing other records.

---

## 3. Running Independent Verification

Judges and auditors do not need to rely on the SecureMAX dashboard to verify evidence. The standalone command-line verifier inspects exported evidence bundles:

```bash
# Run standalone audit verification script
npx tsx scripts/verify-audit.ts
```

Output:
```text
[AUDIT VERIFIER] Loaded 10 audit records from bundle.
[HASH CHAIN CHECK] Verifying SHA-256 chain linkage... PASS (10/10 verified)
[MERKLE ROOT CHECK] Recomputing Merkle root from leaves... PASS
[ON-CHAIN CHECK] Validating root against AuditAnchor contract... PASS
[STATUS] EVIDENCE BUNDLE FULLY VERIFIED & UNTAMPERED.
```
