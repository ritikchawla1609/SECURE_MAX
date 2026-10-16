import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
vi.mock('server-only', () => ({}));
import crypto from 'crypto';
import { deviceStore } from '../../src/lib/auth/deviceStore';
import { GET as getBootstrapApi, POST as postBootstrapApi } from '../../src/app/api/admin/bootstrap/route';
import { POST as panicApi } from '../../src/app/api/admin/panic/route';
import { POST as recoveryApi } from '../../src/app/api/admin/recovery/route';
import { GET as securityStatusApi } from '../../src/app/api/admin/security-status/route';
import { UserRole, UserStatus } from '../../src/types';

// Mock Next.js next/headers cookies
vi.mock('next/headers', () => {
  const store = new Map();
  return {
    cookies: vi.fn(() => ({
      get: vi.fn((key) => store.get(key)),
      set: vi.fn((key, val) => store.set(key, { value: val })),
      delete: vi.fn((key) => store.delete(key)),
      _store: store
    }))
  };
});

// Mock session helper for API route tests
vi.mock('@/lib/auth/session', () => ({
  getVerifiedSession: vi.fn(async () => ({
    userId: 'ADM-0001',
    email: 'admin@securemax.mil',
    name: 'Vasu (Root Admin)',
    role: UserRole.ADMIN,
    deviceId: 'DEV-ADMIN-001',
    deviceName: 'SecureMAX Root Admin Hardware Terminal',
    sessionId: 'SES-ADMIN-0001',
  })),
}));

