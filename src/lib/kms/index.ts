import 'server-only';
import { deriveKEK, generateDEK, encryptData, decryptData } from '../crypto';
import { supabaseAdmin } from '../db/client';
import { SignJWT, jwtVerify } from 'jose';

function getMasterKeyHex(): string {
  return process.env.SECUREMAX_KMS_MASTER_KEY || '0000000000000000000000000000000000000000000000000000000000000000';
}

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'securemax-dev-jwt-secret-minimum-32-chars-long-secure-padding');

// ==========================================
// KMS Envelope Encryption Lifecycle
// ==========================================

export async function createAssetKey(assetId: string): Promise<{ dekPlaintext: Buffer, keyId: string, versionId: string }> {
  const masterKey = getMasterKeyHex();
  if (!masterKey) throw new Error('KMS Master Key not configured');

  // 1. Generate new DEK
  const dek = generateDEK();

  // 2. Derive Asset-Specific KEK
  const kek = deriveKEK(masterKey, assetId);

  // 3. Encrypt DEK using KEK
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
    
  if (keyErr || !keyRecord) throw new Error('Failed to create key record');

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

  if (verErr || !versionRecord) throw new Error('Failed to create key version');

  return { dekPlaintext: dek, keyId: keyRecord.id, versionId: versionRecord.id };
}

export async function fetchAndDecryptDEK(assetId: string): Promise<Buffer> {
  const masterKey = getMasterKeyHex();
  if (!masterKey) throw new Error('KMS Master Key not configured');

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
          return decryptData(packedDek.cipher, kek, activeVersion.dek_iv, packedDek.auth, aad);
        } catch (decryptErr) {
          console.warn(`[KMS] Failed to decrypt DEK from Supabase for ${assetId}, falling back to local store:`, decryptErr);
        }
      }
    }
  } catch (dbErr) {
    // Supabase unavailable or table empty; fall through to store fallback
  }

  // Fallback: Check in-memory store for local/standalone KMS operation
  const { deviceStore } = await import('../auth/deviceStore');
  const wrapped = deviceStore.getWrappedDEK(assetId);
  if (wrapped) {
    const aad = `key_wrapping:${assetId}`;
    try {
      const kek = deriveKEK(masterKey, assetId);
      return decryptData(wrapped.cipher, kek, wrapped.iv, wrapped.authTag, aad);
    } catch (primaryErr) {
      // If primary masterKey fails, try default fallback master key
      const defaultMaster = '0000000000000000000000000000000000000000000000000000000000000000';
      if (masterKey !== defaultMaster) {
        try {
          const fallbackKek = deriveKEK(defaultMaster, assetId);
          return decryptData(wrapped.cipher, fallbackKek, wrapped.iv, wrapped.authTag, aad);
        } catch {}
      }
      throw primaryErr;
    }
  }

  throw new Error('No ACTIVE key version found for asset');
}

// ==========================================
// KMS Temporary Authorization
// ==========================================

export interface TempAuthPayload {
  userId: string;
  assetId: string;
  sessionId: string;
  permissions: string[];
  clientIp?: string; // Add IP binding
}

export async function issueTemporaryDecryptionToken(payload: TempAuthPayload): Promise<string> {
  const crypto = await import('crypto');
  
  // Hash the Session ID + IP Address to cryptographically bind the token to this exact client session context
  const ipToBind = payload.clientIp || '0.0.0.0';
  const bindingHash = crypto.createHash('sha256').update(`${payload.sessionId}:${ipToBind}`).digest('hex');

  // 30 minute time limit per strict architectural constraints
  const token = await new SignJWT({ 
    userId: payload.userId,
    assetId: payload.assetId,
    sessionId: payload.sessionId,
    permissions: payload.permissions,
    bindingHash
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30m')
    .sign(JWT_SECRET);

  return token;
}

export async function validateTemporaryDecryptionToken(token: string, expectedSessionId: string, expectedAssetId: string, expectedIp: string = '0.0.0.0'): Promise<TempAuthPayload> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    
    if (payload.sessionId !== expectedSessionId) {
      throw new Error('Session binding mismatch: Token was hijacked or replayed in a different context.');
    }
    
    // Validate Cryptographic IP Binding
    const crypto = await import('crypto');
    const expectedBindingHash = crypto.createHash('sha256').update(`${expectedSessionId}:${expectedIp}`).digest('hex');
    if (payload.bindingHash && payload.bindingHash !== expectedBindingHash) {
      throw new Error('Network binding mismatch: Token was hijacked and replayed from a different IP address.');
    }

    if (payload.assetId !== expectedAssetId) {
      throw new Error('Asset binding mismatch: Token attempting to decrypt unauthorized asset.');
    }
    if (!(payload.permissions as string[])?.includes('can_decrypt')) {
      throw new Error('Permission mismatch: Token lacks decrypt authority.');
    }

    return payload as unknown as TempAuthPayload;
  } catch (error: any) {
    throw new Error(`Token validation failed: ${error.message}`);
  }
}
