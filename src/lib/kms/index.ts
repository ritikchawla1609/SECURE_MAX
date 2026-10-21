import 'server-only';
import { deriveKEK, generateDEK, encryptData, decryptData } from '../crypto';
import { supabaseAdmin } from '../db/client';
import { SignJWT, jwtVerify } from 'jose';
import crypto from 'crypto';
import { getValidatedMasterKeyHex, getValidatedJwtSecret } from '../config/secrets';
import { redeemTokenAtomically } from './redemption';

export { 
  redeemTokenAtomically, 
  isTokenRedeemed, 
  clearRedemptionsForTesting,
  setDbSimulatedFailureForTesting 
} from './redemption';

// ==========================================
// KMS Envelope Encryption Lifecycle
// ==========================================

export async function createAssetKey(assetId: string): Promise<{ dekPlaintext: Buffer; keyId: string; versionId: string }> {
  const masterKey = getValidatedMasterKeyHex();

  // 1. Generate new DEK (256-bit cryptographically secure random bytes)
  const dek = generateDEK();

  // 2. Derive Asset-Specific KEK via PBKDF2 context binding
  const kek = deriveKEK(masterKey, assetId);

  // 3. Encrypt DEK using KEK with context-bound AAD
  const aad = `key_wrapping:${assetId}`;
  const encryptedPayload = encryptData(dek, kek, aad);
  const packedDek = JSON.stringify({
    cipher: encryptedPayload.ciphertext,
    auth: encryptedPayload.authTag,
  });

  // 4. Store in Database via Admin Client (Bypassing RLS safely)
  const { data: keyRecord, error: keyErr } = await supabaseAdmin
    .from('encryption_keys')
    .insert({ asset_id: assetId, algorithm: 'aes-256-gcm' })
    .select('id')
    .single();
    
  if (keyErr || !keyRecord) throw new Error('KMS: Failed to create key record');

  const { data: versionRecord, error: verErr } = await supabaseAdmin
    .from('key_versions')
    .insert({
      key_id: keyRecord.id,
      version_number: 1,
      encrypted_dek: packedDek,
      dek_iv: encryptedPayload.iv,
      status: 'ACTIVE'
    })
    .select('id')
    .single();

  if (verErr || !versionRecord) throw new Error('KMS: Failed to create key version');

  return { dekPlaintext: dek, keyId: keyRecord.id, versionId: versionRecord.id };
}

// ==========================================
// KMS Controlled Key Release & Enforcement Boundary
// ==========================================

export interface KeyReleaseAuthEvidence {
  token: string;
  sessionId?: string;
  clientIp?: string;
  authId?: string;
  tenantId?: string;
}