describe('SecureMAX Admin Root Identity & One-Time Bootstrap Ceremony Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ADMIN_BOOTSTRAP_SECRET;
    // Reset device store to clean zero-state for bootstrap testing
    deviceStore.resetForTesting();
  });

  // =========================================================================
  // 1. UNINITIALIZED SYSTEM & ZERO-ADMIN DETECTION
  // =========================================================================
  describe('1. Uninitialized System State & Detection', () => {
    it('SHOULD DETECT UNINITIALIZED STATE: isSystemInitialized is false when zero admins exist', () => {
      expect(deviceStore.getAdminCount()).toBe(0);
      expect(deviceStore.isSystemInitialized()).toBe(false);
      const settings = deviceStore.getSystemSettings();
      expect(settings.admin_initialized).toBe(false);
      expect(settings.bootstrap_enabled).toBe(true);
      expect(settings.system_state).toBe('UNINITIALIZED');
    });

    it('SHOULD RETURN UNINITIALIZED FROM API: GET /api/admin/bootstrap informs client to show wizard', async () => {
      const response = await getBootstrapApi();
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.initialized).toBe(false);
      expect(body.adminCount).toBe(0);
      expect(body.bootstrapEnabled).toBe(true);
    });
  });

  // =========================================================================
  // 2. ONE-TIME ADMIN BOOTSTRAP CEREMONY
  // =========================================================================
  describe('2. One-Time Admin Bootstrap Ceremony', () => {
    it('SHOULD REJECT WRONG BOOTSTRAP SECRET: If deployment secret is configured, mismatch throws', () => {
      const oldSecret = process.env.ADMIN_BOOTSTRAP_SECRET;
      process.env.ADMIN_BOOTSTRAP_SECRET = 'DEPLOY-SUPER-SECRET-KEY-999';

      try {
        expect(() => {
          deviceStore.bootstrapRootAdmin({
            orgName: 'National Cyber Command',
            orgType: 'Military / Defense',
            country: 'India',
            timezone: 'Asia/Kolkata',
            adminName: 'Supreme Admin',
            email: 'admin@defense.gov.in',
            adminId: 'ADM-ROOT-001',
            deviceName: 'Hardware Vault Workstation',
            deviceType: 'laptop',
            os: 'macOS Sonoma',
            browser: 'Chrome 128',
            publicKey: 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEfake_p256_public_key',
            bootstrapSecret: 'WRONG_SECRET',
          });
        }).toThrow(/Invalid deployment bootstrap secret/i);
      } finally {
        process.env.ADMIN_BOOTSTRAP_SECRET = oldSecret;
      }
    });

    it('SHOULD EXECUTE BOOTSTRAP: Successfully creates Root Admin, singleton device, recovery package, and locks system', () => {
      const oldSecret = process.env.ADMIN_BOOTSTRAP_SECRET;
      process.env.ADMIN_BOOTSTRAP_SECRET = 'SECUREMAX_SIH_2026_ROOT_BOOTSTRAP_KEY';

      try {
        const result = deviceStore.bootstrapRootAdmin({
          orgName: 'SecureMAX Command',
          orgType: 'Enterprise Vault',
          country: 'India',
          timezone: 'Asia/Kolkata',
          adminName: 'Vasu Admin',
          email: 'vasu.admin@securemax.org',
          adminId: 'ADM-0001',
          deviceName: 'Vasu Secure Laptop',
          deviceType: 'laptop',
          os: 'macOS',
          browser: 'Chrome',
          publicKey: 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEadmin_p256_key',
          bootstrapSecret: 'SECUREMAX_SIH_2026_ROOT_BOOTSTRAP_KEY',
        });

        // 1. Root admin identity verified
        expect(result.rootAdmin).toBeDefined();
        expect(result.rootAdmin.id).toBe('ADM-0001');
        expect(result.rootAdmin.role).toBe(UserRole.ADMIN);
        expect(result.rootAdmin.position).toBe('Root Administrator');
        expect(result.rootAdmin.status).toBe(UserStatus.ACTIVE);

        // 2. Singleton device verified
        expect(result.adminDevice).toBeDefined();
        expect(result.adminDevice.is_admin_device).toBe(true);
        expect(result.adminDevice.status).toBe('ACTIVE');
        expect(result.adminDevice.risk_state).toBe('TRUSTED');
        expect(result.adminDevice.timeline.length).toBeGreaterThanOrEqual(6);

        // 3. One-time offline recovery package generated
        expect(result.recoveryPackage.recoveryId).toMatch(/^REC-[A-F0-9]{8}$/);
        expect(result.recoveryPackage.recoveryCode).toMatch(/^[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/);

        // 4. System state is permanently locked down
        expect(deviceStore.isSystemInitialized()).toBe(true);
        expect(deviceStore.getAdminCount()).toBe(1);
        const settings = deviceStore.getSystemSettings();
        expect(settings.admin_initialized).toBe(true);
        expect(settings.bootstrap_enabled).toBe(false);
        expect(settings.system_state).toBe('SYSTEM_LOCKED');

        // 5. Audit events logged
        const audits = deviceStore.getAuditEvents();
        const types = audits.map(a => a.event_type);
        expect(types).toContain('SYSTEM_INITIALIZATION_STARTED');
        expect(types).toContain('ROOT_ADMIN_CREATED');
        expect(types).toContain('ADMIN_DEVICE_REGISTERED');
        expect(types).toContain('ADMIN_CREDENTIAL_REGISTERED');
        expect(types).toContain('SYSTEM_INITIALIZATION_COMPLETED');
        expect(types).toContain('ADMIN_BOOTSTRAP_DISABLED');
      } finally {
        process.env.ADMIN_BOOTSTRAP_SECRET = oldSecret;
      }
    });

    it('SHOULD PERMANENTLY BLOCK SECOND BOOTSTRAP ATTEMPT: System raises error if bootstrap is invoked again', () => {
      // First bootstrap
      deviceStore.bootstrapRootAdmin({
        orgName: 'Org 1',
        adminName: 'Admin 1',
        email: 'admin1@org.com',
        publicKey: 'pub_key_1',
      });

      // Second bootstrap attempt MUST be rejected
      expect(() => {
        deviceStore.bootstrapRootAdmin({
          orgName: 'Org 2',
          adminName: 'Admin 2',
          email: 'admin2@org.com',
          publicKey: 'pub_key_2',
        });
      }).toThrow(/System already initialized/i);
    });

    it('SHOULD REJECT BOOTSTRAP VIA API ROUTE WHEN INITIALIZED: POST /api/admin/bootstrap returns 403', async () => {
      // First bootstrap
      deviceStore.bootstrapRootAdmin({
        orgName: 'Org 1',
        adminName: 'Admin 1',
        email: 'admin1@org.com',
        publicKey: 'pub_key_1',
      });

      const req = new Request('http://localhost:3000/api/admin/bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgName: 'Hacker Org',
          adminName: 'Attacker',
          email: 'attacker@bad.org',
          publicKey: 'pub_key_attacker',
        }),
      });

      const res = await postBootstrapApi(req);
      const data = await res.json();
      expect(res.status).toBe(403);
      expect(data.error).toMatch(/prohibited|already initialized/i);
    });
  });

  // =========================================================================
  // 3. SINGLETON ADMIN DEVICE POLICY
  // =========================================================================
  describe('3. Singleton Admin Device Policy', () => {
    it('SHOULD REJECT REGISTERING A SECOND ACTIVE DEVICE FOR ADMIN: Max 1 active device enforced', () => {
      const boot = deviceStore.bootstrapRootAdmin({
        orgName: 'SecureMAX HQ',
        adminName: 'Vasu Admin',
        email: 'vasu@hq.org',
        publicKey: 'key_1',
      });

      const adminUser = boot.rootAdmin;
      const existingDevices = deviceStore.getDevicesForUser(adminUser.id);
      expect(existingDevices.length).toBe(1);

      // Attempt to register a second device directly for admin
      expect(() => {
        deviceStore.registerDevice({
          userId: adminUser.id,
          deviceName: 'Second Laptop',
          publicKey: 'second_key',
        });
      }).toThrow(/restricted to one active trusted device/i);
    });
  });

  // =========================================================================
  // 4. EMERGENCY PANIC LOCKOUT
  // =========================================================================
  describe('4. Emergency Panic Lockout', () => {
    it('SHOULD LOCK ADMIN, SUSPEND DEVICE, AND REVOKE SESSIONS ON PANIC', async () => {
      const boot = deviceStore.bootstrapRootAdmin({
        orgName: 'Defense Ops',
        adminName: 'Commander Admin',
        email: 'commander@defense.gov',
        publicKey: 'cmd_key',
      });

      const adminId = boot.rootAdmin.id;
      const deviceId = boot.adminDevice.id;

      // Trigger panic lock
      deviceStore.lockAdministrator(adminId, 'PANIC_TRIGGER');

      // 1. Settings show admin_locked = true
      const settings = deviceStore.getSystemSettings();
      expect(settings.admin_locked).toBe(true);

      // 2. Admin device is suspended
      const device = deviceStore.getDevicePassport(deviceId);
      expect(device?.status).toBe('SUSPENDED');
      expect(device?.risk_state).toBe('RESTRICTED');

      // 3. Timeline records panic event
      const panicEvent = device?.timeline.find(t => t.event === 'DEVICE_LOCKED_PANIC');
      expect(panicEvent).toBeDefined();

      // 4. API endpoint verification
      const req = new Request('http://localhost:3000/api/admin/panic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminId,
          reason: 'Physical breach detected at terminal',
        }),
      });
      const res = await panicApi(req);
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  // =========================================================================
  // 5. EMERGENCY RECOVERY CEREMONY (2-FACTOR OFFLINE RECOVERY)
  // =========================================================================
  describe('5. Emergency Recovery Ceremony', () => {
    it('SHOULD REJECT RECOVERY WITH INVALID CODE', () => {
      const boot = deviceStore.bootstrapRootAdmin({
        orgName: 'SecureMAX HQ',
        adminName: 'Root Chief',
        email: 'chief@securemax.org',
        publicKey: 'chief_key',
      });

      expect(() => {
        deviceStore.emergencyRecovery({
          adminId: boot.rootAdmin.id,
          recoveryCode: 'INVALID-CODE-0000',
          newDeviceName: 'Replacement Laptop',
          newPublicKey: 'new_chief_key',
        });
      }).toThrow(/Invalid emergency recovery code/i);
    });

    it('SHOULD RECOVER ACCESS, REVOKE COMPROMISED DEVICE, BIND REPLACEMENT DEVICE, AND ISSUE NEW RECOVERY PACKAGE', () => {
      const oldSecret = process.env.ADMIN_BOOTSTRAP_SECRET;
      process.env.ADMIN_BOOTSTRAP_SECRET = 'DEPLOY-SECRET-ALPHA';

      try {
        const boot = deviceStore.bootstrapRootAdmin({
          orgName: 'SecureMAX HQ',
          adminName: 'Root Chief',
          email: 'chief@securemax.org',
          publicKey: 'chief_key',
          bootstrapSecret: 'DEPLOY-SECRET-ALPHA',
        });

        const initialRecoveryCode = boot.recoveryPackage.recoveryCode;
        const oldDeviceId = boot.adminDevice.id;

        // Execute recovery ceremony
        const recoveryResult = deviceStore.emergencyRecovery({
          adminId: boot.rootAdmin.id,
          recoveryCode: initialRecoveryCode,
          bootstrapSecret: 'DEPLOY-SECRET-ALPHA',
          newDeviceName: 'New Secure Air-Gapped Laptop',
          newPublicKey: 'new_vault_key_p256',
          newDeviceType: 'laptop',
          os: 'macOS Sequoia',
          browser: 'Safari',
        });

        expect(recoveryResult.success).toBe(true);

        // 1. Old device is REVOKED
        const oldDevice = deviceStore.getDevicePassport(oldDeviceId);
        expect(oldDevice?.status).toBe('REVOKED');
        expect(oldDevice?.risk_state).toBe('REVOKED');

        // 2. New device is bound and ACTIVE
        expect(recoveryResult.newDevice).toBeDefined();
        expect(recoveryResult.newDevice.status).toBe('ACTIVE');
        expect(recoveryResult.newDevice.device_name).toBe('New Secure Air-Gapped Laptop');
        expect(recoveryResult.newDevice.is_admin_device).toBe(true);

        // 3. Admin is unlocked
        const settings = deviceStore.getSystemSettings();
        expect(settings.admin_locked).toBe(false);

        // 4. Fresh recovery package issued (one-time replacement)
        expect(recoveryResult.newRecoveryPackage.recoveryCode).not.toBe(initialRecoveryCode);

        // 5. Old recovery code is no longer usable
        expect(() => {
          deviceStore.emergencyRecovery({
            adminId: boot.rootAdmin.id,
            recoveryCode: initialRecoveryCode,
            bootstrapSecret: 'DEPLOY-SECRET-ALPHA',
            newDeviceName: 'Another Laptop',
            newPublicKey: 'another_key',
          });
        }).toThrow(/Invalid emergency recovery code/i);

        // 6. New recovery code works
        const secondRecovery = deviceStore.emergencyRecovery({
          adminId: boot.rootAdmin.id,
          recoveryCode: recoveryResult.newRecoveryPackage.recoveryCode,
          bootstrapSecret: 'DEPLOY-SECRET-ALPHA',
          newDeviceName: 'Final Replacement Device',
          newPublicKey: 'final_key',
        });
        expect(secondRecovery.success).toBe(true);
      } finally {
        process.env.ADMIN_BOOTSTRAP_SECRET = oldSecret;
      }
    });

    it('SHOULD EXECUTE RECOVERY VIA API ROUTE: POST /api/admin/recovery restores admin', async () => {
      const boot = deviceStore.bootstrapRootAdmin({
        orgName: 'SecOps',
        adminName: 'SecOps Admin',
        email: 'secops@org.com',
        publicKey: 'pub_sec',
      });

      const req = new Request('http://localhost:3000/api/admin/recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminId: boot.rootAdmin.id,
          recoveryCode: boot.recoveryPackage.recoveryCode,
          newDeviceName: 'Disaster Recovery Station',
          newPublicKey: 'disaster_key_p256',
        }),
      });

      const res = await recoveryApi(req);
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.newDevice).toBeDefined();
      expect(data.newRecoveryPackage).toBeDefined();
    });
  });

  // =========================================================================
  // 6. ADMIN SECURITY STATUS & METRICS API
  // =========================================================================
  describe('6. Admin Security Status & Metrics', () => {
    it('SHOULD RETURN SYSTEM SECURITY STATUS: GET /api/admin/security-status delivers real-time metrics', async () => {
      deviceStore.bootstrapRootAdmin({
        orgName: 'Alpha Defense',
        adminName: 'Alpha Admin',
        email: 'alpha@defense.org',
        publicKey: 'alpha_key',
      });

      const res = await securityStatusApi();
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.initialized).toBe(true);
      expect(body.rootAdmin).toBeDefined();
      expect(body.rootAdmin.name).toBe('Alpha Admin');
      expect(body.trustedDevices).toBeDefined();
      expect(body.trustedDevices.active).toBe(1);
      expect(body.trustedDevices.maxAllowed).toBe(1);
      expect(body.trustedDevices.isSingletonEnforced).toBe(true);
      expect(body.activeSessionsCount).toBeGreaterThanOrEqual(1);
    });
  });
});
