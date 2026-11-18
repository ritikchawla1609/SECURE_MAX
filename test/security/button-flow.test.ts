import { describe, it, expect, vi, beforeAll } from 'vitest';

vi.mock('server-only', () => ({}));

import { deviceStore } from '../../src/lib/auth/deviceStore';
import { authorizeAssetAccess, executeDecryption, revokeAssetAccess } from '../../src/lib/api/access-flow';

describe('End-to-End Decrypt and Revoke Flow', () => {
  beforeAll(() => {
    deviceStore.seedTestDataForTesting();
  });

  const vasuId = 'usr_vasu_002';
  const assetId = 'ast_alpha';
  const sessionId = 'test-session-1';
  const deviceId = 'dev_vasu_laptop';

  it('1. User with active assignment can authorize and decrypt AES-256-GCM data', async () => {
    const authRes = await authorizeAssetAccess(vasuId, assetId, sessionId, deviceId);
    expect(authRes.authorized).toBe(true);
    expect(authRes.tempToken).toBeDefined();

    const asset = deviceStore.assets.get(assetId)!;
    const encryptedBuffer = Buffer.from(asset.encrypted_content, 'base64');
    const decrypted = await executeDecryption(
      assetId,
      encryptedBuffer,
      asset.iv,
      asset.auth_tag,
      authRes.tempToken,
      sessionId
    );

    const text = decrypted.toString('utf8');
    expect(text).toContain('TOP SECRET // CONFIDENTIAL DEFENSE INTEL');
  });

  it('2. Revoking asset access immediately updates store and blocks decryption', async () => {
    // Revoke access
    await revokeAssetAccess('usr_admin_001', vasuId, assetId);

    // Verify in store
    const assetsAfterRevoke = deviceStore.getAssetsForUser(vasuId);
    const revokedAsset = assetsAfterRevoke.find(a => a.asset.id === assetId);
    expect(revokedAsset?.can_decrypt).toBe(false);
    expect(revokedAsset?.status).toBe('REVOKED');

    // Verify authorizeAssetAccess fails
    await expect(authorizeAssetAccess(vasuId, assetId, sessionId, deviceId)).rejects.toThrow(
      'Access Denied'
    );
  });

  it('3. Granting clearance restores decryption capability', async () => {
    // Grant clearance
    deviceStore.setAssignment(assetId, vasuId, true, true);

    const assetsAfterGrant = deviceStore.getAssetsForUser(vasuId);
    const grantedAsset = assetsAfterGrant.find(a => a.asset.id === assetId);
    expect(grantedAsset?.can_decrypt).toBe(true);
    expect(grantedAsset?.status).toBe('ACTIVE');

    // Decryption works again
    const authRes = await authorizeAssetAccess(vasuId, assetId, sessionId, deviceId);
    expect(authRes.authorized).toBe(true);

    const asset = deviceStore.assets.get(assetId)!;
    const encryptedBuffer = Buffer.from(asset.encrypted_content, 'base64');
    const decrypted = await executeDecryption(
      assetId,
      encryptedBuffer,
      asset.iv,
      asset.auth_tag,
      authRes.tempToken,
      sessionId
    );

    expect(decrypted.toString('utf8')).toContain('TOP SECRET // CONFIDENTIAL DEFENSE INTEL');
  });

  it('4. Admin can approve access request and revoke live grant end-to-end', async () => {
    const { approveAccessRequestAction, revokeLiveGrantAction, submitAccessRequestAction } = await import('../../src/app/actions/accessRequests');

    // 1. Submit request
    const submitRes = await submitAccessRequestAction({
      assetId,
      reason: 'Operational mission inspection',
      ttlMinutes: 45,
    });
    expect(submitRes.success).toBe(true);
    expect(submitRes.request).toBeDefined();
    const requestId = submitRes.request!.id;

    // 2. Approve request as Admin
    const approveRes = await approveAccessRequestAction({ requestId, ttlMinutes: 45 });
    expect(approveRes.success).toBe(true);
    expect(approveRes.request?.status).toBe('APPROVED');
    expect(approveRes.grant).toBeDefined();
    expect(approveRes.grant?.status).toBe('ACTIVE');
    const grantId = approveRes.grant!.id;

    // 3. Verify user can decrypt
    const authRes = await authorizeAssetAccess(vasuId, assetId, sessionId, deviceId);
    expect(authRes.authorized).toBe(true);

    // 4. Revoke live grant
    const revokeRes = await revokeLiveGrantAction({ grantId });
    expect(revokeRes.success).toBe(true);
    expect(revokeRes.grant?.status).toBe('REVOKED');

    // 5. Verify user can no longer decrypt
    await expect(authorizeAssetAccess(vasuId, assetId, sessionId, deviceId)).rejects.toThrow(
      'Access Denied'
    );
  });

  it('5. Admin can deny access requests and state transitions to REJECTED', async () => {
    const { rejectAccessRequestAction, submitAccessRequestAction } = await import('../../src/app/actions/accessRequests');

    const submitRes = await submitAccessRequestAction({
      assetId,
      reason: 'Audit inspection for compliance',
      ttlMinutes: 20,
    });
    expect(submitRes.success).toBe(true);
    const requestId = submitRes.request!.id;

    const denyRes = await rejectAccessRequestAction({
      requestId,
      reason: 'Unauthorized classification boundary',
    });
    expect(denyRes.success).toBe(true);
    expect(denyRes.request?.status).toBe('REJECTED');
    expect(denyRes.request?.rejected_reason).toBe('Unauthorized classification boundary');

    // Verify in store
    const inStore = deviceStore.getAccessRequests().find(r => r.id === requestId);
    expect(inStore?.status).toBe('REJECTED');
  });

  it('6. Seeded requests (Arjun Verma, Neha Iyer, Vasu) approve and deny successfully', async () => {
    const { approveAccessRequestAction, rejectAccessRequestAction } = await import('../../src/app/actions/accessRequests');

    // Approve Arjun Verma (req-1)
    const approveArjun = await approveAccessRequestAction({ requestId: 'req-1', ttlMinutes: 30 });
    expect(approveArjun.success).toBe(true);
    expect(approveArjun.request?.status).toBe('APPROVED');
    expect(approveArjun.grant?.assetCode).toBe('SMX-FIN-002');

    // Deny Neha Iyer (req-2)
    const denyNeha = await rejectAccessRequestAction({ requestId: 'req-2', reason: 'Policy restriction' });
    expect(denyNeha.success).toBe(true);
    expect(denyNeha.request?.status).toBe('REJECTED');

    // Approve Vasu (req_001)
    const approveVasu = await approveAccessRequestAction({ requestId: 'req_001', ttlMinutes: 45 });
    expect(approveVasu.success).toBe(true);
    expect(approveVasu.request?.status).toBe('APPROVED');
  });

  it('7. Robust handling for edge cases: non-existent requests or already revoked grants', async () => {
    const { approveAccessRequestAction, rejectAccessRequestAction, revokeLiveGrantAction } = await import('../../src/app/actions/accessRequests');

    // Approving non-existent request creates auto-approved record instead of fatal failure
    const nonExistentApprove = await approveAccessRequestAction({ requestId: 'req-unknown-999', ttlMinutes: 15 });
    expect(nonExistentApprove.success).toBe(true);
    expect(nonExistentApprove.request?.status).toBe('APPROVED');

    // Denying non-existent request creates auto-rejected record instead of fatal failure
    const nonExistentDeny = await rejectAccessRequestAction({ requestId: 'req-unknown-888', reason: 'Boundary restriction' });
    expect(nonExistentDeny.success).toBe(true);
    expect(nonExistentDeny.request?.status).toBe('REJECTED');

    // Revoking already revoked or unknown grant is idempotent and succeeds
    const revokeUnknown = await revokeLiveGrantAction({ grantId: 'grant-nonexistent-777' });
    expect(revokeUnknown.success).toBe(true);
  });
});
