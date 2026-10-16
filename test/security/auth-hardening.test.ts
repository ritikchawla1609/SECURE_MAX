import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
vi.mock('server-only', () => ({}));
import { POST as registerApi } from '../../src/app/api/auth/register/route';
import { POST as demoLoginApi } from '../../src/app/api/auth/demo-login/route';
import { cookies } from 'next/headers';
import { deviceStore } from '../../src/lib/auth/deviceStore';
import { getVerifiedSession } from '../../src/lib/auth/session';
import { UserRole, UserStatus } from '../../src/types';
import { SignJWT } from 'jose';
import { getJwtSecret } from '../../src/lib/auth/session';

// Mock Next.js next/headers cookies
vi.mock('next/headers', () => {
  const store = new Map();
  return {
    cookies: vi.fn(() => ({
      get: vi.fn((key) => store.get(key)),
      set: vi.fn((key, val, options) => store.set(key, { value: val, ...options })),
      delete: vi.fn((key) => store.delete(key)),
      _store: store,
    })),
  };
});

describe('Authentication Hardening Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const cookieStore = cookies() as any;
    cookieStore._store.clear();
    deviceStore.seedTestDataForTesting(true);
  });

  describe('1. Self-Assignment of Privileged Roles Disallowed', () => {
    it('SHOULD REJECT/IGNORE PRIVILEGED ROLE: Public registration with requestedRole=MANAGER defaults strictly to USER', async () => {
      const regReq = new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'attacker-manager@securemax.mil',
          name: 'Attacker Attempting Manager Role',
          role: 'MANAGER',
          publicKey: 'mock-p256-public-key-string-1234567890',
        }),
      });

      const res = await registerApi(regReq);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      // User must be assigned USER role, NOT MANAGER
      expect(data.user.role).toBe(UserRole.USER);

      const dbUser = deviceStore.getUserByEmail('attacker-manager@securemax.mil');
      expect(dbUser).toBeDefined();
      expect(dbUser?.role).toBe(UserRole.USER);
      expect(dbUser?.kyc_status).toBe('PENDING');
    });

    it('SHOULD REJECT/IGNORE PRIVILEGED ROLE: Public registration with requestedRole=AUDITOR defaults strictly to USER', async () => {
      const regReq = new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'attacker-auditor@securemax.mil',
          name: 'Attacker Attempting Auditor Role',
          role: 'AUDITOR',
          publicKey: 'mock-p256-public-key-string-0987654321',
        }),
      });

      const res = await registerApi(regReq);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      // User must be assigned USER role, NOT AUDITOR
      expect(data.user.role).toBe(UserRole.USER);

      const dbUser = deviceStore.getUserByEmail('attacker-auditor@securemax.mil');
      expect(dbUser).toBeDefined();
      expect(dbUser?.role).toBe(UserRole.USER);
    });
  });

  describe('2. Demo Login Hardening', () => {
    it('SHOULD REJECT: Demo login is strictly blocked in production environment', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        const demoReq = new Request('http://localhost/api/auth/demo-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: UserRole.ADMIN }),
        });

        const res = await demoLoginApi(demoReq);
        const data = await res.json();

        expect(res.status).toBe(403);
        expect(data.error).toContain('disabled in production');
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
      }
    });
  });

  describe('3. Zero-Trust Non-Existent User Rejection in getVerifiedSession', () => {
    it('SHOULD REJECT: Session with non-existent userId in database throws Unauthorized error', async () => {
      // Craft a validly signed JWT with a non-existent userId
      const jwtSecret = getJwtSecret();
      const nonExistentUserId = 'usr_ghost_999999';

      const fakeSessionToken = await new SignJWT({
        userId: nonExistentUserId,
        email: 'ghost@securemax.mil',
        name: 'Ghost User',
        role: UserRole.ADMIN,
        sessionId: 'sess_fake_123',
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(jwtSecret);

      const cookieStore = cookies() as any;
      cookieStore._store.set('securemesh_session', { value: fakeSessionToken });

      await expect(getVerifiedSession()).rejects.toThrow(
        'Unauthorized: User identity record not found in system database'
      );
    });
  });
});