export async function fetchAndDecryptDEK(
  assetId: string,
  authEvidence?: KeyReleaseAuthEvidence | string
): Promise<Buffer> {
  const masterKey = getValidatedMasterKeyHex();

  // =========================================================================
  // Cryptographic Enforcement Boundary: Independent Authorization Validation
  // =========================================================================
  if (!authEvidence) {
    throw new Error('KMS Cryptographic Enforcement Boundary Violation: Controlled key release requires verified authorization evidence.');
  }

  const token = typeof authEvidence === 'string' ? authEvidence : authEvidence.token;
  const expectedSessionId = typeof authEvidence === 'object' ? authEvidence.sessionId : undefined;
  const clientIp = typeof authEvidence === 'object' ? authEvidence.clientIp : '0.0.0.0';
  const explicitAuthId = typeof authEvidence === 'object' ? authEvidence.authId : undefined;
  const expectedTenantId = typeof authEvidence === 'object' ? authEvidence.tenantId : undefined;

  if (!token) {
    throw new Error('KMS Cryptographic Enforcement Boundary Violation: Missing cryptographic authorization token.');
  }

  // 1. Cryptographically validate the temporary token against this asset context
  const validatedPayload = await validateTemporaryDecryptionToken(
    token,
    expectedSessionId,
    assetId,
    clientIp,
    expectedTenantId
  );

  const activeSessionId = expectedSessionId || validatedPayload.sessionId;
  const effectiveJti = validatedPayload.jti || (validatedPayload as any).jwtId || crypto.createHash('sha256').update(token).digest('hex');

  // 2. Atomic One-Time Redemption (Replay Protection)
  await redeemTokenAtomically(
    effectiveJti,
    assetId,
    activeSessionId,
    validatedPayload.userId
  );

  // 3. Live Zero-Trust Session & Revocation Check
  if (activeSessionId) {
    try {
      const { deviceStore } = await import('../auth/deviceStore');
      const storedSession = deviceStore.getSession(activeSessionId);
      if (storedSession && storedSession.status === 'REVOKED') {
        throw new Error('KMS Cryptographic Enforcement Boundary: Session has been revoked in zero-trust device store.');
      }
    } catch (storeErr: any) {
      if (storeErr.message?.includes('revoked') || storeErr.message?.includes('Enforcement Boundary')) throw storeErr;
    }

    try {
      const { data: sessionData } = await supabaseAdmin
        .from('access_sessions')
        .select('status')
        .eq('id', activeSessionId)
        .single();

      if (sessionData && sessionData.status === 'REVOKED') {
        throw new Error('KMS Cryptographic Enforcement Boundary: Session has been revoked.');
      }
    } catch (dbErr: any) {
      if (dbErr.message?.includes('revoked') || dbErr.message?.includes('Enforcement Boundary')) throw dbErr;
    }
  }

  // 4. Blockchain Authorization Evidence Validation (Chain-2)
  try {
    const { verifyChain2Policy, verifyDecryptionAuth } = await import('../blockchain/oracle');
    const chain2Policy = await verifyChain2Policy(assetId, activeSessionId);
    if (!chain2Policy.allowed && chain2Policy.status === 'DENIED') {
      throw new Error(`KMS Cryptographic Enforcement Boundary: Chain-2 Key Lifecycle rejected release: ${chain2Policy.reason}`);
    }

    const effectiveAuthId = explicitAuthId || (validatedPayload as any).authId;
    if (effectiveAuthId) {
      const authResult = await verifyDecryptionAuth(effectiveAuthId, assetId, validatedPayload.userId);
      if (!authResult.allowed && authResult.status === 'DENIED') {
        throw new Error(`KMS Cryptographic Enforcement Boundary: Chain-2 DecryptionAuth rejected release: ${authResult.reason}`);
      }
    }
  } catch (oracleErr: any) {
    if (oracleErr.message?.includes('Enforcement Boundary')) throw oracleErr;
  }

  // =========================================================================
  // Unwrapping DEK inside isolated KMS boundary
  // =========================================================================
  let unwrappedDek: Buffer | null = null;

  try {
    // Retrieve the ACTIVE key version from database
    const { data: keyRecord, error: keyErr } = await supabaseAdmin
      .from('encryption_keys')
      .select('id, key_versions(encrypted_dek, dek_iv, status)')
      .eq('asset_id', assetId)
      .single();

    if (!keyErr && keyRecord && keyRecord.key_versions) {
      const activeVersion = Array.isArray(keyRecord.key_versions) 
        ? keyRecord.key_versions.find((v: any) => v.status === 'ACTIVE')
        : (keyRecord.key_versions as any).status === 'ACTIVE' ? keyRecord.key_versions : null;

      if (activeVersion) {
        const packedDek = JSON.parse(activeVersion.encrypted_dek);
        const kek = deriveKEK(masterKey, assetId);
        const aad = `key_wrapping:${assetId}`;
        try {
          unwrappedDek = decryptData(packedDek.cipher, kek, activeVersion.dek_iv, packedDek.auth, aad);
        } catch (decryptErr) {
          console.warn(`[KMS] Failed to decrypt DEK from Supabase for ${assetId}:`, decryptErr);
        }
      }
    }
  } catch (dbErr) {
    // Supabase unavailable or table empty; fall through to store fallback
  }

  if (!unwrappedDek) {
    // Fallback: Check in-memory store for local/standalone KMS operation
    const { deviceStore } = await import('../auth/deviceStore');
    const wrapped = deviceStore.getWrappedDEK(assetId);
    if (wrapped) {
      const aad = `key_wrapping:${assetId}`;
      const kek = deriveKEK(masterKey, assetId);
      // Explicitly decrypt without any insecure fallback keys
      unwrappedDek = decryptData(wrapped.cipher, kek, wrapped.iv, wrapped.authTag, aad);
    }
  }

  if (!unwrappedDek) {
    throw new Error('KMS Error: No ACTIVE key version found for asset or key unwrapping integrity failed.');
  }

  return unwrappedDek;
}

// ==========================================
// KMS Temporary Authorization Token Handling
// ==========================================

export interface TempAuthPayload {
  userId: string;
  assetId: string;
  sessionId: string;
  permissions?: string[];
  clientIp?: string;
  authId?: string;
  bindingHash?: string;
  tenantId?: string;
  keyVersionId?: string;
  operation?: string;
  jti?: string;
  policyVersion?: string;
  sub?: string;
}

