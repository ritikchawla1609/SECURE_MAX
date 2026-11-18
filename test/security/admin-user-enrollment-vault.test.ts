import { describe, it, expect, vi, beforeAll } from 'vitest';

vi.mock('server-only', () => ({}));

import { deviceStore } from '../../src/lib/auth/deviceStore';
import { registerNewUserByAdmin } from '../../src/app/actions/adminUsers';
import { UserRole } from '../../src/types';

describe('End-to-End Integration: Admin User Creation, Enrollment Generation, Credential Login & Vault Uploads', () => {
  beforeAll(() => {
    deviceStore.seedTestDataForTesting();
  });

  let createdUser: any = null;
  let starterCode: string = '';

  it('Flow 1: Admin can add new user from Command Center (registerNewUserByAdmin)', async () => {
    const res = await registerNewUserByAdmin({
      name: 'Rohan Sharma',
      email: 'rohan.sharma@securemax.mil',
      role: 'ENGINEER',
      department: 'Tactical Hardware',
    });

    expect(res.success).toBe(true);
    expect(res.user).toBeDefined();
    expect(res.user?.name).toBe('Rohan Sharma');
    expect(res.user?.email).toBe('rohan.sharma@securemax.mil');
    expect(res.user?.enrollmentCode).toBeDefined();

    createdUser = res.user;
    starterCode = res.user?.enrollmentCode || '';

    // Verify user exists in deviceStore
    const fetched = deviceStore.getUserById(createdUser.id);
    expect(fetched).toBeDefined();
    expect(fetched?.name).toBe('Rohan Sharma');
    expect(fetched?.role).toBe(UserRole.ENGINEER);
  });

  it('Flow 2: New user shows up in personnel and admin can generate 15-minute enrollment capability', () => {
    // Check user in personnel list
    const allUsers = Array.from(deviceStore.users.values());
    const match = allUsers.find(u => u.id === createdUser.id);
    expect(match).toBeDefined();
    expect(match?.email).toBe('rohan.sharma@securemax.mil');

    // Admin selects that user and issues a 15-minute enrollment capability
    const { enrollment, plaintextCode } = deviceStore.createEnrollmentCapability({
      userId: createdUser.id,
      durationMinutes: 15,
      maxDevices: 1,
      callerUserId: 'ADM-0001',
      callerRole: UserRole.ADMIN,
    });

    expect(enrollment).toBeDefined();
    expect(enrollment.user_id).toBe(createdUser.id);
    expect(enrollment.duration_minutes).toBe(15);
    expect(plaintextCode).toBeDefined();

    // Verify capability can be resolved with either raw or prefixed code
    const verificationRaw = deviceStore.verifyEnrollmentCapability(plaintextCode);
    expect(verificationRaw.valid).toBe(true);
    expect(verificationRaw.user?.id).toBe(createdUser.id);

    const verificationPrefixed = deviceStore.verifyEnrollmentCapability(`SMX-${plaintextCode}`);
    expect(verificationPrefixed.valid).toBe(true);
    expect(verificationPrefixed.user?.id).toBe(createdUser.id);
  });

  it('Flow 3: New user can log in / enroll device using the credential', async () => {
    // User uses starter code or generated code
    const verification = deviceStore.verifyEnrollmentCapability(starterCode);
    expect(verification.valid).toBe(true);
    expect(verification.user?.email).toBe('rohan.sharma@securemax.mil');

    // Complete enrollment / login
    const result = deviceStore.consumeEnrollmentCapability(starterCode, {
      deviceName: 'Rohan Primary MacBook',
      deviceType: 'laptop',
      os: 'macOS',
      browser: 'Chrome',
      publicKey: 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEtestpublickeyforrohan1234567890abcdef',
    });

    expect(result.passport).toBeDefined();
    expect(result.passport.user_id).toBe(createdUser.id);
    expect(result.user.name).toBe('Rohan Sharma');

    // Create session for user
    const session = await deviceStore.createSession({
      userId: createdUser.id,
      deviceId: result.passport.device_id,
      position: result.passport.position,
      authLevel: 'PASSKEY',
      durationHours: 8,
    });

    expect(session.session_id).toBeDefined();
    expect(session.user_id).toBe(createdUser.id);
  });

  it('Flow 4A: User can add data publicly (ALL_PEOPLE share scope)', () => {
    const publicAsset = deviceStore.createAsset({
      name: 'Public_Safety_Standard_2026.pdf',
      folder: 'Legal',
      classification: 'PUBLIC',
      description: 'Organization-wide public safety and defense standard',
      plaintext: 'PUBLIC GUIDELINES: Standard procedures for zero-trust enclave operations.',
      ownerId: createdUser.id,
      ownerName: 'Rohan Sharma',
      shareScope: 'ALL_PEOPLE',
      canDecryptShared: true,
      canDownloadShared: true,
    });

    expect(publicAsset).toBeDefined();
    expect(publicAsset.shared_with_all).toBe(true);
    expect(publicAsset.classification).toBe('PUBLIC');

    // Owner has full access
    const ownerAssets = deviceStore.getAssetsForUser(createdUser.id);
    const ownerView = ownerAssets.find(a => a.asset.id === publicAsset.id);
    expect(ownerView).toBeDefined();
    expect(ownerView?.is_owner).toBe(true);
    expect(ownerView?.can_decrypt).toBe(true);
    expect(ownerView?.can_download).toBe(true);

    // Any other team member (e.g. Vasu) can also access it because it is shared with ALL_PEOPLE
    const vasuAssets = deviceStore.getAssetsForUser('usr_vasu_002');
    const vasuView = vasuAssets.find(a => a.asset.id === publicAsset.id);
    expect(vasuView).toBeDefined();
    expect(vasuView?.can_read).toBe(true);
    expect(vasuView?.can_decrypt).toBe(true);
  });

  it('Flow 4B: User can add data specifically (SPECIFIC_USER share scope)', () => {
    const specificAsset = deviceStore.createAsset({
      name: 'Proprietary_Chipset_Schematic.cad',
      folder: 'Engineering',
      classification: 'RESTRICTED',
      description: 'Confidential microcode for hardware trust anchor',
      plaintext: 'RESTRICTED PAYLOAD: VHDL and Verilog registers for cryptographic co-processor.',
      ownerId: createdUser.id,
      ownerName: 'Rohan Sharma',
      shareScope: 'SPECIFIC_USER',
      targetUserId: 'usr_vasu_002', // specifically shared with Vasu
      canDecryptShared: true,
      canDownloadShared: true,
    });

    expect(specificAsset).toBeDefined();
    expect(specificAsset.shared_with_all).toBe(false);

    // Vasu (targeted recipient) has decryption access
    const vasuAssets = deviceStore.getAssetsForUser('usr_vasu_002');
    const vasuView = vasuAssets.find(a => a.asset.id === specificAsset.id);
    expect(vasuView).toBeDefined();
    expect(vasuView?.can_read).toBe(true);
    expect(vasuView?.can_decrypt).toBe(true);

    // Auditor (non-targeted third party) does NOT have access
    const auditorAssets = deviceStore.getAssetsForUser('usr_auditor_003');
    const auditorView = auditorAssets.find(a => a.asset.id === specificAsset.id);
    expect(auditorView).toBeUndefined();
  });
});
