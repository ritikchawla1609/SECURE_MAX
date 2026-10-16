import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
vi.mock('server-only', () => ({}));
import { ethers } from 'ethers';
import { POST as authLogin } from '../../src/app/api/auth/login/route';
import { POST as authChallenge } from '../../src/app/api/auth/challenge/route';
import { POST as enrollmentStartApi } from '../../src/app/api/devices/enrollment/start/route';
import { POST as enrollmentCompleteApi } from '../../src/app/api/devices/enrollment/complete/route';
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

describe('SecureMAX Dual-Authentication & Zero-Trust Architecture Suite', () => {
  let adminEthWallet: ethers.HDNodeWallet;
  let unauthorizedEthWallet: ethers.HDNodeWallet;
  let userP256KeyPair: { publicKeySpki: string; privateKeyPkcs8: string };

  beforeAll(async () => {
    adminEthWallet = ethers.Wallet.createRandom();
    unauthorizedEthWallet = ethers.Wallet.createRandom();
    userP256KeyPair = await generateP256KeyPair();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    const cookieStore = cookies() as any;
    cookieStore._store.clear();

    deviceStore.seedTestDataForTesting(true);
    // Set registered admin wallet to our test wallet
    deviceStore.systemSettings.admin_wallet = adminEthWallet.address.toLowerCase();
  });

  // =========================================================================
  // MODEL A: ORGANIZATION ADMINISTRATOR (METAMASK EIP-191)
  // =========================================================================
  describe('Model A: Organization Administrator MetaMask Authentication', () => {
    it('SHOULD SUCCEED: Valid EIP-191 personal_sign from registered admin wallet', async () => {
      // 1. Request Ethereum challenge for admin
      const chalReq = new Request('http://localhost/api/auth/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'ETHEREUM',
          walletAddress: adminEthWallet.address,
        }),
      });

      const chalRes = await authChallenge(chalReq);
      expect(chalRes.status).toBe(200);
      const chalData = await chalRes.json();
      expect(chalData.challengeId).toBeDefined();
      expect(chalData.message).toContain('SecureMAX Administrator Authentication');

      // 2. Sign challenge message using admin wallet (EIP-191 personal_sign)
      const signature = await adminEthWallet.signMessage(chalData.message);

      // 3. Submit login request
      const loginReq = new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: adminEthWallet.address,
          challengeId: chalData.challengeId,
          signature,
          authType: 'METAMASK',
        }),
      });

      const loginRes = await authLogin(loginReq);
      expect(loginRes.status).toBe(200);
      const loginData = await loginRes.json();
      expect(loginData.success).toBe(true);
      expect(loginData.user.role).toBe(UserRole.ADMIN);

      // Session cookie is set
      const cookieStore = cookies() as any;
      expect(cookieStore._store.has('securemesh_session')).toBe(true);

      // Audit event recorded
      const audits = deviceStore.getAuditEvents();
      const loginAudit = audits.find(a => a.event_type === 'ADMIN_LOGIN_SUCCESS');
      expect(loginAudit).toBeDefined();
    });

    it('SHOULD REJECT REPLAY: Admin challenge cannot be reused once consumed', async () => {
      // 1. Issue challenge and sign
      const chalReq = new Request('http://localhost/api/auth/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'ETHEREUM',
          walletAddress: adminEthWallet.address,
        }),
      });
      const chalRes = await authChallenge(chalReq);
      const chalData = await chalRes.json();
      const signature = await adminEthWallet.signMessage(chalData.message);

      // 2. First consumption: succeeds
      const loginReq1 = new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: adminEthWallet.address,
          challengeId: chalData.challengeId,
          signature,
          authType: 'METAMASK',
        }),
      });
      const loginRes1 = await authLogin(loginReq1);
      expect(loginRes1.status).toBe(200);

      // 3. Second consumption (Replay Attack): MUST fail with 400
      const loginReq2 = new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: adminEthWallet.address,
          challengeId: chalData.challengeId,
          signature,
          authType: 'METAMASK',
        }),
      });
      const loginRes2 = await authLogin(loginReq2);
      expect(loginRes2.status).toBe(400);
      const errBody = await loginRes2.json();
      expect(errBody.error).toContain('already been consumed');

      // Replay audit event recorded
      const audits = deviceStore.getAuditEvents();
      const replayAudit = audits.find(a => a.event_type === 'TOKEN_REPLAY_ATTEMPT');
      expect(replayAudit).toBeDefined();
    });

    it('SHOULD REJECT UNAUTHORIZED WALLET: Valid signature but wrong wallet address returns 403', async () => {
      // Unauthorized wallet requests challenge and signs
      const chalReq = new Request('http://localhost/api/auth/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'ETHEREUM',
          walletAddress: unauthorizedEthWallet.address,
        }),
      });
      const chalRes = await authChallenge(chalReq);
      const chalData = await chalRes.json();
      const signature = await unauthorizedEthWallet.signMessage(chalData.message);

      const loginReq = new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: unauthorizedEthWallet.address,
          challengeId: chalData.challengeId,
          signature,
          authType: 'METAMASK',
        }),
      });

      const loginRes = await authLogin(loginReq);
      expect(loginRes.status).toBe(403);
      const errBody = await loginRes.json();
      expect(errBody.error).toContain('not authorized as the Organization Administrator');
    });

    it('SHOULD REJECT IMPERSONATION: Claimed wallet does not match signature signer returns 401', async () => {
      const chalReq = new Request('http://localhost/api/auth/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'ETHEREUM',
          walletAddress: adminEthWallet.address,
        }),
      });
      const chalRes = await authChallenge(chalReq);
      const chalData = await chalRes.json();

      // Attacker signs message using unauthorized wallet, but claims to be admin
      const signature = await unauthorizedEthWallet.signMessage(chalData.message);

      const loginReq = new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: adminEthWallet.address, // Claims admin wallet
          challengeId: chalData.challengeId,
          signature, // But signed by unauthorized wallet
          authType: 'METAMASK',
        }),
      });

      const loginRes = await authLogin(loginReq);
      expect(loginRes.status).toBe(401);
      const errBody = await loginRes.json();
      expect(errBody.error).toContain('Wallet signature mismatch');
    });

    it('SHOULD REJECT MALFORMED SIGNATURE: Corrupted signature returns 401', async () => {
      const chalReq = new Request('http://localhost/api/auth/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'ETHEREUM',
          walletAddress: adminEthWallet.address,
        }),
      });
      const chalRes = await authChallenge(chalReq);
      const chalData = await chalRes.json();

      const loginReq = new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: adminEthWallet.address,
          challengeId: chalData.challengeId,
          signature: '0xinvalidcorruptedsignaturedeadbeef',
          authType: 'METAMASK',
        }),
      });

      const loginRes = await authLogin(loginReq);
      expect(loginRes.status).toBe(401);
      const errBody = await loginRes.json();
      expect(errBody.error).toContain('Malformed or invalid cryptographic wallet signature');
    });

    it('SHOULD REJECT IF ADMIN ACCOUNT IS LOCKED: Locked admin account returns 403', async () => {
      deviceStore.systemSettings.admin_locked = true;

      const chalReq = new Request('http://localhost/api/auth/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'ETHEREUM',
          walletAddress: adminEthWallet.address,
        }),
      });
      const chalRes = await authChallenge(chalReq);
      const chalData = await chalRes.json();
      const signature = await adminEthWallet.signMessage(chalData.message);

      const loginReq = new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: adminEthWallet.address,
          challengeId: chalData.challengeId,
          signature,
          authType: 'METAMASK',
        }),
      });

      const loginRes = await authLogin(loginReq);
      expect(loginRes.status).toBe(403);
      const errBody = await loginRes.json();
      expect(errBody.error).toContain('Administrator account is locked');
    });
  });

  // =========================================================================
  // MODEL B: NORMAL USERS (ENROLLED P-256 DEVICE KEY)
  // =========================================================================
  describe('Model B: Normal User P-256 Authentication', () => {
    it('SHOULD AUTHENTICATE VIA ENROLLED P-256 KEY: Verifies against stored key and establishes session', async () => {
      const user = deviceStore.getUserByEmail('vasu@securemax.mil')!;
      const device = deviceStore.registerDevice({
        userId: user.id,
        deviceName: 'Workstation 1',
        publicKey: userP256KeyPair.publicKeySpki,
        isAdminDevice: false,
      });

      // 1. Request challenge
      const chalRes = await authChallenge(new Request('http://localhost/api/auth/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: user.email,
          type: 'P256',
          deviceId: device.id,
        }),
      }));
      const chalData = await chalRes.json();

      // 2. Sign with P-256 private key
      const signature = await signWithPkcs8(userP256KeyPair.privateKeyPkcs8, chalData.message);

      // 3. Login (No publicKey sent — server validates against registered DB record)
      const loginRes = await authLogin(new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          deviceId: device.id,
          challengeId: chalData.challengeId,
          signature,
        }),
      }));

      expect(loginRes.status).toBe(200);
      const loginData = await loginRes.json();
      expect(loginData.success).toBe(true);
      expect(loginData.user.email).toBe(user.email);
    });

    it('SHOULD NEVER REPLACE STORED KEY: Submitting client public key during login does not alter DB', async () => {
      const user = deviceStore.getUserByEmail('vasu@securemax.mil')!;
      const device = deviceStore.registerDevice({
        userId: user.id,
        deviceName: 'Workstation 1',
        publicKey: userP256KeyPair.publicKeySpki,
        isAdminDevice: false,
      });

      const originalKey = device.public_key;
      const attackerKey = (await generateP256KeyPair()).publicKeySpki;

      const chalRes = await authChallenge(new Request('http://localhost/api/auth/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: user.email,
          type: 'P256',
          deviceId: device.id,
        }),
      }));
      const chalData = await chalRes.json();

      // Attacker attempts to replace key by sending publicKey in login payload
      await authLogin(new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          deviceId: device.id,
          publicKey: attackerKey, // Must be ignored
          challengeId: chalData.challengeId,
          signature: 'fake-sig',
        }),
      }));

      const refreshedDev = deviceStore.getDeviceById(device.id)!;
      expect(refreshedDev.public_key).toBe(originalKey);
      expect(refreshedDev.public_key).not.toBe(attackerKey);
    });

    it('SHOULD REJECT SUSPENDED USER: Suspended identity cannot log in', async () => {
      const user = deviceStore.getUserByEmail('vasu@securemax.mil')!;
      user.status = UserStatus.SUSPENDED;

      const device = deviceStore.registerDevice({
        userId: user.id,
        deviceName: 'Workstation 1',
        publicKey: userP256KeyPair.publicKeySpki,
        isAdminDevice: false,
      });

      const chalRes = await authChallenge(new Request('http://localhost/api/auth/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: user.email,
          type: 'P256',
          deviceId: device.id,
        }),
      }));
      const chalData = await chalRes.json();
      const signature = await signWithPkcs8(userP256KeyPair.privateKeyPkcs8, chalData.message);

      const loginRes = await authLogin(new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          deviceId: device.id,
          challengeId: chalData.challengeId,
          signature,
        }),
      }));

      expect(loginRes.status).toBe(403);
      const errBody = await loginRes.json();
      expect(errBody.error).toContain('SUSPENDED');
    });
  });

  // =========================================================================
  // MODEL C: USER ENROLLMENT (15-MINUTE SINGLE-USE SECURITY CODE)
  // =========================================================================
  describe('Model C: User Enrollment & Single-Use Security Code Validation', () => {
    it('SHOULD COMPLETE ENROLLMENT: Single-use code registers device and is permanently invalidated', async () => {
      // 1. Authenticate admin first so enrollmentStartApi has authorized session
      const chalRes = await authChallenge(new Request('http://localhost/api/auth/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'ETHEREUM',
          walletAddress: adminEthWallet.address,
        }),
      }));
      const chalData = await chalRes.json();
      const adminSig = await adminEthWallet.signMessage(chalData.message);

      await authLogin(new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: adminEthWallet.address,
          challengeId: chalData.challengeId,
          signature: adminSig,
          authType: 'METAMASK',
        }),
      }));

      // 2. Admin generates enrollment code
      const startRes = await enrollmentStartApi(new Request('http://localhost/api/devices/enrollment/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isNewUser: true,
          positionId: 'pos_user',
          newUserName: 'Rohan Sharma',
          newUserEmail: 'rohan@securemax.mil',
        }),
      }));

      expect(startRes.status).toBe(200);
      const startData = await startRes.json();
      const enrollmentCode = startData.enrollment.code;
      expect(enrollmentCode).toBeDefined();

      // 3. User completes enrollment with P-256 key
      const completeRes = await enrollmentCompleteApi(new Request('http://localhost/api/devices/enrollment/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enrollmentCode,
          deviceName: 'Rohan MacBook Pro',
          publicKey: userP256KeyPair.publicKeySpki,
          name: 'Rohan Sharma',
          email: 'rohan@securemax.mil',
        }),
      }));

      expect(completeRes.status).toBe(200);
      const completeData = await completeRes.json();
      expect(completeData.success).toBe(true);

      // Verify device was registered
      const rohanUser = deviceStore.getUserByEmail('rohan@securemax.mil')!;
      expect(rohanUser).toBeDefined();
      const devices = deviceStore.getDevicesForUser(rohanUser.id);
      expect(devices.length).toBe(1);
      expect(devices[0].public_key).toBe(userP256KeyPair.publicKeySpki);

      // 4. Re-using the same enrollment code MUST be rejected (Code is single-use, NOT a password)
      const reuseRes = await enrollmentCompleteApi(new Request('http://localhost/api/devices/enrollment/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enrollmentCode,
          deviceName: 'Rohan Rogue Laptop',
          publicKey: userP256KeyPair.publicKeySpki,
          name: 'Rohan Sharma',
          email: 'rohan@securemax.mil',
        }),
      }));

      expect(reuseRes.status).toBe(400);
      const reuseData = await reuseRes.json();
      expect(reuseData.error).toContain('already been consumed');
    });
  });

  // =========================================================================
  // ZERO-TRUST SESSION INVARIANTS: Live Database Role Reflection
  // =========================================================================
  describe('Zero-Trust Session Invariants: Live Database Role Reflection', () => {
    it('SHOULD REFLECT LIVE ROLE: Changing role in database immediately updates session role', async () => {
      // 1. Authenticate user
      const user = deviceStore.getUserByEmail('vasu@securemax.mil')!;
      user.role = UserRole.USER;
      user.status = UserStatus.ACTIVE;

      const device = deviceStore.registerDevice({
        userId: user.id,
        deviceName: 'Workstation 1',
        publicKey: userP256KeyPair.publicKeySpki,
        isAdminDevice: false,
      });

      const chalRes = await authChallenge(new Request('http://localhost/api/auth/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: user.email,
          type: 'P256',
          deviceId: device.id,
        }),
      }));
      const chalData = await chalRes.json();
      const signature = await signWithPkcs8(userP256KeyPair.privateKeyPkcs8, chalData.message);

      await authLogin(new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          deviceId: device.id,
          challengeId: chalData.challengeId,
          signature,
        }),
      }));

      // Initial verified session has role USER
      let session = await getVerifiedSession();
      expect(session).not.toBeNull();
      expect(session?.role).toBe(UserRole.USER);

      // 2. Administrator promotes user to MANAGER in live database
      user.role = UserRole.MANAGER;

      // 3. Next session verification MUST immediately reflect MANAGER without re-login!
      session = await getVerifiedSession();
      expect(session?.role).toBe(UserRole.MANAGER);

      // 4. Administrator revokes user (suspends)
      user.status = UserStatus.SUSPENDED;

      // 5. Next session verification MUST immediately reject with SUSPENDED!
      await expect(getVerifiedSession()).rejects.toThrow('SUSPENDED');
    });
  });
});