export async function issueTemporaryDecryptionToken(payload: TempAuthPayload): Promise<string> {
  const jwtSecret = getValidatedJwtSecret();
  const jti = payload.jti || crypto.randomUUID();
  const tenantId = payload.tenantId || 'tenant-default';
  const keyVersionId = payload.keyVersionId || 'v1';
  const policyVersion = payload.policyVersion || '1.0';
  const permissions = payload.permissions || ['can_decrypt'];
  const operation = payload.operation || (permissions.includes('can_decrypt') ? 'decrypt' : 'read');

  // Hash the Session ID + IP Address to cryptographically bind the token to this client session context
  const ipToBind = payload.clientIp || '0.0.0.0';
  const bindingHash = crypto.createHash('sha256').update(`${payload.sessionId}:${ipToBind}`).digest('hex');

  // Short-lived token per architectural zero-trust requirements (15 minutes)
  const token = await new SignJWT({
    sub: payload.userId,
    userId: payload.userId, // backward compatibility
    assetId: payload.assetId,
    tenantId,
    keyVersionId,
    operation,
    sessionId: payload.sessionId,
    jti,
    policyVersion,
    permissions,
    bindingHash,
    authId: payload.authId,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('securemax-kms')
    .setAudience('securemax-vault')
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(jwtSecret);

  return token;
}

export async function validateTemporaryDecryptionToken(
  token: string, 
  expectedSessionId?: string, 
  expectedAssetId?: string, 
  expectedIp: string = '0.0.0.0',
  expectedTenantId?: string,
  options?: {
    expectedUserId?: string;
    expectedKeyVersionId?: string;
    expectedPolicyVersion?: string;
    expectedOperation?: string;
  }
): Promise<TempAuthPayload> {
  try {
    const jwtSecret = getValidatedJwtSecret();
    const { payload, protectedHeader } = await jwtVerify(token, jwtSecret, {
      algorithms: ['HS256'],
    });

    if (protectedHeader.alg !== 'HS256') {
      throw new Error('Algorithm not permitted: Token must use HS256.');
    }
    
    // Validate session binding
    if (expectedSessionId && payload.sessionId !== expectedSessionId) {
      throw new Error('Session binding mismatch: Token was hijacked or replayed in a different context.');
    }
    
    // Validate Cryptographic IP Binding
    const sessionIdForHash = (payload.sessionId as string) || expectedSessionId || '';
    const expectedBindingHash = crypto.createHash('sha256').update(`${sessionIdForHash}:${expectedIp}`).digest('hex');
    if (payload.bindingHash && payload.bindingHash !== expectedBindingHash && expectedIp !== '0.0.0.0') {
      throw new Error('Network binding mismatch: Token was hijacked and replayed from a different IP address.');
    }

    // Validate asset binding
    if (expectedAssetId && payload.assetId !== expectedAssetId) {
      throw new Error('Asset binding mismatch: Token attempting to decrypt unauthorized asset.');
    }

    // Validate tenant binding if present
    if (expectedTenantId && payload.tenantId && payload.tenantId !== expectedTenantId) {
      throw new Error('Tenant binding mismatch: Cross-tenant key access violation.');
    }

    // Validate Issuer and Audience if present
    if (payload.iss && payload.iss !== 'securemax-kms') {
      throw new Error(`Issuer mismatch: Untrusted token issuer ${payload.iss}.`);
    }
    if (payload.aud && payload.aud !== 'securemax-vault') {
      throw new Error(`Audience mismatch: Untrusted token audience ${payload.aud}.`);
    }

    // Validate User binding if requested
    if (options?.expectedUserId) {
      const tokenUser = payload.sub || payload.userId;
      if (tokenUser !== options.expectedUserId) {
        throw new Error('User binding mismatch: Token was issued for a different user.');
      }
    }

    // Validate Key Version binding if requested
    if (options?.expectedKeyVersionId && payload.keyVersionId && payload.keyVersionId !== options.expectedKeyVersionId) {
      throw new Error('Key version mismatch: Token bound to different key version.');
    }

    // Validate Policy Version binding if requested
    if (options?.expectedPolicyVersion && payload.policyVersion && payload.policyVersion !== options.expectedPolicyVersion) {
      throw new Error('Policy version mismatch: Token issued under obsolete policy version.');
    }

    // Validate Operation if requested
    if (options?.expectedOperation && payload.operation && payload.operation !== options.expectedOperation) {
      throw new Error('Operation mismatch: Token does not authorize requested operation.');
    }

    // Validate operation permission
    const permissions = payload.permissions as string[] | undefined;
    const hasDecryptPerm = permissions ? permissions.includes('can_decrypt') : payload.operation === 'decrypt';
    if (!hasDecryptPerm) {
      throw new Error('Permission mismatch: Token lacks decrypt authority.');
    }

    const result: TempAuthPayload = {
      userId: (payload.sub || payload.userId) as string,
      sub: payload.sub as string,
      assetId: payload.assetId as string,
      sessionId: payload.sessionId as string,
      permissions: payload.permissions as string[],
      clientIp: payload.clientIp as string,
      authId: payload.authId as string,
      bindingHash: payload.bindingHash as string,
      tenantId: payload.tenantId as string,
      keyVersionId: payload.keyVersionId as string,
      operation: payload.operation as string,
      jti: payload.jti as string,
      policyVersion: payload.policyVersion as string,
    };

    return result;
  } catch (error: any) {
    throw new Error(`Token validation failed: ${error.message}`);
  }
}
