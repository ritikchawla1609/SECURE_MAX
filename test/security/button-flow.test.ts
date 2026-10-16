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
});
