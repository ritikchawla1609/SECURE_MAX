import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
vi.mock('server-only', () => ({}));
import fs from 'fs';
import path from 'path';
import os from 'os';
import { deviceStore, storeEvents } from '../../src/lib/auth/deviceStore';
import { UserRole, UserStatus } from '../../src/types';

describe('Real-Time Event Emission & Permanent Disk Persistence Suite', () => {
  const testStorePath = path.join(os.tmpdir(), `securemax_store_test_${Date.now()}_${Math.random().toString(36).slice(2)}.json`);

  beforeAll(() => {
    process.env.SECUREMAX_STORE_PATH = testStorePath;
  });

  afterAll(() => {
    try {
      if (fs.existsSync(testStorePath)) fs.unlinkSync(testStorePath);
    } catch {}
    delete process.env.SECUREMAX_STORE_PATH;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    deviceStore.resetForTesting();
  });

  describe('1. Real-Time Event Emission Tests', () => {
    it('SHOULD EMIT BOOTSTRAP: When root admin bootstraps the system', () => {
      let emittedEvent: any = null;
      const listener = (event: any) => {
        if (event.type === 'BOOTSTRAP') emittedEvent = event;
      };
      storeEvents.on('change', listener);

      try {
        deviceStore.bootstrapRootAdmin({
          orgName: 'National Cyber Command',
          orgType: 'Defense',
          country: 'India',
          timezone: 'Asia/Kolkata',
          adminName: 'General Sharma',
          email: 'sharma@defense.gov.in',
          adminId: 'ADM-GEN-001',
          deviceName: 'Admin Hardware Laptop',
          publicKey: 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEtestpublickey1234567890abcdef',
        });

        expect(emittedEvent).not.toBeNull();
        expect(emittedEvent.type).toBe('BOOTSTRAP');
        expect(emittedEvent.data.rootAdmin.email).toBe('sharma@defense.gov.in');
        expect(emittedEvent.data.adminDevice.device_name).toBe('Admin Hardware Laptop');
      } finally {
        storeEvents.off('change', listener);
      }
    });

    it('SHOULD EMIT USER_REGISTERED: When a new user identity is registered', () => {
      let emittedEvent: any = null;
      const listener = (event: any) => {
        if (event.type === 'USER_REGISTERED') emittedEvent = event;
      };
      storeEvents.on('change', listener);

      try {
        const { user, enrollmentCode } = deviceStore.registerUser({
          name: 'Vikram Singh',
          email: 'vikram@securemax.mil',
          role: UserRole.USER,
        });

        expect(emittedEvent).not.toBeNull();
        expect(emittedEvent.type).toBe('USER_REGISTERED');
        expect(emittedEvent.data.email).toBe('vikram@securemax.mil');
        expect(enrollmentCode).toMatch(/^SMX-/);
      } finally {
        storeEvents.off('change', listener);
      }
    });

    it('SHOULD EMIT ENROLLMENT_CAPABILITY_CREATED & DEVICE_ENROLLED: When enrolling a new device', () => {
      const { user } = deviceStore.registerUser({
        name: 'Anita Roy',
        email: 'anita@securemax.mil',
        role: UserRole.USER,
      });

      let capEvent: any = null;
      let enrolledEvent: any = null;
      const listener = (event: any) => {
        if (event.type === 'ENROLLMENT_CAPABILITY_CREATED') capEvent = event;
        if (event.type === 'DEVICE_ENROLLED') enrolledEvent = event;
      };
      storeEvents.on('change', listener);

      try {
        const { enrollment: capability, plaintextCode } = deviceStore.createEnrollmentCapability({
          userId: user.id,
          positionName: 'Manager',
          durationMinutes: 30,
          maxDevices: 1,
        });

        expect(capEvent).not.toBeNull();
        expect(capEvent.type).toBe('ENROLLMENT_CAPABILITY_CREATED');
        expect(capEvent.data.id).toBe(capability.id);

        const enrolled = deviceStore.consumeEnrollmentCapability(plaintextCode, {
          deviceName: 'Anita Secure Tablet',
          publicKey: 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEanita_tablet_public_key_test',
          deviceType: 'tablet',
          os: 'iOS',
          browser: 'Safari',
        });

        expect(enrolledEvent).not.toBeNull();
        expect(enrolledEvent.type).toBe('DEVICE_ENROLLED');
        expect(enrolledEvent.data.device_name).toBe('Anita Secure Tablet');
      } finally {
        storeEvents.off('change', listener);
      }
    });

    it('SHOULD EMIT ACCESS_REQUEST EVENTS: Submit, approve, and reject access requests', () => {
      // Seed an admin and a user
      const admin = deviceStore.bootstrapRootAdmin({
        orgName: 'SecureMAX Vault',
        orgType: 'Defense',
        adminName: 'Chief Admin',
        email: 'chief@securemax.mil',
        deviceName: 'Chief Terminal',
        publicKey: 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEchief_pubkey',
      });

      const { user } = deviceStore.registerUser({
        name: 'Officer Rajiv',
        email: 'rajiv@securemax.mil',
        role: UserRole.USER,
      });

      const events: any[] = [];
      const listener = (event: any) => events.push(event);
      storeEvents.on('change', listener);

      try {
        // 1. Submit Request
        const req1 = deviceStore.createAccessRequest({
          userId: user.id,
          requestType: 'HIGH_RISK_DATA',
          assetId: 'asset_intel_001',
          reason: 'Classified tactical briefing analysis',
        });
        expect(events.some(e => e.type === 'ACCESS_REQUEST_SUBMITTED' && e.data.id === req1.id)).toBe(true);

        // 2. Approve Request
        const approved = deviceStore.approveAccessRequest(req1.id, admin.rootAdmin.id);
        expect(events.some(e => e.type === 'ACCESS_REQUEST_APPROVED' && e.data.id === approved.id)).toBe(true);
        expect(approved.status).toBe('APPROVED');
        expect(approved.nft_token_id).toBeDefined();

        // 3. Submit Second Request & Reject
        const req2 = deviceStore.createAccessRequest({
          userId: user.id,
          requestType: 'HIGH_RISK_DATA',
          assetId: 'asset_classified_002',
          reason: 'Unauthorized curiosity check',
        });
        const rejected = deviceStore.rejectAccessRequest(req2.id, admin.rootAdmin.id, 'Insufficient security clearance');
        expect(events.some(e => e.type === 'ACCESS_REQUEST_REJECTED' && e.data.id === rejected.id)).toBe(true);
        expect(rejected.status).toBe('REJECTED');
        expect(rejected.rejected_reason).toBe('Insufficient security clearance');
      } finally {
        storeEvents.off('change', listener);
      }
    });

    it('SHOULD EMIT SESSION & ADMIN LOGIN EVENTS: Session creation, admin logins, and revocations', () => {
      const { user } = deviceStore.registerUser({
        name: 'Dev Member',
        email: 'dev@securemax.mil',
        role: UserRole.USER,
      });

      const dev = deviceStore.registerDevice({
        userId: user.id,
        deviceName: 'Workstation 1',
        publicKey: 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEworkstation_key',
      });

      const events: any[] = [];
      const listener = (event: any) => events.push(event);
      storeEvents.on('change', listener);

      try {
        // Admin Login
        deviceStore.recordAdminLogin({
          adminId: 'usr_admin_001',
          deviceId: 'dev_admin_001',
          success: true,
          region: 'Delhi, India',
        });
        expect(events.some(e => e.type === 'ADMIN_LOGIN' && e.data.success === true)).toBe(true);

        // Failed Admin Login
        deviceStore.recordAdminLogin({
          adminId: 'usr_admin_001',
          deviceId: 'dev_unknown',
          success: false,
          reason: 'INVALID_SIGNATURE',
        });
        expect(events.some(e => e.type === 'ADMIN_LOGIN' && e.data.success === false)).toBe(true);
        expect(deviceStore.systemSettings.failed_admin_logins).toBe(1);

        // Session Create
        const session = deviceStore.createSession({
          userId: user.id,
          deviceId: dev.id,
        });
        expect(events.some(e => e.type === 'SESSION_CREATED' && e.data.session_id === session.session_id)).toBe(true);

        // Session Revoke
        deviceStore.revokeSession(session.session_id, user.id);
        expect(events.some(e => e.type === 'SESSION_REVOKED' && e.data.sessionId === session.session_id)).toBe(true);
      } finally {
        storeEvents.off('change', listener);
      }
    });
  });

  describe('2. Permanent Disk Persistence & Reload Integrity Tests', () => {
    it('SHOULD PERSIST AND RESTORE STATE ACROSS RELOADS: Admin logins, requests, users, devices', () => {
      // 1. Setup rich state
      const admin = deviceStore.bootstrapRootAdmin({
        orgName: 'Integrated Cyber Command',
        orgType: 'Enterprise',
        country: 'India',
        adminName: 'Marshal Patel',
        email: 'marshal@cyber.mil',
        deviceName: 'Air-Gapped Terminal',
        publicKey: 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEmarshal_public_key',
      });

      // Record successful and failed admin logins
      deviceStore.recordAdminLogin({
        adminId: admin.rootAdmin.id,
        deviceId: admin.adminDevice.id,
        success: true,
        region: 'Gujarat, India',
        device_name: 'Air-Gapped Terminal',
      });

      deviceStore.recordAdminLogin({
        adminId: admin.rootAdmin.id,
        deviceId: 'dev_rogue',
        success: false,
        reason: 'UNAUTHORIZED_DEVICE',
      });

      // Register new user
      const { user } = deviceStore.registerUser({
        name: 'Dr. Sunita',
        email: 'sunita@cyber.mil',
        role: UserRole.MANAGER,
      });

      // Create and approve an access request
      const req = deviceStore.createAccessRequest({
        userId: user.id,
        requestType: 'HIGH_RISK_DATA',
        assetId: 'vault_payload_99',
        reason: 'Cryptographic key audit',
      });

      deviceStore.approveAccessRequest(req.id, admin.rootAdmin.id);

      // Create an active session
      const session = deviceStore.createSession({
        userId: user.id,
        deviceId: admin.adminDevice.id,
      });

      // 2. Explicitly save to disk
      deviceStore.saveToDisk();

      // 3. Clear all in-memory structures to simulate full process restart
      deviceStore.users.clear();
      deviceStore.devices.clear();
      deviceStore.devicePassports.clear();
      deviceStore.sessions.clear();
      deviceStore.accessRequests = [];
      deviceStore.auditEvents = [];
      deviceStore.systemSettings = {
        admin_initialized: false,
        bootstrap_enabled: true,
        system_state: 'UNINITIALIZED',
        admin_locked: false,
        failed_admin_logins: 0,
      };

      expect(deviceStore.users.size).toBe(0);
      expect(deviceStore.isSystemInitialized()).toBe(false);

      // 4. Reload from disk
      deviceStore.loadFromDisk();

      // 5. Verify restored state
      expect(deviceStore.isSystemInitialized()).toBe(true);
      expect(deviceStore.systemSettings.failed_admin_logins).toBe(1);
      expect(deviceStore.systemSettings.last_admin_login?.region).toBe('Gujarat, India');
      expect(deviceStore.systemSettings.last_admin_login?.device_name).toBe('Air-Gapped Terminal');

      // Verify user restored
      const restoredUser = deviceStore.getUserByEmail('sunita@cyber.mil');
      expect(restoredUser).not.toBeNull();
      expect(restoredUser?.name).toBe('Dr. Sunita');

      // Verify admin restored
      const restoredAdmin = deviceStore.getUserByEmail('marshal@cyber.mil');
      expect(restoredAdmin).not.toBeNull();
      expect(restoredAdmin?.role).toBe(UserRole.ADMIN);

      // Verify access request restored
      const restoredReqs = deviceStore.getAccessRequests();
      const matchingReq = restoredReqs.find(r => r.id === req.id);
      expect(matchingReq).toBeDefined();
      expect(matchingReq?.status).toBe('APPROVED');
      expect(matchingReq?.nft_token_id).toBeDefined();

      // Verify session restored
      const restoredSessions = deviceStore.getActiveSessions();
      const matchingSession = restoredSessions.find(s => s.session_id === session.session_id);
      expect(matchingSession).toBeDefined();
      expect(matchingSession?.user_id).toBe(user.id);

      // Verify audit events preserved
      const auditEvents = deviceStore.getAuditEvents();
      expect(auditEvents.length).toBeGreaterThan(0);
      expect(auditEvents.some(a => a.event_type === 'ADMIN_LOGIN_FAILURE')).toBe(true);
      expect(auditEvents.some(a => a.event_type === 'NFT_ACCESS_PERMIT_MINTED')).toBe(true);
    });
  });
});
