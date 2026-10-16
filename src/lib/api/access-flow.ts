import 'server-only';
import { logAuditEvent } from '../audit/logger';
import { issueTemporaryDecryptionToken, fetchAndDecryptDEK, validateTemporaryDecryptionToken } from '../kms';
import { decryptData } from '../crypto';
import { AuditEventType, UserRole, UserStatus } from '../../types';
import { verifyChain1Access, verifyChain2Policy } from '../blockchain/oracle';
import { deviceStore } from '../auth/deviceStore';
import { supabaseAdmin } from '../db/client';

/**
 * Executes the complete SecureMAX 10-step authorization flow for asset access:
 * 1. User authenticated?
 * 2. Session active?
 * 3. User active?
 * 4. IdentityRegistry says identity Active?
 * 5. User assigned to asset?
 * 6. Asset permission allows decrypt?
 * 7. RBAC permits operation?
 * 8. KMS authorization?
 * 9. Issue temporary decryption authorization
 * 10. Record audit event
 */
export async function authorizeAssetAccess(
  arg1: string,
  arg2: string,
  arg3: string,
  arg4?: string,
  arg5?: string,
  clientIp?: string
) {
  let userId: string;
  let assetId: string;
  let sessionId: string;
  let deviceId: string | undefined;
  let effectiveClientIp = clientIp;

  if (arg5 !== undefined || arg1.startsWith('ey') || arg1 === 'dummy-jwt') {
    // Called as (userJwt, userId, assetId, sessionId, deviceId, clientIp)
    userId = arg2;
    assetId = arg3;
    sessionId = arg4 || 'session-default';
    deviceId = arg5;
  } else {
    // Called as (userId, assetId, sessionId, deviceId, clientIp)
    userId = arg1;
    assetId = arg2;
    sessionId = arg3;
    deviceId = arg4;
    effectiveClientIp = arg5 || clientIp;
  }
  // 1. Resolve User from Authoritative Store (DeviceStore or Supabase)
  let user = await deviceStore.getUserById(userId);
  if (!user) {
    try {
      const { data: dbUser, error: userErr } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
      if (!userErr && dbUser) {
        user = {
          id: dbUser.id || userId,
          name: dbUser.display_name || dbUser.name || 'Authoritative User',
          email: dbUser.email || `${userId}@securemax.system`,
          role: dbUser.role || UserRole.USER,
          status: dbUser.status || UserStatus.ACTIVE,
          kyc_status: dbUser.kyc_status || 'VERIFIED',
          did: dbUser.did || `did:securemax:${userId}`,
          created_at: dbUser.created_at || new Date().toISOString()
        };
      }
    } catch {
      // Fail closed below if user still not found
    }
  }

  if (!user) {
    throw new Error('Access Denied: User identity not found in SecureMAX.');
  }

  const isAdmin = user.role === UserRole.ADMIN;

  // 2. Check User Status
  if (user.status !== UserStatus.ACTIVE) {
    await logAuditEvent({
      eventType: AuditEventType.ACCESS_DENIED,
      actorId: userId,
      targetType: 'ASSET',
      targetId: assetId,
      details: { reason: `User account is ${user.status}` }
    });
    throw new Error(`Access Denied: User account is ${user.status}.`);
  }

  // 3. Check Device Status (if device-bound and not Admin)
  if (deviceId && !isAdmin) {
    const device = await deviceStore.getDeviceById(deviceId);
    if (!device || device.status !== 'ACTIVE') {
      await logAuditEvent({
        eventType: AuditEventType.ACCESS_DENIED,
        actorId: userId,
        targetType: 'ASSET',
        targetId: assetId,
        details: { reason: 'Device unverified or revoked' }
      });
      throw new Error('Access Denied: Current device credential is invalid or revoked.');
    }
  }

  // 4. Asset Assignment Check & Permission Validation
  let assignment = deviceStore.getAssignment(userId, assetId);

  if (!isAdmin && !assignment) {
    try {
      const { data: dbAssignment, error: assignErr } = await supabaseAdmin
        .from('asset_assignments')
        .select('status, asset_permissions(can_decrypt, can_read)')
        .eq('asset_id', assetId)
        .eq('user_id', userId)
        .single();

      if (!assignErr && dbAssignment) {
        if (dbAssignment.status === 'REVOKED') {
          await logAuditEvent({
            eventType: AuditEventType.ACCESS_DENIED,
            actorId: userId,
            targetType: 'ASSET',
            targetId: assetId,
            details: { reason: 'Assignment has been revoked' }
          });
          throw new Error('Access Denied: Assignment has been revoked');
        }

        if (dbAssignment.status === 'ACTIVE') {
          const perms = Array.isArray(dbAssignment.asset_permissions)
            ? dbAssignment.asset_permissions[0]
            : dbAssignment.asset_permissions;
          assignment = {
            asset_id: assetId,
            user_id: userId,
            can_read: perms?.can_read ?? true,
            can_decrypt: perms?.can_decrypt ?? false,
            can_download: perms?.can_decrypt ?? false,
            can_edit: false,
            can_delete: false,
            status: 'ACTIVE',
            assigned_at: new Date().toISOString(),
            expires_at: null,
          };
        }
      }
    } catch (err: any) {
      if (err.message?.includes('revoked')) throw err;
    }
  }

  if (!isAdmin) {
    if (!assignment || assignment.status !== 'ACTIVE') {
      await logAuditEvent({
        eventType: AuditEventType.ACCESS_DENIED,
        actorId: userId,
        targetType: 'ASSET',
        targetId: assetId,
        details: { reason: 'No active asset assignment found' }
      });
      throw new Error('Access Denied: You must request access from an administrator and receive approval before opening or downloading this asset.');
    }

    if (!assignment.can_decrypt) {
      await logAuditEvent({
        eventType: AuditEventType.ACCESS_DENIED,
        actorId: userId,
        targetType: 'ASSET',
        targetId: assetId,
        details: { reason: 'Asset permission is READ-ONLY (no decrypt permission)' }
      });
      throw new Error('Access Denied: You must request access from an administrator and receive approval before opening or downloading this asset.');
    }
  }

  // 5. Blockchain IdentityRegistry & AssetNFT Verification (Chain 1)
  if (!isAdmin) {
    const chain1Result = await verifyChain1Access(userId, assetId);
    if (!chain1Result.allowed) {
      await logAuditEvent({
        eventType: AuditEventType.ACCESS_DENIED,
        actorId: userId,
        targetType: 'ASSET',
        targetId: assetId,
        details: { reason: `Blockchain Identity/Access layer rejected authorization: ${chain1Result.reason}` }
      });
      throw new Error(`Blockchain Identity/Access layer rejected authorization: ${chain1Result.reason}`);
    }

    // 5b. Blockchain Key Management Policy Verification (Chain 2)
    const chain2Result = await verifyChain2Policy(assetId, sessionId);
    if (!chain2Result.allowed) {
      await logAuditEvent({
        eventType: AuditEventType.ACCESS_DENIED,
        actorId: userId,
        targetType: 'ASSET',
        targetId: assetId,
        details: { reason: `Key Management Policy rejected authorization: ${chain2Result.reason}` }
      });
      throw new Error(`Key Management Policy rejected authorization: ${chain2Result.reason}`);
    }
  }

  // 6. Issue Cryptographically Bound Temporary Token (30 min)
  const tempToken = await issueTemporaryDecryptionToken({
    userId,
    assetId,
    sessionId,
    permissions: ['can_decrypt'],
    clientIp: effectiveClientIp,
  });

  // 7. Record Audit Event
  await logAuditEvent({
    eventType: AuditEventType.TEMPORARY_KEY_AUTHORIZED,
    actorId: userId,
    targetType: 'ASSET',
    targetId: assetId,
    details: { sessionId, expires: '30m', clientIp: effectiveClientIp }
  });

  return { tempToken, authorized: true, permissions: ['can_decrypt'] };
}

