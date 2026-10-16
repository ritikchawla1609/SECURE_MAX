import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
vi.mock('server-only', () => ({}));
import crypto from 'crypto';
import { deviceStore } from '../../src/lib/auth/deviceStore';
import { POST as positionsApi, GET as getPositionsApi } from '../../src/app/api/positions/route';
import { POST as enrollmentStartApi } from '../../src/app/api/devices/enrollment/start/route';
import { POST as enrollmentVerifyApi } from '../../src/app/api/devices/enrollment/verify/route';
import { POST as enrollmentCompleteApi } from '../../src/app/api/devices/enrollment/complete/route';
import { POST as devicesActionApi, GET as getDevicesApi } from '../../src/app/api/devices/route';
import { POST as stepUpApi } from '../../src/app/api/devices/step-up/route';
import { cookies } from 'next/headers';
import { UserRole } from '../../src/types';

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
    userId: 'usr_admin_001',
    email: 'admin@securemax.mil',
    name: 'Vasu (Administrator)',
    role: UserRole.ADMIN,
    deviceId: 'dev_admin_primary',
    deviceName: 'Admin Laptop (Hardware-Bound)',
    sessionId: 'SES-0001',
  })),
}));

describe('SecureMAX Device Trust System & Device Passport Suite', () => {
  beforeAll(() => {
    deviceStore.seedTestDataForTesting();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    const cookieStore = cookies() as any;
    cookieStore._store.clear();
  });

  // =========================================================================
  // 1. POSITION MANAGEMENT TESTS
  // =========================================================================
  describe('1. Position Management & Role Matrix', () => {
    it('SHOULD PROVIDE PREDEFINED POSITIONS: Admin, Manager, Auditor, and User available', () => {
      const positions = deviceStore.getPositions();
      expect(positions.length).toBeGreaterThanOrEqual(4);

      const names = positions.map(p => p.name);
      expect(names).toContain('Administrator');
      expect(names).toContain('Manager');
      expect(names).toContain('Auditor');
      expect(names).toContain('User');

      const adminPos = positions.find(p => p.name === 'Administrator');
      expect(adminPos?.privilege_level).toBe('ADMINISTRATIVE');
      expect(adminPos?.permissions.identity.register).toBe(true);
      expect(adminPos?.permissions.security.manage_devices).toBe(true);

      const userPos = positions.find(p => p.name === 'User');
      expect(userPos?.privilege_level).toBe('STANDARD');
      expect(userPos?.permissions.security.manage_devices).toBe(false);
    });

    it('SHOULD CREATE CUSTOM POSITION: Admin can create custom positions with granular permissions', async () => {
      const customPos = deviceStore.createPosition({
        name: 'Compliance Officer',
        description: 'Oversees regulatory compliance and statutory audits',
        privilege_level: 'STANDARD',
        permissions: {
          identity: { register: false, suspend: false, revoke: false },
          users: { create: false, suspend: false },
          assets: { view: true, allocate: false, transfer: false, delete: false },
          access: { approve: false, revoke: false },
          audit: { view: true, export: true },
          security: { view_alerts: true, manage_devices: false },
        },
        callerUserId: 'usr_admin_001',
      });

      expect(customPos.id).toBeDefined();
      expect(customPos.name).toBe('Compliance Officer');
      expect(customPos.permissions.audit.export).toBe(true);

      // Verify audit event recorded
      const audits = deviceStore.getAuditEvents();
      const posAudit = audits.find(a => a.event_type === 'POSITION_CREATED' && a.target_id === customPos.id);
      expect(posAudit).toBeDefined();
    });

    it('SHOULD ENFORCE HIGH PRIVILEGE CONFIRMATION: Elevated positions require admin confirmation in API', async () => {
      // Attempt to create Administrative position without admin confirmation
      const req = new Request('http://localhost/api/positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Shadow Super Admin',
          description: 'High privilege administrative role',
          privilege_level: 'ADMINISTRATIVE',
          permissions: {
            identity: { register: true, suspend: true, revoke: true },
            users: { create: true, suspend: true },
            assets: { view: true, allocate: true, transfer: true, delete: true },
            access: { approve: true, revoke: true },
            audit: { view: true, export: true },
            security: { view_alerts: true, manage_devices: true },
          },
          adminConfirmed: false,
        }),
      });

      const res = await positionsApi(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.requiresConfirmation).toBe(true);
      expect(data.error).toContain('requires explicit administrative confirmation');

      // Now create with admin confirmation
      const confirmedReq = new Request('http://localhost/api/positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Authorized Elevated Officer',
          description: 'Authorized operational manager',
          privilege_level: 'ELEVATED',
          permissions: {
            identity: { register: false, suspend: false, revoke: false },
            users: { create: false, suspend: false },
            assets: { view: true, allocate: true, transfer: true, delete: false },
            access: { approve: true, revoke: true },
            audit: { view: true, export: false },
            security: { view_alerts: true, manage_devices: false },
          },
          adminConfirmed: true,
        }),
      });

      const confirmedRes = await positionsApi(confirmedReq);
      expect(confirmedRes.status).toBe(200);
      const confirmedData = await confirmedRes.json();
      expect(confirmedData.success).toBe(true);
      expect(confirmedData.position.name).toBe('Authorized Elevated Officer');
    });

    it('SHOULD REJECT DUPLICATE POSITION: Cannot create duplicate position names', () => {
      expect(() => {
        deviceStore.createPosition({
          name: 'Manager',
          description: 'Duplicate position',
          privilege_level: 'ELEVATED',
          permissions: deviceStore.getPositionById('pos_manager')!.permissions,
        });
      }).toThrow('already exists');
    });
  });

  // =========================================================================
  // 2. DEVICE ENROLLMENT & 15-MINUTE SECURITY CODES
  // =========================================================================
  describe('2. Device Enrollment & 15-Minute Security Codes', () => {
    it('SHOULD GENERATE 15-MINUTE CAPABILITY: Cryptographic code with SHA-256 hash storage', () => {
      const targetUser = deviceStore.getUserById('usr_vasu_002')!;
      const { enrollment, plaintextCode } = deviceStore.createEnrollmentCapability({
        userId: targetUser.id,
        durationMinutes: 15,
        maxDevices: 1,
        callerUserId: 'usr_admin_001',
      });

      expect(plaintextCode).toMatch(/^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
      expect(enrollment.id).toBeDefined();
      expect(enrollment.status).toBe('ACTIVE');

      // Verify SHA-256 hash storage (database stores hash, not plaintext code)
      const cleanRaw = plaintextCode.replace(/-/g, '');
      const expectedHash = crypto.createHash('sha256').update(cleanRaw).digest('hex');
      expect(enrollment.code_hash).toBe(expectedHash);

      // Verify expiration is 15 minutes in future
      const expires = new Date(enrollment.expires_at).getTime();
      const created = new Date(enrollment.created_at).getTime();
      expect(expires - created).toBe(15 * 60 * 1000);

      // Verify plaintext code is NOT in audit log
      const audit = deviceStore.getAuditEvents().find(a => a.target_id === enrollment.id);
      expect(audit).toBeDefined();
      expect(audit?.description).not.toContain(plaintextCode);
    });

    it('SHOULD VERIFY VALID CODE: Normalizes input and returns user and position info', () => {
      const targetUser = deviceStore.getUserById('usr_vasu_002')!;
      const { plaintextCode } = deviceStore.createEnrollmentCapability({
        userId: targetUser.id,
        durationMinutes: 15,
      });

      // Verify with lowercase or mixed case
      const verification = deviceStore.verifyEnrollmentCapability(plaintextCode.toLowerCase());
      expect(verification.valid).toBe(true);
      expect(verification.user?.id).toBe(targetUser.id);
      expect(verification.position).toBeDefined();
    });

    it('SHOULD REJECT EXPIRED CODE: 15-minute expiration strictly enforced', () => {
      const targetUser = deviceStore.getUserById('usr_vasu_002')!;
      const { enrollment, plaintextCode } = deviceStore.createEnrollmentCapability({
        userId: targetUser.id,
        durationMinutes: 15,
      });

      // Artificially expire the capability
      enrollment.expires_at = new Date(Date.now() - 1000).toISOString();

      const verification = deviceStore.verifyEnrollmentCapability(plaintextCode);
      expect(verification.valid).toBe(false);
      expect(verification.error).toContain('expired');
    });

    it('SHOULD ENFORCE ONE-TIME CONSUMPTION: Consuming code makes subsequent uses fail', () => {
      const targetUser = deviceStore.getUserById('usr_vasu_002')!;
      const { plaintextCode } = deviceStore.createEnrollmentCapability({
        userId: targetUser.id,
        durationMinutes: 15,
      });

      // First consumption succeeds
      const first = deviceStore.consumeEnrollmentCapability(plaintextCode, {
        deviceName: 'Vasu — Work Tablet',
        deviceType: 'tablet',
        os: 'iPadOS',
        browser: 'Safari',
        publicKey: 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEtest1234567890abcdef==',
        credentialId: 'cred_test_001',
      });
      expect(first.passport).toBeDefined();
      expect(first.passport.status).toBe('ACTIVE');

      // Second consumption must fail
      expect(() => {
        deviceStore.consumeEnrollmentCapability(plaintextCode, {
          deviceName: 'Second Device Attempt',
          publicKey: 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEtest2222222222abcdef==',
        });
      }).toThrow('already been consumed');
    });

    it('SHOULD SUPPORT MULTI-DEVICE ENROLLMENT: max_devices: 2 allows 2 devices and blocks 3rd attempt', () => {
      const targetUser = deviceStore.getUserById('usr_vasu_002')!;
      const { plaintextCode, enrollment } = deviceStore.createEnrollmentCapability({
        userId: targetUser.id,
        durationMinutes: 15,
        maxDevices: 2,
      });

      expect(enrollment.max_devices).toBe(2);
      expect(enrollment.devices_enrolled).toBe(0);

      // Device 1 enrolls
      const dev1 = deviceStore.consumeEnrollmentCapability(plaintextCode, {
        deviceName: 'Vasu Multi Device 1',
        publicKey: 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEmulti1111111111111111111==',
      });
      expect(dev1.passport.status).toBe('ACTIVE');
      expect(enrollment.devices_enrolled).toBe(1);
      expect(enrollment.status).toBe('ACTIVE');

      // Device 2 enrolls
      const dev2 = deviceStore.consumeEnrollmentCapability(plaintextCode, {
        deviceName: 'Vasu Multi Device 2',
        publicKey: 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEmulti2222222222222222222==',
      });
      expect(dev2.passport.status).toBe('ACTIVE');
      expect(enrollment.devices_enrolled).toBe(2);
      expect(enrollment.status).toBe('CONSUMED');

      // Device 3 attempt fails
      expect(() => {
        deviceStore.consumeEnrollmentCapability(plaintextCode, {
          deviceName: 'Vasu Multi Device 3',
          publicKey: 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEmulti3333333333333333333==',
        });
      }).toThrow('already been consumed');
    });

    it('SHOULD ENFORCE TARGET DEVICE TYPE BINDING: capability restricted to laptop rejects phone', () => {
      const targetUser = deviceStore.getUserById('usr_vasu_002')!;
      const { plaintextCode } = deviceStore.createEnrollmentCapability({
        userId: targetUser.id,
        durationMinutes: 15,
        targetDeviceType: 'laptop',
      });

      // Attempting to consume with deviceType 'phone' must be rejected
      expect(() => {
        deviceStore.consumeEnrollmentCapability(plaintextCode, {
          deviceName: 'Vasu Rogue Phone',
          deviceType: 'phone',
          publicKey: 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEroguePhone1234567890123==',
        });
      }).toThrow('Device type mismatch');

      // Consuming with deviceType 'laptop' succeeds
      const success = deviceStore.consumeEnrollmentCapability(plaintextCode, {
        deviceName: 'Vasu Approved Laptop',
        deviceType: 'laptop',
        publicKey: 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEapprovedLaptop123456789==',
      });
      expect(success.passport.device_type).toBe('laptop');
      expect(success.passport.status).toBe('ACTIVE');
    });
  });

  // =========================================================================
  // 3. DEVICE PASSPORT & WEBAUTHN ENROLLMENT
  // =========================================================================
  describe('3. Device Passport & WebAuthn Registration', () => {
    it('SHOULD CREATE COMPLETE DEVICE PASSPORT: Contains all hardware, credential, and region metadata', () => {
      const targetUser = deviceStore.getUserById('usr_vasu_002')!;
      const { plaintextCode } = deviceStore.createEnrollmentCapability({
        userId: targetUser.id,
        durationMinutes: 15,
      });

      const { passport } = deviceStore.consumeEnrollmentCapability(plaintextCode, {
        deviceName: 'Vasu — Primary MacBook',
        deviceType: 'laptop',
        os: 'macOS',
        browser: 'Chrome',
        browserVersion: '128.0',
        model: 'MacBook Pro',
        region: 'Punjab, India',
        publicKey: 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEvasuKeySpkiBase64String==',
        credentialId: 'cred_vasu_mbp_99',
        credentialType: 'WebAuthn / Platform Passkey',
      });

      expect(passport.device_id).toBeDefined();
      expect(passport.device_name).toBe('Vasu — Primary MacBook');
      expect(passport.os).toBe('macOS');
      expect(passport.browser).toBe('Chrome');
      expect(passport.model).toBe('MacBook Pro');
      expect(passport.registration_region).toBe('Punjab, India');
      expect(passport.risk_state).toBe('TRUSTED');
      expect(passport.status).toBe('ACTIVE');
      expect(passport.credential_id).toBe('cred_vasu_mbp_99');
      expect(passport.timeline.length).toBeGreaterThanOrEqual(2);

      // Verify audit events
      const audits = deviceStore.getAuditEvents();
      const passportAudit = audits.find(a => a.event_type === 'DEVICE_REGISTERED' && a.target_id === passport.device_id);
      expect(passportAudit).toBeDefined();
    });

    it('SHOULD NOT STORE PRIVATE KEYS OR BIOMETRICS: Only public key and credential ID exist', () => {
      const passports = deviceStore.getAllDevicePassports();
      for (const p of passports) {
        expect((p as any).private_key).toBeUndefined();
        expect((p as any).fingerprint).toBeUndefined();
        expect((p as any).face_id).toBeUndefined();
        expect((p as any).pin).toBeUndefined();
        expect(p.public_key).toBeDefined();
        expect(p.credential_id).toBeDefined();
      }
    });
  });

  // =========================================================================
  // 4. DEVICE RISK STATE, CONTROLS & TIMELINE
  // =========================================================================
  describe('4. Device Risk State & Controls', () => {
    it('SHOULD UPDATE DEVICE RISK STATE: Transitions from TRUSTED -> REVIEW -> RESTRICTED -> REVOKED', () => {
      const dev = deviceStore.getDevicePassport('dev_vasu_laptop')!;
      expect(dev.risk_state).toBe('TRUSTED');

      // Update to REVIEW
      const review = deviceStore.updateDeviceRiskState(dev.device_id, 'REVIEW', 'usr_admin_001');
      expect(review.risk_state).toBe('REVIEW');

      // Update to RESTRICTED
      const restricted = deviceStore.updateDeviceRiskState(dev.device_id, 'RESTRICTED', 'usr_admin_001');
      expect(restricted.risk_state).toBe('RESTRICTED');

      // Restore to TRUSTED
      const trusted = deviceStore.updateDeviceRiskState(dev.device_id, 'TRUSTED', 'usr_admin_001');
      expect(trusted.risk_state).toBe('TRUSTED');
    });

    it('SHOULD SUSPEND AND REACTIVATE DEVICE: Suspended device loses access, reactivate restores', () => {
      const dev = deviceStore.getDevicePassport('dev_vasu_laptop')!;

      // Suspend
      const suspended = deviceStore.suspendDevice(dev.device_id, 'usr_admin_001');
      expect(suspended.status).toBe('SUSPENDED');

      // Reactivate
      const reactivated = deviceStore.reactivateDevice(dev.device_id, 'usr_admin_001');
      expect(reactivated.status).toBe('ACTIVE');
      expect(reactivated.risk_state).toBe('TRUSTED');
    });

    it('SHOULD PREVENT ADMIN ROOT DEVICE SUSPENSION: Root Admin device cannot be suspended', () => {
      expect(() => {
        deviceStore.suspendDevice('dev_admin_primary', 'usr_admin_001');
      }).toThrow('Cannot suspend primary Admin hardware device');
    });

    it('SHOULD RECORD TIMELINE EVENTS: Every action updates device trust timeline', () => {
      const dev = deviceStore.getDevicePassport('dev_vasu_laptop')!;
      const initialCount = dev.timeline.length;

      deviceStore.recordDeviceTimelineEvent(
        dev.device_id,
        'ASSET_ACCESSED',
        'User decrypted confidential blueprint ast_alpha',
        'INFO'
      );

      const updated = deviceStore.getDevicePassport(dev.device_id)!;
      expect(updated.timeline.length).toBe(initialCount + 1);
      expect(updated.timeline[0].event).toBe('ASSET_ACCESSED');
    });
  });

  // =========================================================================
  // 5. SESSION MANAGEMENT & EMERGENCY CONTROLS
  // =========================================================================
  describe('5. Session Management & Emergency Controls', () => {
    it('SHOULD CREATE ACTIVE SESSION: Session contains device ID, position, and auth level', () => {
      const session = deviceStore.createSession({
        userId: 'usr_vasu_002',
        deviceId: 'dev_vasu_laptop',
        position: 'Manager',
        authLevel: 'PASSKEY',
        durationHours: 8,
      });

      expect(session.session_id).toBeDefined();
      expect(session.status).toBe('ACTIVE');
      expect(session.authentication_level).toBe('PASSKEY');
      expect(session.position).toBe('Manager');

      const active = deviceStore.getActiveSessions();
      expect(active.some(s => s.session_id === session.session_id)).toBe(true);
    });

    it('SHOULD REVOKE SESSIONS: Admin can revoke single session or all sessions for a user', () => {
      const s1 = deviceStore.createSession({
        userId: 'usr_vasu_002',
        deviceId: 'dev_vasu_laptop',
      });
      const s2 = deviceStore.createSession({
        userId: 'usr_vasu_002',
        deviceId: 'dev_vasu_laptop',
      });

      // Revoke single
      deviceStore.revokeSession(s1.session_id);
      expect(deviceStore.sessions.get(s1.session_id)?.status).toBe('REVOKED');
      expect(deviceStore.sessions.get(s2.session_id)?.status).toBe('ACTIVE');

      // Revoke all for user
      deviceStore.revokeAllSessionsForUser('usr_vasu_002');
      expect(deviceStore.sessions.get(s2.session_id)?.status).toBe('REVOKED');
    });

    it('SHOULD SUSPEND USER: revokes all user sessions, suspends user devices, and records before/after audit', () => {
      const s = deviceStore.createSession({
        userId: 'usr_vasu_002',
        deviceId: 'dev_vasu_laptop',
      });
      expect(deviceStore.sessions.get(s.session_id)?.status).toBe('ACTIVE');

      const suspended = deviceStore.suspendUser('usr_vasu_002', 'usr_admin_001');
      expect(suspended.status).toBe('SUSPENDED');

      // Check sessions revoked
      expect(deviceStore.sessions.get(s.session_id)?.status).toBe('REVOKED');

      // Check user devices suspended
      const dev = deviceStore.getDevicePassport('dev_vasu_laptop')!;
      expect(dev.status).toBe('SUSPENDED');

      // Check audit event
      const audits = deviceStore.getAuditEvents();
      const suspendAudit = audits.find(a => a.event_type === 'USER_SUSPENDED' && a.target_id === 'usr_vasu_002');
      expect(suspendAudit).toBeDefined();
      expect(suspendAudit?.before).toEqual({ status: 'ACTIVE' });
      expect(suspendAudit?.after).toEqual({ status: 'SUSPENDED' });
      expect(suspendAudit?.performed_by).toBe('usr_admin_001');
    });

    it('SHOULD ENFORCE SUSPENDED USER RESTRICTIONS: blocked from assets, sessions, and step-up auth', () => {
      // Assets blocked
      const assets = deviceStore.getAssetsForUser('usr_vasu_002');
      expect(assets).toEqual([]);

      // Session creation blocked
      expect(() => {
        deviceStore.createSession({
          userId: 'usr_vasu_002',
          deviceId: 'dev_vasu_laptop',
        });
      }).toThrow(/suspended/i);

      // Step-up auth blocked
      expect(() => {
        deviceStore.verifyStepUpAuthentication({
          userId: 'usr_vasu_002',
          deviceId: 'dev_vasu_laptop',
        });
      }).toThrow(/suspended/i);
    });

    it('SHOULD REACTIVATE USER: restores active user and device status with audit trail', () => {
      const reactivated = deviceStore.reactivateUser('usr_vasu_002', 'usr_admin_001');
      expect(reactivated.status).toBe('ACTIVE');

      // Check devices restored
      const dev = deviceStore.getDevicePassport('dev_vasu_laptop')!;
      expect(dev.status).toBe('ACTIVE');
      expect(dev.risk_state).toBe('TRUSTED');

      // Check audit event
      const audits = deviceStore.getAuditEvents();
      const reactivateAudit = audits.find(a => a.event_type === 'USER_REACTIVATED' && a.target_id === 'usr_vasu_002');
      expect(reactivateAudit).toBeDefined();
      expect(reactivateAudit?.before).toEqual({ status: 'SUSPENDED' });
      expect(reactivateAudit?.after).toEqual({ status: 'ACTIVE' });
      expect(reactivateAudit?.performed_by).toBe('usr_admin_001');
    });

    it('SHOULD EXECUTE DEVICE RECOVERY WORKFLOW: revokes lost device, terminates sessions, and issues replacement code', () => {
      // Create session on device before recovery
      const s = deviceStore.createSession({
        userId: 'usr_vasu_002',
        deviceId: 'dev_vasu_laptop',
      });
      expect(deviceStore.sessions.get(s.session_id)?.status).toBe('ACTIVE');

      const recovery = deviceStore.recoverDevice({
        lostDeviceId: 'dev_vasu_laptop',
        callerUserId: 'usr_admin_001',
      });

      // 1. Old device is permanently revoked
      expect(recovery.oldDevice.status).toBe('REVOKED');
      expect(recovery.oldDevice.risk_state).toBe('REVOKED');

      // 2. Old device sessions terminated
      expect(deviceStore.sessions.get(s.session_id)?.status).toBe('REVOKED');

      // 3. Replacement 15-minute capability issued
      expect(recovery.plaintextCode).toBeDefined();
      expect(recovery.enrollment.id).toBeDefined();
      expect(recovery.enrollment.duration_minutes).toBe(15);
      expect(recovery.enrollment.status).toBe('ACTIVE');

      // 4. Audit trail recorded
      const audits = deviceStore.getAuditEvents();
      const recoveryAudit = audits.find(a => a.event_type === 'DEVICE_RECOVERY_COMPLETED' && a.target_id === 'dev_vasu_laptop');
      expect(recoveryAudit).toBeDefined();
      expect(recoveryAudit?.performed_by).toBe('usr_admin_001');
    });
  });

  // =========================================================================
  // 6. STEP-UP AUTHENTICATION & DECRYPTION AUTHORIZATION
  // =========================================================================
  describe('6. Step-Up Authentication & Decryption Authorization', () => {
    it('SHOULD ISSUE TEMPORARY DECRYPTION PERMIT: Step-up authentication verifies device and issues token', () => {
      // First reactivate dev_vasu_laptop for this test
      const dev = deviceStore.getDevicePassport('dev_vasu_laptop')!;
      dev.status = 'ACTIVE';
      dev.risk_state = 'TRUSTED';

      const stepUp = deviceStore.verifyStepUpAuthentication({
        userId: 'usr_vasu_002',
        deviceId: 'dev_vasu_laptop',
        assetId: 'ast_avionics',
      });

      expect(stepUp.authorized).toBe(true);
      expect(stepUp.token).toContain('KMS-AUTH-');

      // Verify audit events recorded
      const audits = deviceStore.getAuditEvents();
      const stepUpAudit = audits.find(a => a.event_type === 'STEP_UP_AUTH_SUCCESS');
      const kmsAudit = audits.find(a => a.event_type === 'TEMPORARY_KEY_AUTHORIZED');
      expect(stepUpAudit).toBeDefined();
      expect(kmsAudit).toBeDefined();
    });

    it('SHOULD REJECT STEP-UP FOR REVOKED DEVICE: Revoked device cannot obtain decryption authorization', () => {
      const dev = deviceStore.getDevicePassport('dev_vasu_laptop')!;
      deviceStore.updateDeviceRiskState(dev.device_id, 'REVOKED');

      expect(() => {
        deviceStore.verifyStepUpAuthentication({
          userId: 'usr_vasu_002',
          deviceId: dev.device_id,
        });
      }).toThrow('revoked');

      // Restore device
      deviceStore.reactivateDevice(dev.device_id);
    });
  });

  // =========================================================================
  // 7. ADMINISTRATIVE BEFORE/AFTER AUDIT TRAIL (REQUIREMENT 28)
  // =========================================================================
  describe('7. Administrative Before/After Audit Trail (Requirement 28)', () => {
    it('SHOULD TRACK BEFORE AND AFTER STATE FOR ADMINISTRATIVE CHANGES: audit log preserves before, after, target, and performed_by', () => {
      const dev = deviceStore.getDevicePassport('dev_vasu_laptop')!;
      deviceStore.updateDeviceRiskState(dev.device_id, 'REVIEW', 'usr_admin_001');

      const audits = deviceStore.getAuditEvents();
      const riskAudit = audits.find(a => a.event_type === 'DEVICE_RISK_STATE_CHANGED' && a.target_id === dev.device_id);
      expect(riskAudit).toBeDefined();
      expect(riskAudit?.target).toBe(dev.device_id);
      expect(riskAudit?.performed_by).toBe('usr_admin_001');
      expect(riskAudit?.before).toEqual({ risk_state: 'TRUSTED' });
      expect(riskAudit?.after).toEqual({ risk_state: 'REVIEW' });
      expect(riskAudit?.event_hash).toMatch(/^0x[0-9a-f]{64}$/);

      // Restore
      deviceStore.updateDeviceRiskState(dev.device_id, 'TRUSTED', 'usr_admin_001');
    });
  });
});
