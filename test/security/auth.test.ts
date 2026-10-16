import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
vi.mock('server-only', () => ({}));
import { POST as authLogin } from '../../src/app/api/auth/login/route';
import { POST as authChallenge } from '../../src/app/api/auth/challenge/route';
import { POST as demoLogin } from '../../src/app/api/auth/demo-login/route';
import { POST as registerUser } from '../../src/app/api/auth/register/route';
import { POST as logoutApi } from '../../src/app/api/auth/logout/route';
import { cookies } from 'next/headers';
import { deviceStore } from '../../src/lib/auth/deviceStore';
import { getVerifiedSession } from '../../src/lib/auth/session';
import { generateP256KeyPair, signWithPkcs8 } from '../../src/lib/crypto/p256';
import { UserRole, UserStatus } from '../../src/types';

// Mock Next.js next/headers cookies
vi.mock('next/headers', () => {
  const store = new Map();
  return {
    cookies: vi.fn(() => ({
      get: vi.fn((key) => store.get(key)),
      set: vi.fn((key, val, options) => store.set(key, { value: val, ...options })),
      delete: vi.fn((key) => store.delete(key)),
      _store: store
    }))
  };
});

describe('SecureMAX P-256 Zero-Trust Authentication Architecture Overhaul', () => {
  let adminKeyPair: { publicKeySpki: string; privateKeyPkcs8: string };
  let userKeyPair: { publicKeySpki: string; privateKeyPkcs8: string };

  beforeAll(async () => {
    adminKeyPair = await generateP256KeyPair();
    userKeyPair = await generateP256KeyPair();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    const cookieStore = cookies() as any;
    cookieStore._store.clear();
    deviceStore.seedTestDataForTesting(true);
  });

  // =========================================================================
  // 1. CRYPTOGRAPHIC CHALLENGE & REPLAY PROTECTION
  // =========================================================================
  describe('1. Cryptographic Challenge & Serverless Protection', () => {
    it('SHOULD ISSUE CHALLENGE: Generates high-entropy challenge and signed challengeToken', async () => {
      const req = new Request('http://localhost/api/auth/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: 'admin@securemax.mil' }),
      });

      const res = await authChallenge(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.message).toBeDefined();
      expect(body.challengeId).toBeDefined();
      expect(body.challengeToken).toBeDefined();

      // Verify challenge is stored in cache
      const stored = deviceStore.challengeCache.get(body.challengeId);
      expect(stored).toBeDefined();
      expect(stored?.identifier).toBe('admin@securemax.mil');
    });

    it('SHOULD PREVENT REPLAY: Challenge is deleted from cache after single consumption', async () => {
      const chalId = 'chal_single_use_' + Math.random().toString(36).substring(7);
      deviceStore.challengeCache.set(chalId, {
        challengeId: chalId,
        identifier: 'vasu@securemax.mil',
        nonce: 'nonce123',
        message: '=== SecureMAX Cryptographic Challenge ===\nTest',
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      });

      const req = new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'vasu@securemax.mil',
          challengeId: chalId,
          signature: 'fake-sig',
        }),
      });

      // First call consumes the challenge from cache
      await authLogin(req);
      expect(deviceStore.challengeCache.has(chalId)).toBe(false);

      // Replaying the exact same challengeId returns 400 Expired/Invalid
      const replayReq = new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'vasu@securemax.mil',
          challengeId: chalId,
          signature: 'fake-sig',
        }),
      });
      const replayRes = await authLogin(replayReq);
      expect(replayRes.status).toBe(400);
      const body = await replayRes.json();
      expect(body.error).toMatch(/already been consumed|expired or invalid/);
    });
  });

  // =========================================================================
  // 2. ZERO KEY REPLACEMENT & ENROLLMENT DECOUPLING
  // =========================================================================
  describe('2. Strict Key Verification & Enrollment Decoupling', () => {
    it('SHOULD REJECT LOGIN FOR UNENROLLED DEVICE: Login never auto-registers a device', async () => {
      const chalId = 'chal_unenrolled_' + Math.random().toString(36).substring(7);
      deviceStore.challengeCache.set(chalId, {
        challengeId: chalId,
        identifier: 'vasu@securemax.mil',
        nonce: 'nonce999',
        message: 'challenge_unenrolled',
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      });

      const req = new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'vasu@securemax.mil',
          deviceId: 'dev_unknown_rogue_laptop',
          publicKey: userKeyPair.publicKeySpki,
          challengeId: chalId,
          signature: 'fake-sig',
        }),
      });

      const res = await authLogin(req);
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toContain('Device not enrolled');
    });

    it('SHOULD NOT REPLACE STORED PUBLIC KEY: Supplying different publicKey does not overwrite stored credential', async () => {
      // Find admin device
      const adminUser = deviceStore.getUserByEmail('admin@securemax.mil')!;
      const adminDevices = deviceStore.getDevicesForUser(adminUser.id);
      const adminDev = adminDevices.find(d => d.is_admin_device)!;
      const originalAdminKey = adminDev.public_key;

      const chalId = 'chal_tamper_' + Math.random().toString(36).substring(7);
      deviceStore.challengeCache.set(chalId, {
        challengeId: chalId,
        identifier: 'admin@securemax.mil',
        nonce: 'nonce_tamper',
        message: 'challenge_tamper_msg',
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      });

      // Attacker sends their own publicKey during login
      const req = new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@securemax.mil',
          deviceId: adminDev.id,
          publicKey: userKeyPair.publicKeySpki, // Attacker's key
          challengeId: chalId,
          signature: 'fake-sig',
        }),
      });

      await authLogin(req);

      // Stored public key MUST remain intact and un-modified!
      const refreshedAdminDev = deviceStore.getDeviceById(adminDev.id)!;
      expect(refreshedAdminDev.public_key).toBe(originalAdminKey);
      expect(refreshedAdminDev.public_key).not.toBe(userKeyPair.publicKeySpki);
    });

    it('SHOULD ENFORCE ADMIN SINGLE-DEVICE POLICY: Non-primary device rejected for admin login', async () => {
      const chalId = 'chal_admin_sec_' + Math.random().toString(36).substring(7);
      deviceStore.challengeCache.set(chalId, {
        challengeId: chalId,
        identifier: 'admin@securemax.mil',
        nonce: 'nonce_sec',
        message: 'msg_sec',
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      });

      const req = new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@securemax.mil',
          deviceId: 'dev_admin_secondary_phone', // Unauthorized secondary device
          challengeId: chalId,
          signature: 'sig_irrelevant',
        }),
      });

      const res = await authLogin(req);
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toMatch(/Organization Administrator must authenticate using MetaMask|Non-primary device attempted administrative login/);
    });
  });

  // =========================================================================
  // 3. CRYPTOGRAPHIC AUTHENTICATION & STATEFUL SESSIONS
  // =========================================================================
  describe('3. Cryptographic P-256 Authentication & Zero-Trust Session Lifecycle', () => {
    it('SHOULD AUTHENTICATE WITH VALID P-256 SIGNATURE: Verifies against stored key and establishes stateful session', async () => {
      // 1. Enroll device with real generated key pair for user
      const user = deviceStore.getUserByEmail('vasu@securemax.mil')!;
      const device = deviceStore.registerDevice({
        userId: user.id,
        deviceName: 'Vasu Verified Workstation',
        publicKey: userKeyPair.publicKeySpki,
        isAdminDevice: false,
      });

      // 2. Request challenge
      const chalRes = await authChallenge(new Request('http://localhost/api/auth/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: user.email }),
      }));
      const chalData = await chalRes.json();

      // 3. Sign challenge with local private key
      const signature = await signWithPkcs8(userKeyPair.privateKeyPkcs8, chalData.message);

      // 4. Submit login
      const loginReq = new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          deviceId: device.id,
          challengeId: chalData.challengeId,
          signature,
        }),
      });

      const loginRes = await authLogin(loginReq);
      expect(loginRes.status).toBe(200);
      const loginData = await loginRes.json();
      expect(loginData.success).toBe(true);
      expect(loginData.user.email).toBe(user.email);

      // 5. Verify session is stateful and ACTIVE in deviceStore
      const activeSessions = deviceStore.getSessionsForUser(user.id);
      expect(activeSessions.length).toBeGreaterThanOrEqual(1);
      const activeSession = activeSessions.find(s => s.device_id === device.id && s.status === 'ACTIVE')!;
      expect(activeSession).toBeDefined();
      expect(activeSession.device_id).toBe(device.id);

      // 6. Verify getVerifiedSession succeeds
      const sessionPayload = await getVerifiedSession();
      expect(sessionPayload.userId).toBe(user.id);
      expect(sessionPayload.role).toBe(user.role);
    });

    it('SHOULD INSTANTLY INVALIDATE SESSION ON USER SUSPENSION: Zero-trust live revocation', async () => {
      const user = deviceStore.getUserByEmail('vasu@securemax.mil')!;
      const device = deviceStore.getDevicesForUser(user.id)[0];

      // Create session
      const session = deviceStore.createSession({
        userId: user.id,
        deviceId: device.id,
        durationHours: 8,
      });

      // Simulate logged in cookie
      const cookieStore = cookies() as any;
      const { SignJWT } = await import('jose');
      const { getJwtSecret } = await import('../../src/lib/auth/session');
      const token = await new SignJWT({
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        sessionId: session.session_id,
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('8h')
        .sign(getJwtSecret());

      cookieStore.set('securemesh_session', token);

      // Session verifies before suspension
      const preCheck = await getVerifiedSession();
      expect(preCheck.userId).toBe(user.id);

      // Suspend user via Admin action
      deviceStore.suspendUser(user.id);

      // Next request immediately rejects!
      await expect(getVerifiedSession()).rejects.toThrow(/Unauthorized/);
    });

    it('SHOULD INSTANTLY INVALIDATE SESSION ON LOGOUT', async () => {
      const user = deviceStore.getUserByEmail('vasu@securemax.mil')!;
      const device = deviceStore.getDevicesForUser(user.id)[0];

      const session = deviceStore.createSession({
        userId: user.id,
        deviceId: device.id,
        durationHours: 8,
      });

      const cookieStore = cookies() as any;
      const { SignJWT } = await import('jose');
      const { getJwtSecret } = await import('../../src/lib/auth/session');
      const token = await new SignJWT({
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        sessionId: session.session_id,
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('8h')
        .sign(getJwtSecret());

      cookieStore.set('securemesh_session', token);

      // Call logout API
      const logoutRes = await logoutApi();
      expect(logoutRes.status).toBe(200);

      // Stored session status is marked REVOKED
      const updatedSession = deviceStore.getSession(session.session_id);
      expect(updatedSession?.status).toBe('REVOKED');
    });
  });

  // =========================================================================
  // 4. REGISTRATION & DEMO GUARDS
  // =========================================================================
  describe('4. Registration Hardening & Production Demotion', () => {
    it('SHOULD DISALLOW ADMIN SELF-ASSIGNMENT: Registration forces role to USER and KYC to PENDING', async () => {
      const regReq = new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'newrecruit@securemax.mil',
          name: 'New Officer',
          role: 'ADMIN', // Rogue self-assignment attempt
          publicKey: userKeyPair.publicKeySpki,
        }),
      });

      const res = await registerUser(regReq);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      // Role must be downgraded to USER!
      expect(data.user.role).toBe(UserRole.USER);
      expect(data.user.role).not.toBe(UserRole.ADMIN);
      // KYC must be PENDING!
      expect(data.user.kycStatus).toBe('PENDING');

      // Verify in store
      const registeredUser = deviceStore.getUserByEmail('newrecruit@securemax.mil')!;
      expect(registeredUser.role).toBe(UserRole.USER);
      expect(registeredUser.kyc_status).toBe('PENDING');
    });

    it('SHOULD BLOCK DEMO LOGIN IN PRODUCTION', async () => {
      const originalEnv = process.env.NODE_ENV;
      try {
        (process.env as any).NODE_ENV = 'production';

        const demoReq = new Request('http://localhost/api/auth/demo-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: 'ADMIN' }),
        });

        const res = await demoLogin(demoReq);
        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.error).toContain('disabled in production');
      } finally {
        (process.env as any).NODE_ENV = originalEnv;
      }
    });

    it('SHOULD ALLOW DEMO LOGIN IN DEVELOPMENT / TEST', async () => {
      const adminReq = new Request('http://localhost/api/auth/demo-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'ADMIN' }),
      });
      const adminRes = await demoLogin(adminReq);
      expect(adminRes.status).toBe(200);
      const adminBody = await adminRes.json();
      expect(adminBody.success).toBe(true);
      expect(adminBody.user.role).toBe('ADMIN');
      expect(adminBody.user.email).toBe('admin@securemax.mil');
    });
  });
});