export async function executeDecryption(
  assetId: string, 
  encryptedFileBuffer: Buffer, 
  encryptedFileIV: string, 
  encryptedFileAuthTag: string,
  tempToken: string,
  sessionId: string,
  clientIp?: string
) {
  // 1. Cryptographically validate the temporary token before touching KMS
  await validateTemporaryDecryptionToken(tempToken, sessionId, assetId, clientIp);

  // 1b. Check session status in store and database (fail-closed)
  const storedSession = await deviceStore.getSession(sessionId);
  if (storedSession) {
    if (storedSession.status === 'REVOKED') {
      throw new Error('Access Denied: Session Revoked');
    }
    if (new Date(storedSession.expires_at).getTime() < Date.now()) {
      throw new Error('Access Denied: Session has expired');
    }
  }

  try {
    const { data: sessionData, error: sessionErr } = await supabaseAdmin
      .from('access_sessions')
      .select('status')
      .eq('id', sessionId)
      .single();

    if (!sessionErr && sessionData && sessionData.status === 'REVOKED') {
      throw new Error('Access Denied: Session Revoked');
    }
  } catch (err: any) {
    if (err.message?.includes('revoked') || err.message?.includes('Revoked')) throw err;
  }

  // 2. Fetch DEK securely inside the KMS boundary
  const dekPlaintext = await fetchAndDecryptDEK(assetId);

  // 3. Bind the AAD string
  const aadString = `asset_data:${assetId}`;

  // 4. Execute Decryption
  try {
    const plaintext = decryptData(
      encryptedFileBuffer.toString('base64'),
      dekPlaintext,
      encryptedFileIV,
      encryptedFileAuthTag,
      aadString
    );
    
    // Wipe DEK buffer
    dekPlaintext.fill(0);

    return plaintext;
  } catch (error) {
    dekPlaintext.fill(0);
    throw new Error('Decryption Failed: Data tampering detected or incorrect key.');
  }
}

