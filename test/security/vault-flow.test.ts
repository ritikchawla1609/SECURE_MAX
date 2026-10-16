import { describe, it, expect, vi, beforeAll } from 'vitest';

vi.mock('server-only', () => ({}));

import { deviceStore } from '../../src/lib/auth/deviceStore';
import { authorizeAssetAccess, executeDecryption } from '../../src/lib/api/access-flow';

describe('Secure Data Vault Core Features & Lifecycle Flow', () => {
  beforeAll(() => {
    deviceStore.seedTestDataForTesting();
  });

  const adminId = 'usr_admin_001';
  const vasuId = 'usr_vasu_002';
  const auditorId = 'usr_auditor_003';
  const sessionId = 'test-session-vault';
  const deviceId = 'dev_vasu_laptop';

  it('1. Pre-seeded assets span all 5 folders with rich metadata', () => {
    const assets = Array.from(deviceStore.assets.values());
    expect(assets.length).toBeGreaterThanOrEqual(10);

    const folders = new Set(assets.map(a => a.folder));
    expect(folders.has('Projects')).toBe(true);
    expect(folders.has('Finance')).toBe(true);
    expect(folders.has('HR')).toBe(true);
    expect(folders.has('Engineering')).toBe(true);
    expect(folders.has('Legal')).toBe(true);

    // Each asset has blockchain token ID, contract, and DID
    for (const asset of assets) {
      expect(asset.blockchain_token_id).toMatch(/^NFT-SEPOLIA-#/);
      expect(asset.blockchain_contract).toBe('0xC5388f457D01cdF25B4A29f0A38d65f4e690bC2B');
      expect(asset.did).toContain('did:securemax:asset:');
    }
  });

  it('2. Upload & Encrypt asset generates DEK, wraps with KEK, and registers asset', () => {
    const newAsset = deviceStore.createAsset({
      name: 'Special_Ops_Directive.pdf',
      folder: 'Projects',
      classification: 'CONFIDENTIAL',
      description: 'Tactical deployment parameters for northern sector',
      plaintext: 'CONFIDENTIAL DIRECTIVE: Deployment commencing at 0400 hours with encrypted telemetry.',
      ownerId: vasuId,
      ownerName: 'Vasu (Lead Engineer)',
    });

    expect(newAsset.id).toBeDefined();
    expect(newAsset.asset_code).toMatch(/^SMX-PRO-/);
    expect(newAsset.folder).toBe('Projects');
    expect(newAsset.classification).toBe('CONFIDENTIAL');
    expect(newAsset.encrypted_content).toBeDefined();
    expect(deviceStore.getWrappedDEK(newAsset.id)).toBeDefined();

    // Owner gets full permissions
    const assignment = deviceStore.getAssignment(vasuId, newAsset.id);
    expect(assignment?.can_read).toBe(true);
    expect(assignment?.can_decrypt).toBe(true);
    expect(assignment?.can_download).toBe(true);
    expect(assignment?.can_edit).toBe(true);
    expect(assignment?.can_delete).toBe(true);
  });

  it('3. Controlled sharing with granular permissions and expiring access', () => {
    // Vasu shares Project Alpha with Auditor, expiring in 7 days
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    const assignment = deviceStore.shareAsset({
      assetId: 'ast_alpha',
      targetUserId: auditorId,
      callerUserId: vasuId,
      canRead: true,
      canDecrypt: true,
      canDownload: false,
      canEdit: false,
      canDelete: false,
      expiresAt,
    });

    expect(assignment.user_id).toBe(auditorId);
    expect(assignment.can_decrypt).toBe(true);
    expect(assignment.can_download).toBe(false);
    expect(assignment.expires_at).toBe(expiresAt);

    // Verify through getAssetsForUser
    const auditorAssets = deviceStore.getAssetsForUser(auditorId);
    const alpha = auditorAssets.find(a => a.asset.id === 'ast_alpha');
    expect(alpha?.can_decrypt).toBe(true);
    expect(alpha?.can_download).toBe(false);
    expect(alpha?.status).toBe('ACTIVE');
  });

  it('4. Expired access is strictly enforced by store and authorization flow', async () => {
    // KMS Module (ast_kms) was seeded with past expiration for Vasu
    const vasuAssets = deviceStore.getAssetsForUser(vasuId);
    const kmsAsset = vasuAssets.find(a => a.asset.id === 'ast_kms');
    expect(kmsAsset?.status).toBe('EXPIRED');
    expect(kmsAsset?.can_decrypt).toBe(false);

    // Attempting to authorize decryption throws Access Denied
    await expect(authorizeAssetAccess(vasuId, 'ast_kms', sessionId, deviceId)).rejects.toThrow(
      'Access Denied'
    );
  });

  it('5. Rename, move folder, and delete operations work with permission check', () => {
    // Create temporary asset to test operations
    const tempAsset = deviceStore.createAsset({
      name: 'Temporary_File.txt',
      folder: 'HR',
      classification: 'INTERNAL',
      description: 'Temporary note',
      plaintext: 'Temporary data to be renamed and deleted',
      ownerId: vasuId,
      ownerName: 'Vasu (Lead Engineer)',
    });

    // Rename
    const renamed = deviceStore.renameAsset(tempAsset.id, 'Renamed_File.txt', vasuId);
    expect(renamed.name).toBe('Renamed_File.txt');
    expect(renamed.versions.length).toBe(2);

    // Move folder
    const moved = deviceStore.moveAssetFolder(tempAsset.id, 'Legal', vasuId);
    expect(moved.folder).toBe('Legal');

    // Delete
    deviceStore.deleteAsset(tempAsset.id, vasuId);
    expect(deviceStore.assets.get(tempAsset.id)).toBeUndefined();
    expect(deviceStore.getWrappedDEK(tempAsset.id)).toBeUndefined();
  });

  it('6. Access history logging records events properly', () => {
    deviceStore.recordAssetAccess('ast_alpha', vasuId, 'DECRYPT', 'SUCCESS', 'Test audit log entry');
    const asset = deviceStore.assets.get('ast_alpha')!;
    const latestLog = asset.access_history[0];
    expect(latestLog.action).toBe('DECRYPT');
    expect(latestLog.status).toBe('SUCCESS');
    expect(latestLog.details).toBe('Test audit log entry');
  });

  it('7. Strict access isolation: User only receives owned data, assigned data, or org-wide data', () => {
    // Auditor creates a private asset
    const auditorPrivate = deviceStore.createAsset({
      name: 'Auditor_Confidential_Log.txt',
      folder: 'Finance',
      classification: 'RESTRICTED',
      description: 'Private financial audit log',
      plaintext: 'Confidential ledger anomalies identified.',
      ownerId: auditorId,
      ownerName: 'Security Auditor',
      shareScope: 'PRIVATE',
    });

    expect(auditorPrivate.owner_id).toBe(auditorId);
    expect(auditorPrivate.shared_with_all).toBe(false);

    // Vasu requests his vault
    const vasuVault = deviceStore.getAssetsForUser(vasuId, { scope: 'MY_DATA' });
    const foundInVasuVault = vasuVault.find(item => item.asset.id === auditorPrivate.id);
    expect(foundInVasuVault).toBeUndefined(); // Vasu CANNOT see auditor's private asset!

    // Auditor requests their vault
    const auditorVault = deviceStore.getAssetsForUser(auditorId, { scope: 'MY_DATA' });
    const foundInAuditorVault = auditorVault.find(item => item.asset.id === auditorPrivate.id);
    expect(foundInAuditorVault).toBeDefined();
    expect(foundInAuditorVault?.is_owner).toBe(true);
    expect(foundInAuditorVault?.sharing_scope).toBe('PRIVATE');
  });

  it('8. Sharing with ALL (Org-Wide) makes data accessible to all users', () => {
    const orgAsset = deviceStore.createAsset({
      name: 'Company_All_Hands_Notice.pdf',
      folder: 'HR',
      classification: 'INTERNAL',
      description: 'Company-wide quarterly meeting announcement',
      plaintext: 'All-Hands meeting scheduled for Friday 1000 UTC.',
      ownerId: vasuId,
      ownerName: 'Vasu (Lead Engineer)',
      shareScope: 'ALL_PEOPLE',
      canDecryptShared: true,
      canDownloadShared: true,
    });

    expect(orgAsset.shared_with_all).toBe(true);

    // Verify Auditor can see and decrypt it
    const auditorVault = deviceStore.getAssetsForUser(auditorId, { scope: 'MY_DATA' });
    const foundInAuditor = auditorVault.find(item => item.asset.id === orgAsset.id);
    expect(foundInAuditor).toBeDefined();
    expect(foundInAuditor?.can_read).toBe(true);
    expect(foundInAuditor?.can_decrypt).toBe(true);
    expect(foundInAuditor?.sharing_scope).toBe('ALL_PEOPLE');

    // Verify getAssignment handles ALL
    const assignment = deviceStore.getAssignment(auditorId, orgAsset.id);
    expect(assignment?.can_read).toBe(true);
    expect(assignment?.can_decrypt).toBe(true);
  });

  it('9. Person-to-person sharing and revoking access', () => {
    // Vasu creates private asset
    const privateDoc = deviceStore.createAsset({
      name: 'Proprietary_Algorithm.py',
      folder: 'Engineering',
      classification: 'CONFIDENTIAL',
      description: 'Core optimization algorithm',
      plaintext: 'def optimize(): return True',
      ownerId: vasuId,
      ownerName: 'Vasu (Lead Engineer)',
      shareScope: 'PRIVATE',
    });

    // Auditor cannot see it yet
    expect(deviceStore.getAssetsForUser(auditorId, { scope: 'MY_DATA' }).some(a => a.asset.id === privateDoc.id)).toBe(false);

    // Vasu shares it with Auditor
    deviceStore.shareAsset({
      assetId: privateDoc.id,
      targetUserId: auditorId,
      callerUserId: vasuId,
      canRead: true,
      canDecrypt: true,
    });

    // Auditor now sees it
    const auditorDoc = deviceStore.getAssetsForUser(auditorId, { scope: 'MY_DATA' }).find(a => a.asset.id === privateDoc.id);
    expect(auditorDoc).toBeDefined();
    expect(auditorDoc?.can_decrypt).toBe(true);

    // Active shares list shows Auditor
    const shares = deviceStore.getSharesForAsset(privateDoc.id);
    expect(shares.some(s => s.userId === auditorId)).toBe(true);

    // Vasu revokes Auditor's share
    deviceStore.revokeAssetShare(privateDoc.id, auditorId, vasuId);

    // Auditor no longer sees it in MY_DATA vault
    expect(deviceStore.getAssetsForUser(auditorId, { scope: 'MY_DATA' }).some(a => a.asset.id === privateDoc.id)).toBe(false);
  });

  it('10. User default access policy persistence', () => {
    // Default is PRIVATE
    expect(deviceStore.getUserDefaultAccessPolicy(vasuId)).toBe('PRIVATE');

    // Change to ORGANIZATION
    deviceStore.setUserDefaultAccessPolicy(vasuId, 'ORGANIZATION');
    expect(deviceStore.getUserDefaultAccessPolicy(vasuId)).toBe('ORGANIZATION');

    // Change back to PRIVATE
    deviceStore.setUserDefaultAccessPolicy(vasuId, 'PRIVATE');
    expect(deviceStore.getUserDefaultAccessPolicy(vasuId)).toBe('PRIVATE');
  });

  it('11. Administrator can decrypt any asset without prior access request or explicit assignment', async () => {
    // Create an unassigned private asset owned by Vasu
    const unassignedAsset = deviceStore.createAsset({
      name: 'Unassigned_Sensitive_Doc.pdf',
      folder: 'Finance',
      classification: 'RESTRICTED',
      description: 'Strictly restricted document with no admin assignment',
      plaintext: 'SUPER SECRET ADMIN BYPASS TEST DATA',
      ownerId: vasuId,
      ownerName: 'Vasu (Lead Engineer)',
      shareScope: 'PRIVATE',
    });

    // Verify Admin has no explicit assignment in assignments array
    const directAssignment = deviceStore.assignments.find(a => a.asset_id === unassignedAsset.id && a.user_id === adminId);
    expect(directAssignment).toBeUndefined();

    // Admin should see it with can_decrypt === true in getAssetsForUser
    const adminAssets = deviceStore.getAssetsForUser(adminId);
    const assetInAdminView = adminAssets.find(a => a.asset.id === unassignedAsset.id);
    expect(assetInAdminView).toBeDefined();
    expect(assetInAdminView?.can_decrypt).toBe(true);

    // Admin can authorize decryption directly without throws
    const authResult = await authorizeAssetAccess(adminId, unassignedAsset.id, 'admin-session');
    expect(authResult.authorized).toBe(true);
    expect(authResult.tempToken).toBeDefined();
  });
});
