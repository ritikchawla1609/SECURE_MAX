import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import { 
  verifyAuditHashChain, 
  verifyMerkleInclusion, 
  computeExpectedEventHash,
  AuditVerificationRecord 
} from '../../scripts/verify-audit';
import { MerkleTree } from '../../src/lib/audit/merkle';

vi.mock('server-only', () => ({}));

describe('Phase 8: Audit Integrity & Independent Verifier Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createValidChain(count: number): AuditVerificationRecord[] {
    const records: AuditVerificationRecord[] = [];
    let prevHash = '0x0000000000000000000000000000000000000000000000000000000000000000';

    for (let i = 0; i < count; i++) {
      const eventType = `DEFENSE_ACCESS_GRANTED_${i}`;
      const actorId = `usr_operator_${i}`;
      const targetType = 'AVIONICS_ASSET';
      const targetId = `ast_radar_${i}`;
      const details = { clearance: 'SECRET', sequence: i };

      const eventHash = computeExpectedEventHash({
        eventType,
        actorId,
        targetType,
        targetId,
        details,
        prevHash,
      });

      records.push({
        id: `aud_${i}`,
        eventType,
        actorId,
        targetType,
        targetId,
        details,
        prevHash,
        eventHash,
      });

      prevHash = eventHash;
    }

    return records;
  }

  it('1. PASSES VALID HASH CHAIN: Completely intact sequential hash-chain is verified', () => {
    const chain = createValidChain(10);
    const result = verifyAuditHashChain(chain);

    expect(result.isValid).toBe(true);
    expect(result.tamperedIndices.length).toBe(0);
  });

  it('2. DETECTS CONTENT TAMPERING: Adversary changes event payload without updating hash', () => {
    const chain = createValidChain(5);
    // Adversary modifies targetId or details in record 2
    chain[2].details = { clearance: 'UNAUTHORIZED_UPGRADE', sequence: 2 };

    const result = verifyAuditHashChain(chain);
    expect(result.isValid).toBe(false);
    expect(result.tamperedIndices).toContain(2);
  });

  it('3. DETECTS HASH FORGERY: Adversary forges eventHash in middle of chain', () => {
    const chain = createValidChain(5);
    chain[3].eventHash = '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';

    const result = verifyAuditHashChain(chain);
    expect(result.isValid).toBe(false);
    expect(result.tamperedIndices).toContain(3);
  });

  it('4. DETECTS CHAIN LINKAGE BREAK: Broken prevHash link flags tampering immediately', () => {
    const chain = createValidChain(6);
    // Break link at index 4
    chain[4].prevHash = '0x1111111111111111111111111111111111111111111111111111111111111111';

    const result = verifyAuditHashChain(chain);
    expect(result.isValid).toBe(false);
    expect(result.tamperedIndices).toContain(4);
  });

  it('5. HANDLES EMPTY CHAIN BOUNDARY: Zero events returns valid without errors', () => {
    const result = verifyAuditHashChain([]);
    expect(result.isValid).toBe(true);
    expect(result.tamperedIndices.length).toBe(0);
  });

  it('6. HANDLES SINGLE-EVENT CHAIN: Single genesis event verified correctly', () => {
    const chain = createValidChain(1);
    const result = verifyAuditHashChain(chain);
    expect(result.isValid).toBe(true);
    expect(result.tamperedIndices.length).toBe(0);
  });

  it('7. GENERATES AND VERIFIES MERKLE INCLUSION PROOFS: 100% valid leaves pass', () => {
    const leaves = [
      '0xaaaa1111222233334444555566667777888899990000aaaabbbbccccddddeeee01',
      '0xaaaa1111222233334444555566667777888899990000aaaabbbbccccddddeeee02',
      '0xaaaa1111222233334444555566667777888899990000aaaabbbbccccddddeeee03',
      '0xaaaa1111222233334444555566667777888899990000aaaabbbbccccddddeeee04',
      '0xaaaa1111222233334444555566667777888899990000aaaabbbbccccddddeeee05',
    ];

    const result = verifyMerkleInclusion(leaves);
    expect(result.allValid).toBe(true);
    expect(result.invalidLeaves.length).toBe(0);
    expect(result.root).toBeDefined();
    expect(result.root.startsWith('0x')).toBe(true);
  });

  it('8. REJECTS TAMPERED MERKLE LEAF: Forged proof fails cryptographic verification', () => {
    const leaves = [
      '0xleaf11111111111111111111111111111111111111111111111111111111111111',
      '0xleaf22222222222222222222222222222222222222222222222222222222222222',
      '0xleaf33333333333333333333333333333333333333333333333333333333333333',
    ];

    const tree = new MerkleTree(leaves);
    const root = tree.getRoot();
    const proof = tree.getProof(leaves[0]);

    // Attempt verification with a modified leaf
    const tamperedLeaf = '0xleaf_tampered_malicious_content';
    const isValid = MerkleTree.verifyProof(tamperedLeaf, proof, root);

    expect(isValid).toBe(false);
  });

  it('9. VERIFIES LARGE BATCH (64 LEAVES): Merkle tree scales deterministically', () => {
    const leaves: string[] = [];
    for (let i = 0; i < 64; i++) {
      leaves.push(crypto.createHash('sha256').update(`batch_event_${i}`).digest('hex'));
    }

    const result = verifyMerkleInclusion(leaves);
    expect(result.allValid).toBe(true);
    expect(result.invalidLeaves.length).toBe(0);
  });

  it('10. INTEGRATES WITH ZERO-TRUST STORE AUDIT EVENTS: Local store events verify cleanly', async () => {
    const { deviceStore } = await import('../../src/lib/auth/deviceStore');
    
    // Record test audit event
    const evt = deviceStore.recordAuditEvent({
      eventType: 'KMS_DEK_ROTATION_EVENT',
      description: 'Rotated key version in zero-trust vault',
      targetId: 'key_v2',
      severity: 'INFO',
    });

    expect(evt).toBeDefined();
    expect(evt.event_hash).toBeDefined();
    expect(evt.event_hash.startsWith('0x')).toBe(true);

    const events = deviceStore.getAuditEvents();
    expect(events.length).toBeGreaterThanOrEqual(1);

    const leaves = events.map(e => e.event_hash);
    const merkleResult = verifyMerkleInclusion(leaves);
    expect(merkleResult.allValid).toBe(true);
  });
});