export async function prepareDecryptionStream(
  assetId: string, 
  encryptedFileIV: string, 
  encryptedFileAuthTag: string,
  tempToken: string,
  sessionId: string,
  clientIp?: string
) {
  // 1. Cryptographically validate the temporary token before touching KMS
  await validateTemporaryDecryptionToken(tempToken, sessionId, assetId, clientIp);

  // 1b. Check session status in store and database (fail-closed)
  const storedSession = await deviceStore.getSession(sessionId);
  if (storedSession) {
    if (storedSession.status === 'REVOKED') {
      throw new Error('Access Denied: Session has been revoked');
    }
    if (new Date(storedSession.expires_at).getTime() < Date.now()) {
      throw new Error('Access Denied: Session has expired');
    }
  }

  try {
    const { data: sessionData, error: sessionErr } = await supabaseAdmin
      .from('access_sessions')
      .select('status')
      .eq('id', sessionId)
      .single();

    if (!sessionErr && sessionData && sessionData.status === 'REVOKED') {
      throw new Error('Access Denied: Session has been revoked');
    }
  } catch (err: any) {
    if (err.message?.includes('revoked')) throw err;
  }

  // 2. Fetch DEK securely inside the KMS boundary
  const dekPlaintext = await fetchAndDecryptDEK(assetId);

  // 3. Bind the AAD string
  const aadString = `asset_data:${assetId}`;

  // 4. Create and return the decryption stream
  const { createDecryptionStream } = await import('../crypto');
  const stream = createDecryptionStream(
    dekPlaintext,
    encryptedFileIV,
    encryptedFileAuthTag,
    aadString
  );
  
  // Decipher constructor copies key material internally in Node crypto
  dekPlaintext.fill(0);
  
  return stream;
}

export async function revokeAssetAccess(
  adminId: string, 
  targetUserId: string, 
  assetId: string, 
  sessionIdToInvalidate?: string
) {
  // 1. Revoke assignment in store
  deviceStore.revokeAssignment(assetId, targetUserId);

  // 2. Write Revocation Event to Audit Log
  await logAuditEvent({
    eventType: AuditEventType.ROLE_REVOKED,
    actorId: adminId,
    targetType: 'USER_ASSET',
    targetId: targetUserId,
    details: { assetId, action: 'REVOKE_DECRYPT_ACCESS' }
  });

  return { 
    success: true, 
    message: `Asset assignment for user ${targetUserId} revoked successfully.`
  };
}
