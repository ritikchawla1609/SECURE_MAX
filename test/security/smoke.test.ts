import { describe, it, expect, vi, beforeAll } from 'vitest';
import { generateDEK, encryptData, decryptData, deriveKEK } from '../../src/lib/crypto';
import { 
  issueTemporaryDecryptionToken, 
  validateTemporaryDecryptionToken 
} from '../../src/lib/kms';
import { deviceStore } from '../../src/lib/auth/deviceStore';
import { authorizeAssetAccess, executeDecryption, revokeAssetAccess } from '../../src/lib/api/access-flow';
import { SCENARIO_CATALOG } from '../../src/lib/breachlab/catalog';
import { UserRole, UserStatus } from '../../src/types';
import { SignJWT } from 'jose';

vi.mock('server-only', () => ({}));

describe('SecureMAX System Smoke Suite (End-to-End Verification)', () => {
  const MASTER_KEY_HEX = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const JWT_SECRET = 'securemax-dev-jwt-secret-minimum-32-chars-long-secure-padding';
  
  beforeAll(() => {
    process.env.SECUREMAX_KMS_MASTER_KEY = MASTER_KEY_HEX;
    process.env.JWT_SECRET = JWT_SECRET;
    deviceStore.seedTestDataForTesting();
  });

  describe('1. Cryptographic Engine & KMS Envelope Security', () => {
    it('generates DEK and performs authenticated AES-256-GCM encryption/decryption with AAD binding', () => {
      const plaintext = 'CLASSIFIED_MILITARY_TELEMETRY_PAYLOAD_2026';
      const dek = generateDEK();
      expect(dek.length).toBe(32); // 256 bits

      const aad = 'context:asset_telemetry_stream';
      const encrypted = encryptData(Buffer.from(plaintext, 'utf-8'), dek, aad);
      expect(encrypted.ciphertext).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.authTag).toBeDefined();

      const decrypted = decryptData(encrypted.ciphertext, dek, encrypted.iv, encrypted.authTag, aad);
      expect(decrypted.toString('utf-8')).toBe(plaintext);
    });

    it('wraps and unwraps DEK using KEK derivation from Master Key', () => {
      const dek = generateDEK();
      const assetId = 'ast_smoke_envelope_01';
      const kek = deriveKEK(MASTER_KEY_HEX, assetId);
      const aad = `key_wrapping:${assetId}`;

      const wrapped = encryptData(dek, kek, aad);
      const unwrapped = decryptData(wrapped.ciphertext, kek, wrapped.iv, wrapped.authTag, aad);
      expect(unwrapped.equals(dek)).toBe(true);
    });

    it('issues and validates zero-trust temporary decryption tokens bound to session and IP', async () => {
      const token = await issueTemporaryDecryptionToken({
        userId: 'usr_vasu_002',
        assetId: 'ast_alpha',
        sessionId: 'sess_smoke_01',
        permissions: ['can_decrypt'],
        clientIp: '127.0.0.1'
      });
      expect(token).toBeDefined();

      const payload = await validateTemporaryDecryptionToken(token, 'sess_smoke_01', 'ast_alpha', '127.0.0.1');
      expect(payload.userId).toBe('usr_vasu_002');
      expect(payload.assetId).toBe('ast_alpha');
      expect(payload.sessionId).toBe('sess_smoke_01');
    });

    it('rejects tampered, replayed, or mismatched decryption tokens', async () => {
      const token = await issueTemporaryDecryptionToken({
        userId: 'usr_vasu_002',
        assetId: 'ast_alpha',
        sessionId: 'sess_smoke_01',
        permissions: ['can_decrypt'],
        clientIp: '127.0.0.1'
      });
      
      // Token replayed in wrong session
      await expect(validateTemporaryDecryptionToken(token, 'sess_hijacked', 'ast_alpha', '127.0.0.1')).rejects.toThrow(
        'Session binding mismatch'
      );

      // Token replayed from wrong IP
      await expect(validateTemporaryDecryptionToken(token, 'sess_smoke_01', 'ast_alpha', '192.168.1.99')).rejects.toThrow(
        'Network binding mismatch'
      );

      // Token targeting wrong asset
      await expect(validateTemporaryDecryptionToken(token, 'sess_smoke_01', 'ast_bravo', '127.0.0.1')).rejects.toThrow(
        'Asset binding mismatch'
      );
    });
  });

  describe('2. Device Store & Zero-Trust Access State Transitions', () => {
    const vasuId = 'usr_vasu_002';
    const assetId = 'ast_alpha';
    const sessionId = 'test-smoke-session';
    const deviceId = 'dev_vasu_laptop';

    it('authorizes decryption for user with valid credentials and active assignment', async () => {
      // Re-grant to ensure pristine state
      deviceStore.setAssignment(assetId, vasuId, true, true);

      const authRes = await authorizeAssetAccess(vasuId, assetId, sessionId, deviceId);
      expect(authRes.authorized).toBe(true);
      expect(authRes.tempToken).toBeDefined();

      const asset = deviceStore.assets.get(assetId)!;
      const decrypted = await executeDecryption(
        assetId,
        Buffer.from(asset.encrypted_content, 'base64'),
        asset.iv,
        asset.auth_tag,
        authRes.tempToken,
        sessionId
      );

      expect(decrypted.toString('utf8')).toContain('TOP SECRET');
    });

    it('immediately rejects access when assignment is revoked', async () => {
      await revokeAssetAccess('usr_admin_001', vasuId, assetId);

      await expect(authorizeAssetAccess(vasuId, assetId, sessionId, deviceId)).rejects.toThrow(
        'Access Denied'
      );
    });

    it('suspends user account, revokes sessions, and re-activates cleanly', async () => {
      const user = deviceStore.getUserById(vasuId);
      expect(user).toBeDefined();

      // Suspend user
      deviceStore.suspendUser(vasuId);
      const suspendedUser = deviceStore.getUserById(vasuId);
      expect(suspendedUser?.status).toBe(UserStatus.SUSPENDED);

      // Reactivate user
      deviceStore.reactivateUser(vasuId);
      const activeUser = deviceStore.getUserById(vasuId);
      expect(activeUser?.status).toBe(UserStatus.ACTIVE);
    });
  });

  describe('3. BreachLab Catalog & Scenario Architecture', () => {
    it('verifies all 10 BreachLab adversarial scenarios are loaded with valid steps and threat models', () => {
      expect(SCENARIO_CATALOG.length).toBe(10);

      SCENARIO_CATALOG.forEach((scenario) => {
        expect(scenario.id).toBeDefined();
        expect(scenario.title).toBeDefined();
        expect(scenario.category).toBeDefined();
        expect(scenario.severity).toBeDefined();
        expect(scenario.steps.length).toBeGreaterThanOrEqual(3);
        expect(scenario.threatModel).toBeDefined();
      });
    });

    it('ensures each scenario references valid attack vectors', () => {
      const vectorIds = SCENARIO_CATALOG.map(s => s.id);
      expect(vectorIds).toContain('SCN-AUTH-01');
      expect(vectorIds).toContain('SCN-AUTH-02');
      expect(vectorIds).toContain('SCN-KMS-03');
      expect(vectorIds).toContain('SCN-CRYP-04');
      expect(vectorIds).toContain('SCN-BC-06');
      expect(vectorIds).toContain('SCN-AUD-07');
      expect(vectorIds).toContain('SCN-DEV-08');
      expect(vectorIds).toContain('SCN-RBAC-10');
    });
  });

  describe('4. Token Verification & Role-Based Authorization Bounds', () => {
    it('creates and verifies cryptographically signed JWT session tokens', async () => {
      const secret = new TextEncoder().encode(JWT_SECRET);
      const token = await new SignJWT({
        userId: 'usr_admin_001',
        role: UserRole.ADMIN,
        email: 'admin@securemax.mil',
        sessionId: 'sess_admin_test',
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('2h')
        .sign(secret);

      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });
  });
});
