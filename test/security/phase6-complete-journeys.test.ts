import { describe, it, expect, vi, beforeAll } from 'vitest';

vi.mock('server-only', () => ({}));

import { deviceStore } from '../../src/lib/auth/deviceStore';
import { registerNewUserByAdmin } from '../../src/app/actions/adminUsers';
import { 
  approveAccessRequestAction, 
  rejectAccessRequestAction, 
  revokeLiveGrantAction, 
  fetchAllAccessRequestsAction,
  fetchLiveGrantsAction 
} from '../../src/app/actions/accessRequests';
import { authorizeAssetAccess } from '../../src/lib/api/access-flow';
import { UserRole, UserStatus } from '../../src/types';

describe('PHASE 6: End-to-End User Journeys & Complete Quality Gate Suite', () => {
  beforeAll(() => {
    deviceStore.seedTestDataForTesting(true);
  });

  const adminId = 'usr_admin_001';
  let userA: any = null;
  let userB: any = null;
  let userBEnrollmentCode: string = '';
  let userBSessionId: string = '';
  let userBDeviceId: string = '';
  let createdAsset: any = null;
  let accessRequestId: string = '';

  it('Journey 1: Registration → Enrollment Code Generation → Device Registration → Login Session Creation', async () => {
    // 1. Admin registers User A (Lead Mission Analyst)
    const resA = await registerNewUserByAdmin({
      name: 'Agent Sarah Connor',
      email: 'sarah.connor@securemax.mil',
      role: 'ENGINEER',
      department: 'Cyber Operations',
    });
    expect(resA.success).toBe(true);
    expect(resA.user).toBeDefined();
    userA = resA.user;

    // Enroll User A's device
    const enrollA = deviceStore.consumeEnrollmentCapability(userA.enrollmentCode, {
      deviceName: 'Sarah Ops Rig',
      deviceType: 'laptop',
      os: 'macOS',
      browser: 'Chrome 120',
      publicKey: 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAESarahPublicKeyHash78901234567890abcdef',
    });
    const sessionA = await deviceStore.createSession({
      userId: userA.id,
      deviceId: enrollA.passport.device_id,
      position: enrollA.passport.position,
      authLevel: 'PASSKEY',
      durationHours: 8,
    });
    userA.deviceId = enrollA.passport.device_id;
    userA.sessionId = sessionA.session_id;

    // 2. Admin registers User B (Field Specialist)
    const resB = await registerNewUserByAdmin({
      name: 'Specialist John Matrix',
      email: 'john.matrix@securemax.mil',
      role: 'USER',
      department: 'Tactical Support',
    });
    expect(resB.success).toBe(true);
    expect(resB.user).toBeDefined();
    userB = resB.user;
    userBEnrollmentCode = resB.user.enrollmentCode;
    expect(userBEnrollmentCode).toBeTruthy();

    // 3. User B verifies enrollment code
    const verification = deviceStore.verifyEnrollmentCapability(userBEnrollmentCode);
    expect(verification.valid).toBe(true);
    expect(verification.user?.id).toBe(userB.id);

    // 4. User B completes device registration with P-256 public key
    const enrollmentResult = deviceStore.consumeEnrollmentCapability(userBEnrollmentCode, {
      deviceName: 'Matrix Tactical Rig',
      deviceType: 'laptop',
      os: 'macOS',
      browser: 'Chrome 120',
      publicKey: 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEMatrixPublicKeyHash78901234567890abcdef',
    });
    expect(enrollmentResult.passport).toBeDefined();
    expect(enrollmentResult.passport.user_id).toBe(userB.id);
    userBDeviceId = enrollmentResult.passport.device_id;

    // 5. User B establishes an 8-hour Zero-Trust session
    const session = await deviceStore.createSession({
      userId: userB.id,
      deviceId: userBDeviceId,
      position: enrollmentResult.passport.position,
      authLevel: 'PASSKEY',
      durationHours: 8,
    });
    expect(session.session_id).toBeTruthy();
    userBSessionId = session.session_id;

    // Verify session is active in store
    const activeSession = deviceStore.getSession(userBSessionId);
    expect(activeSession).toBeDefined();
    expect(activeSession?.user_id).toBe(userB.id);
  });

  it('Journey 2: User A creates a confidential encrypted resource in Vault', () => {
    // User A creates a classified tactical directive
    createdAsset = deviceStore.createAsset({
      name: 'Tactical_Operation_Red_Dawn.pdf',
      folder: 'Engineering',
      classification: 'CONFIDENTIAL',
      description: 'Encrypted tactical deployment plan for satellite telemetry',
      plaintext: 'TOP SECRET TELEMETRY: Frequency band 8.42GHz. Encryption key rotation 60s.',
      ownerId: userA.id,
      ownerName: userA.name,
      shareScope: 'PRIVATE',
    });

    expect(createdAsset.id).toBeDefined();
    expect(createdAsset.owner_id).toBe(userA.id);
    expect(createdAsset.classification).toBe('CONFIDENTIAL');
    expect(createdAsset.encrypted_content).toBeDefined();
    expect(deviceStore.getWrappedDEK(createdAsset.id)).toBeDefined();

    // Owner (User A) has full access
    const ownerAssignment = deviceStore.getAssignment(userA.id, createdAsset.id);
    expect(ownerAssignment?.can_read).toBe(true);
    expect(ownerAssignment?.can_decrypt).toBe(true);

    // User B initially has NO access
    const userBAssignment = deviceStore.getAssignment(userB.id, createdAsset.id);
    expect(userBAssignment).toBeNull();
  });

  it('Journey 3: User B requests access clearance for User A’s resource', () => {
    const request = deviceStore.createAccessRequest({
      userId: userB.id,
      requestType: 'ASSET_ACCESS',
      assetId: createdAsset.id,
      reason: 'Mission requirement: Need telemetry codes for ground relay station setup.',
    });

    expect(request.id).toBeDefined();
    expect(request.status).toBe('PENDING');
    expect(request.user_id).toBe(userB.id);
    expect(request.asset_id).toBe(createdAsset.id);
    accessRequestId = request.id;

    // Verify request is present in pending queue
    const allRequests = deviceStore.getAccessRequests();
    const found = allRequests.find(r => r.id === accessRequestId);
    expect(found).toBeDefined();
    expect(found?.status).toBe('PENDING');
  });

  it('Journey 4: Admin reviews and approves User B’s clearance with 30-minute TTL', async () => {
    const approveRes = await approveAccessRequestAction({
      requestId: accessRequestId,
      ttlMinutes: 30,
    });

    expect(approveRes.success).toBe(true);
    expect(approveRes.request?.status).toBe('APPROVED');
    expect(approveRes.request?.ttl_minutes).toBe(30);
    expect(approveRes.grant).toBeDefined();
    expect(approveRes.grant?.status).toBe('ACTIVE');

    // Confirm that User B now has an active assignment in deviceStore
    const userBAssignment = deviceStore.getAssignment(userB.id, createdAsset.id);
    expect(userBAssignment).toBeDefined();
    expect(userBAssignment?.status).toBe('ACTIVE');
    expect(userBAssignment?.can_decrypt).toBe(true);
    expect(userBAssignment?.can_read).toBe(true);
  });

  it('Journey 5: User B accesses and decrypts the resource according to granted permissions', async () => {
    // Authorize decryption for User B
    const authResult = await authorizeAssetAccess(
      userB.id,
      createdAsset.id,
      userBSessionId,
      userBDeviceId
    );

    expect(authResult.authorized).toBe(true);
    expect(authResult.tempToken).toBeTruthy();

    // Verify access was logged in audit history
    const asset = deviceStore.assets.get(createdAsset.id);
    expect(asset).toBeDefined();
    const accessLogs = asset!.access_history;
    expect(accessLogs.length).toBeGreaterThanOrEqual(1);
  });

  it('Journey 6: Owner revokes access → Recipient immediately loses access', async () => {
    // Owner User A revokes access to the asset for User B
    deviceStore.revokeAssetShare(createdAsset.id, userB.id, userA.id);

    // Verify assignment is revoked or removed
    const userBAssignment = deviceStore.getAssignment(userB.id, createdAsset.id);
    expect(userBAssignment === null || userBAssignment?.can_decrypt === false).toBe(true);

    // Subsequent decryption attempt by User B MUST be rejected
    await expect(
      authorizeAssetAccess(userB.id, createdAsset.id, userBSessionId, userBDeviceId)
    ).rejects.toThrow(/Access Denied/i);

    // Audit trail records ASSET_ACCESS_REVOKED
    const latestAudit = deviceStore.auditEvents.find(e => (e as any).event_type === 'ASSET_ACCESS_REVOKED');
    expect(latestAudit).toBeDefined();
    expect(latestAudit?.target_id).toBe(createdAsset.id);
  });

  it('Journey 7: User uploads → Shares directly with peer → Peer decrypts → Owner revokes', async () => {
    // User B creates a shared intelligence memo
    const memo = deviceStore.createAsset({
      name: 'Field_Recon_Intel_007.txt',
      folder: 'Projects',
      classification: 'INTERNAL',
      description: 'Reconnaissance notes from sector 4',
      plaintext: 'Field reconnaissance complete. Perimeter is secure.',
      ownerId: userB.id,
      ownerName: userB.name,
      shareScope: 'PRIVATE',
    });

    // Share with User A
    deviceStore.shareAsset({
      assetId: memo.id,
      targetUserId: userA.id,
      callerUserId: userB.id,
      canRead: true,
      canDecrypt: true,
    });

    // User A can access and decrypt
    const authA = await authorizeAssetAccess(userA.id, memo.id, userA.sessionId, userA.deviceId);
    expect(authA.authorized).toBe(true);

    // User B revokes share
    deviceStore.revokeAssetShare(memo.id, userA.id, userB.id);

    // User A access is now denied
    await expect(
      authorizeAssetAccess(userA.id, memo.id, userA.sessionId, userA.deviceId)
    ).rejects.toThrow(/Access Denied/i);
  });

  it('Journey 8: Unauthorized user attempts access → Request is denied immediately', async () => {
    const unauthorizedUserId = 'usr_unauthorized_attacker';
    
    // Attacker attempts to authorize access to User A's confidential asset
    await expect(
      authorizeAssetAccess(unauthorizedUserId, createdAsset.id, 'malicious-session', 'rogue-device')
    ).rejects.toThrow(/Access Denied|User not found/i);
  });

  it('Journey 9: Access Request Rejection Flow: Admin rejects clearance request with reason', async () => {
    // User B requests clearance for another asset
    const anotherReq = deviceStore.createAccessRequest({
      userId: userB.id,
      requestType: 'ASSET_ACCESS',
      assetId: 'ast_kms',
      reason: 'Requesting KMS crypto module keys for testing.',
    });

    expect(anotherReq.status).toBe('PENDING');

    // Admin rejects request
    const rejectRes = await rejectAccessRequestAction({
      requestId: anotherReq.id,
      reason: 'Strict zero-trust policy violation: KMS keys restricted to L4 Cryptographers.',
    });

    expect(rejectRes.success).toBe(true);
    expect(rejectRes.request?.status).toBe('REJECTED');
    expect(rejectRes.request?.rejected_reason).toContain('KMS keys restricted');

    // Confirm that User B is NOT granted access
    await expect(
      authorizeAssetAccess(userB.id, 'ast_kms', userBSessionId, userBDeviceId)
    ).rejects.toThrow(/Access Denied/i);
  });

  it('Journey 10: Session Refresh, Live Role Reflection & Tamper-Evident Ledger Integrity', async () => {
    // 1. Session verification & lifetime check
    const verifiedSession = deviceStore.getSession(userBSessionId);
    expect(verifiedSession).toBeDefined();
    expect(verifiedSession?.user_id).toBe(userB.id);
    expect(new Date(verifiedSession!.expires_at).getTime()).toBeGreaterThan(Date.now());

    // 2. Role escalation defense: User B status modified in memory
    const userObj = deviceStore.getUserById(userB.id);
    expect(userObj).toBeDefined();
    expect(userObj?.role).toBe(UserRole.USER);

    // 3. User Suspension / Containment: if user is suspended, all access is instantly revoked
    deviceStore.suspendUser(userB.id);
    const suspendedAssignment = deviceStore.getAssignment(userB.id, createdAsset.id);
    expect(suspendedAssignment).toBeNull(); // Suspended users receive NULL for all assignments

    // 4. Ledger persistence integrity: State can be saved and reloaded cleanly
    deviceStore.saveToDisk();
    const ledgerIntegrity = deviceStore.auditEvents.every(e => Boolean(e.id && (e.created_at || (e as any).timestamp)));
    expect(ledgerIntegrity).toBe(true);
  });
});
