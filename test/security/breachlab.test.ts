import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SCENARIO_CATALOG, getScenarioById, getScenariosByCategory } from '../../src/lib/breachlab/catalog';
import { sanitizeData, buildSanitizedEvidence } from '../../src/lib/breachlab/sanitizer';
import { BreachLabOrchestrator, breachLabOrchestrator } from '../../src/lib/breachlab/orchestrator';
import { BreachLabRunStatus, ControlStatus, ScenarioCategory } from '../../src/lib/breachlab/types';
import { initializeBreachLabFixtures, cleanupBreachLabFixtures } from '../../src/lib/breachlab/fixtures';
import { UserRole, SeverityLevel } from '../../src/types';
import {
  exerciseUnauthorizedAccess,
  exerciseRevokedAccess,
  exerciseExpiredToken,
  exerciseReplayToken,
  exerciseCiphertextAndTagTampering,
  exerciseCrossAssetKeySubstitution,
  exerciseBlockchainFailClosed,
  exerciseAuditTamperingDetection,
  exerciseDeviceTrustViolation,
  exerciseStorageFailureRollback,
  exercisePrivilegeEscalation,
} from '../../src/lib/breachlab/adapters';

vi.mock('server-only', () => ({}));

// Mock Supabase database client to isolate BreachLab unit tests
vi.mock('../../src/lib/db/client', () => {
  const mockChain: any = {
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  return {
    supabaseAdmin: {
      from: vi.fn().mockReturnValue(mockChain),
    },
    createAuthenticatedClient: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue(mockChain),
    }),
    isSupabaseConfigured: () => false,
  };
});

// Mock audit logger to verify audit events without external DB dependencies
vi.mock('../../src/lib/audit/logger', () => ({
  logAuditEvent: vi.fn().mockResolvedValue('audit-hash-12345'),
}));

describe('SecureMAX BreachLab Security Testing Subsystem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Scenario Catalog Invariants', () => {
    it('MUST DEFINE ALL 10 MANDATED ADVERSARIAL SCENARIOS', () => {
      expect(SCENARIO_CATALOG).toHaveLength(10);
      const expectedIds = [
        'SCN-AUTH-01',
        'SCN-AUTH-02',
        'SCN-KMS-03',
        'SCN-CRYP-04',
        'SCN-CRYP-05',
        'SCN-BC-06',
        'SCN-AUD-07',
        'SCN-DEV-08',
        'SCN-STO-09',
        'SCN-RBAC-10',
      ];
      const actualIds = SCENARIO_CATALOG.map((s) => s.id);
      expect(actualIds).toEqual(expectedIds);
    });

    it('EACH SCENARIO CONTAINS COMPLETE METADATA, THREAT MODEL & MITIGATION', () => {
      for (const scn of SCENARIO_CATALOG) {
        expect(scn.id).toMatch(/^SCN-[A-Z]+-\d{2}$/);
        expect(scn.title.length).toBeGreaterThan(10);
        expect(scn.description.length).toBeGreaterThan(20);
        expect(scn.threatModel.length).toBeGreaterThan(20);
        expect(scn.expectedSecurityBehavior.length).toBeGreaterThan(10);
        expect(scn.remediationGuidance.length).toBeGreaterThan(20);
        expect(scn.cweId).toMatch(/^CWE-\d+/);
        expect([SeverityLevel.CRITICAL, SeverityLevel.HIGH, SeverityLevel.MEDIUM]).toContain(scn.severity);
        expect(scn.steps.length).toBeGreaterThanOrEqual(3);
        expect(scn.preconditions.length).toBeGreaterThanOrEqual(1);
        expect(scn.requiredFixtures.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('LOOKUP HELPERS (getScenarioById, getScenariosByCategory) OPERATE PRECISELY', () => {
      const s1 = getScenarioById('SCN-AUTH-01');
      expect(s1).toBeDefined();
      expect(s1?.category).toBe(ScenarioCategory.ACCESS_CONTROL);

      const cryptoScenarios = getScenariosByCategory(ScenarioCategory.CRYPTOGRAPHY);
      expect(cryptoScenarios.length).toBeGreaterThanOrEqual(1);
      expect(cryptoScenarios.map((s) => s.id)).toContain('SCN-CRYP-04');
    });
  });

  describe('2. Sanitization Engine & Zero Key-Leak Invariants', () => {
    it('REDACTS 256-BIT MASTER KEYS AND DEKS WITH SHA-256 HINT', () => {
      const secretKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      const payload = {
        message: 'Decryption payload',
        key_hex: secretKey,
        nested: {
          key: secretKey,
        },
      };

      const { sanitized, redactions } = sanitizeData(payload);
      expect(sanitized.key_hex).toContain('[REDACTED_256_BIT_KEY:sha256_hint=');
      expect(sanitized.key_hex).not.toContain(secretKey);
      expect(sanitized.nested.key).not.toContain(secretKey);
      expect(redactions.some((r) => r.startsWith('256_BIT_KEY_HASH:'))).toBe(true);
    });

    it('REDACTS JWT SIGNATURES TO PREVENT TOKEN FORGERY OR REPLAY LEAKAGE', () => {
      const mockJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const { sanitized, redactions } = sanitizeData({ token: mockJwt });
      expect(sanitized.token).toContain('[REDACTED_SIGNATURE]');
      expect(sanitized.token).not.toContain('SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c');
      expect(redactions).toContain('JWT_SIGNATURE_TOKEN');
    });

    it('SCRUBS SENSITIVE KEY PROPERTIES LIKE masterKey, dekPlaintext, password', () => {
      const data = {
        masterKey: 'super-secret-key-material',
        dekPlaintext: 'raw-dek-bytes',
        password: 'password123',
        normalField: 'safe-value',
      };
      const { sanitized } = sanitizeData(data);
      expect(sanitized.masterKey).toBe('[REDACTED_MASTERKEY]');
      expect(sanitized.dekPlaintext).toBe('[REDACTED_DEKPLAINTEXT]');
      expect(sanitized.password).toBe('[REDACTED_PASSWORD]');
      expect(sanitized.normalField).toBe('safe-value');
    });

    it('buildSanitizedEvidence PRODUCES SECURE EVIDENCE OBJECT', () => {
      const ev = buildSanitizedEvidence(
        'AUTHENTICATION_TAG',
        'Tampered Tag Check',
        'Verification of auth tag mismatch',
        {
          tag: 'deadbeefdeadbeefdeadbeefdeadbeef',
          rawBytes: Buffer.from('unencrypted payload'),
        }
      );

      expect(ev.id).toBeDefined();
      expect(ev.timestamp).toBeDefined();
      expect(ev.title).toBe('Tampered Tag Check');
      expect(ev.redactionsApplied.length).toBeGreaterThan(0);
    });
  });

  describe('3. Adversarial Security Enforcement Adapters', () => {
    let fixtures: any;

    beforeEach(async () => {
      fixtures = await initializeBreachLabFixtures();
    });

    it('SCENARIO 1 (SCN-AUTH-01): Blocks unauthorized asset access and releases zero DEK', async () => {
      const result = await exerciseUnauthorizedAccess({
        userId: fixtures.attackerUser.id,
        assetId: fixtures.syntheticAssetAlpha.id,
        sessionId: fixtures.sessionAdversaryId,
      });
      expect(result.blocked).toBe(true);
      expect(result.tokenIssued).toBe(false);
    });

    it('SCENARIO 2 (SCN-AUTH-02): Enforces authorization revocation on subsequent access', async () => {
      const result = await exerciseRevokedAccess({
        adminId: 'usr_admin_001',
        userId: fixtures.tempAuthorizedUser.id,
        assetId: fixtures.syntheticAssetAlpha.id,
        sessionId: fixtures.sessionLegitId,
        deviceId: fixtures.testDevice.id,
      });
      expect(result.initialAccessWorked).toBe(true);
      expect(result.revokedAccessBlocked).toBe(true);
    });

    it('SCENARIO 3 (SCN-KMS-03): Rejects expired and replayed authorization tokens', async () => {
      const expiredResult = await exerciseExpiredToken({
        userId: fixtures.tempAuthorizedUser.id,
        assetId: fixtures.syntheticAssetAlpha.id,
        sessionId: fixtures.sessionLegitId,
      });
      expect(expiredResult.blocked).toBe(true);

      const replayResult = await exerciseReplayToken({
        userId: fixtures.tempAuthorizedUser.id,
        assetId: fixtures.syntheticAssetAlpha.id,
        legitSessionId: fixtures.sessionLegitId,
        replayedSessionId: fixtures.sessionAdversaryId,
      });
      expect(replayResult.blocked).toBe(true);
    });

    it('SCENARIO 4 (SCN-CRYP-04): Rejects AES-GCM ciphertext and authentication tag tampering', async () => {
      const result = await exerciseCiphertextAndTagTampering();
      expect(result.ciphertextTamperingBlocked).toBe(true);
      expect(result.authTagTamperingBlocked).toBe(true);
      expect(result.corruptedPlaintextLeaked).toBe(false);
    });

    it('SCENARIO 5 (SCN-CRYP-05): Prevents cross-asset key substitution with AAD binding', async () => {
      const result = await exerciseCrossAssetKeySubstitution({
        assetAlphaId: fixtures.syntheticAssetAlpha.id,
        assetBetaId: fixtures.syntheticAssetBeta.id,
      });
      expect(result.crossUnwrapBlocked).toBe(true);
      expect(result.tokenSubstitutionBlocked).toBe(true);
    });

    it('SCENARIO 6 (SCN-BC-06): Fails closed on blockchain RPC failure or contract revert', async () => {
      const result = await exerciseBlockchainFailClosed({
        assetId: fixtures.syntheticAssetAlpha.id,
        userId: fixtures.attackerUser.id,
        sessionId: fixtures.sessionAdversaryId,
      });
      expect(result.chain1RpcFailureHandled).toBe(true);
      expect(result.chain2RevertHandled).toBe(true);
      expect(result.failClosedEnforced).toBe(true);
    });

    it('SCENARIO 7 (SCN-AUD-07): Successfully detects audit hash-chain tampering', async () => {
      const result = await exerciseAuditTamperingDetection();
      expect(result.originalChainValid).toBe(true);
      expect(result.tamperedLinkageDetected).toBe(true);
      expect(result.merkleMismatchDetected).toBe(true);
    });

    it('SCENARIO 8 (SCN-DEV-08): Enforces device-trust and blocks revoked/unknown devices', async () => {
      const result = await exerciseDeviceTrustViolation({
        userId: fixtures.deviceTesterUser.id,
        deviceId: fixtures.testDevice.id,
        sessionId: fixtures.sessionLegitId,
        assetId: fixtures.syntheticAssetAlpha.id,
      });
      expect(result.activeDeviceAllowed).toBe(true);
      expect(result.suspendedDeviceBlocked).toBe(true);
      expect(result.revokedSessionBlocked).toBe(true);
    });

    it('SCENARIO 9 (SCN-STO-09): Upload & storage failure triggers atomic rollback', async () => {
      const result = await exerciseStorageFailureRollback();
      expect(result.failureReported).toBe(true);
      expect(result.recordRolledBack).toBe(true);
      expect(result.orphanedRecordsCount).toBe(0);
    });

    it('SCENARIO 10 (SCN-RBAC-10): Enforces RBAC privilege boundaries against role escalation', async () => {
      const result = await exercisePrivilegeEscalation({
        standardUserId: fixtures.standardUser.id,
      });
      expect(result.adminPanicBlocked).toBe(true);
      expect(result.securityScanBlocked).toBe(true);
      expect(result.serverSideAuthorityEnforced).toBe(true);
    });
  });

  describe('4. BreachLab Orchestrator & Lifecycle Management', () => {
    it('EXECUTES SELECTED SCENARIOS AND GENERATES STRUCTURED RESULTS', async () => {
      const orchestrator = new BreachLabOrchestrator();
      const run = await orchestrator.executeRun({
        scenarioIds: ['SCN-AUTH-01', 'SCN-CRYP-04'],
        title: 'Automated CI Security Regression Test',
        user: {
          userId: 'ci-security-runner',
          role: UserRole.ADMIN,
        },
      });

      expect(run.id).toMatch(/^run_/);
      expect(run.title).toBe('Automated CI Security Regression Test');
      expect([BreachLabRunStatus.PASSED, BreachLabRunStatus.COMPLETED]).toContain(run.status);
      expect(run.summary.total).toBe(2);
      expect(run.summary.passed).toBe(2);
      expect(run.summary.failed).toBe(0);
      expect(run.results).toHaveLength(2);

      // Verify each scenario has control checks
      const scn1 = run.results.find((r) => r.scenarioId === 'SCN-AUTH-01');
      expect(scn1).toBeDefined();
      expect(scn1?.controlsExercised.length).toBeGreaterThan(0);
      expect(scn1?.controlsExercised[0].status).toBe(ControlStatus.SATISFIED);

      const scn4 = run.results.find((r) => r.scenarioId === 'SCN-CRYP-04');
      expect(scn4).toBeDefined();
      expect(scn4?.controlsExercised.length).toBeGreaterThan(0);
      expect(scn4?.controlsExercised[0].status).toBe(ControlStatus.SATISFIED);
    });

    it('HANDLES SAFE RUN CANCELLATION', async () => {
      const orchestrator = new BreachLabOrchestrator();
      const run = await orchestrator.executeRun({
        scenarioIds: ['SCN-AUTH-01'],
      });

      const cancelResult = orchestrator.cancelRun(run.id);
      expect(typeof cancelResult).toBe('boolean');
    });

    it('COMPARES TWO RUNS ACCURATELY (Differential Analysis)', async () => {
      const orchestrator = new BreachLabOrchestrator();
      const runA = await orchestrator.executeRun({
        scenarioIds: ['SCN-AUTH-01'],
        title: 'Run A',
      });
      const runB = await orchestrator.executeRun({
        scenarioIds: ['SCN-AUTH-01', 'SCN-AUTH-02'],
        title: 'Run B',
      });

      const comparison = orchestrator.compareRuns(runA.id, runB.id);
      expect(comparison.runA.id).toBe(runA.id);
      expect(comparison.runB.id).toBe(runB.id);
      expect(comparison.coverageDelta.scenariosDelta).toBe(1);
    });

    it('EXPORTS REPORT IN JSON AND MARKDOWN FORMATS', async () => {
      const orchestrator = new BreachLabOrchestrator();
      const run = await orchestrator.executeRun({
        scenarioIds: ['SCN-AUTH-01', 'SCN-CRYP-04'],
        title: 'Export Verification Run',
      });

      const jsonReport = orchestrator.exportRun(run.id, 'json');
      const parsed = JSON.parse(jsonReport);
      expect(parsed.id).toBe(run.id);
      expect(parsed.results.length).toBe(2);

      const mdReport = orchestrator.exportRun(run.id, 'markdown');
      expect(mdReport).toContain('# SecureMAX BreachLab Execution Report');
      expect(mdReport).toContain(`**Run ID:** \`${run.id}\``);
      expect(mdReport).toContain('### ✅ [SCN-AUTH-01]');
      expect(mdReport).toContain('### ✅ [SCN-CRYP-04]');
    });
  });

  describe('5. Fixture Lifecycle & Idempotent Cleanup', () => {
    it('CLEANS UP SYNTHETIC TEST FIXTURES WITHOUT AFFECTING PRODUCTION DATA', async () => {
      const fixtures = await initializeBreachLabFixtures();
      expect(fixtures.attackerUser.id).toContain('breachlab_synthetic');
      expect(fixtures.syntheticAssetAlpha.name).toContain('BreachLab');
      expect(fixtures.syntheticAssetAlpha.id).toMatch(/^ast_/);

      await expect(cleanupBreachLabFixtures(fixtures)).resolves.not.toThrow();
    });
  });
});
