import { NextResponse } from 'next/server';
import { getVerifiedSession } from '@/lib/auth/session';
import { authorizeAssetAccess, prepareDecryptionStream } from '@/lib/api/access-flow';
import { Readable } from 'stream';
import { deviceStore } from '@/lib/auth/deviceStore';
import { UserRole } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  
  
  if (typeof deviceStore !== 'undefined') {
    await deviceStore.loadFromCloud();
  }
  try {
    const session = await getVerifiedSession();
    const body = await req.json().catch(() => ({}));
    const { assetId } = body;

    if (!assetId) {
      
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({ error: 'Missing assetId parameter' }, { status: 400 });
    }

    const asset = deviceStore.assets.get(assetId);
    if (!asset) {
      
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    // Strict Access Control:
    // Only the Administrator can decrypt directly without prior access request.
    // All other users require an approved access request and active assignment.
    const isAdmin = session.role === UserRole.ADMIN;
    if (!isAdmin) {
      const assignment = deviceStore.getAssignment(session.userId, assetId);
      if (!assignment || assignment.status !== 'ACTIVE' || !assignment.can_decrypt) {
        if (deviceStore?.lastSyncPromise) {
          await deviceStore.lastSyncPromise;
        }
        return NextResponse.json(
          { error: 'Access Denied: You must request access from an administrator and receive approval before opening or downloading this asset.' },
          { status: 403 }
        );
      }
    }

    // Extract network client IP for cryptographic token binding
    const forwarded = req.headers.get('x-forwarded-for');
    const clientIp = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';

    // 1. Authorize access via 10-step flow
    let tempToken: string;
    try {
      const authResult = await authorizeAssetAccess(
        session.userId,
        assetId,
        session.sessionId,
        session.deviceId,
        undefined,
        clientIp
      );
      tempToken = authResult.tempToken;
    } catch (authErr: any) {
      deviceStore.recordAssetAccess(
        assetId,
        session.userId,
        'DECRYPT',
        'DENIED',
        authErr.message || 'Authorization rejected'
      );
      throw authErr;
    }

    // 2. Prepare Decryption Stream
    const decryptStream = await prepareDecryptionStream(
      assetId,
      asset.iv,
      asset.auth_tag,
      tempToken,
      session.sessionId,
      clientIp
    );

    let finalWebStream: any;

    if (asset.encrypted_content === 'stored_in_supabase_cloud') {
      const { supabaseAdmin } = require('@/lib/db/client');
      if (!supabaseAdmin) throw new Error('Supabase admin client not initialized');
      
      const { data, error } = await supabaseAdmin.storage.from('securemax-vault').createSignedUrl(`assets/${assetId}`, 60);
      if (error || !data?.signedUrl) throw new Error('Failed to generate secure download URL');

      const response = await fetch(data.signedUrl, { cache: 'no-store' });
      if (!response.ok || !response.body) throw new Error('Failed to fetch encrypted asset stream');

      const nodeReadable = Readable.fromWeb(response.body as any);
      const finalNodeStream = nodeReadable.pipe(decryptStream);
      finalWebStream = Readable.toWeb(finalNodeStream);
    } else {
      // Fallback for legacy assets stored in-memory
      const encryptedBuffer = Buffer.from(asset.encrypted_content, 'base64');
      const nodeReadable = Readable.from(encryptedBuffer);
      const finalNodeStream = nodeReadable.pipe(decryptStream);
      finalWebStream = Readable.toWeb(finalNodeStream);
    }

    // 3. Record successful access log
    deviceStore.recordAssetAccess(
      assetId,
      session.userId,
      'DECRYPT',
      'SUCCESS',
      'Streaming AES-256-GCM decryption started'
    );

    // Read decrypted stream with bounded memory protection
    const reader = finalWebStream.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    const MAX_DECRYPT_SIZE = 50 * 1024 * 1024; // 50MB bound

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        totalBytes += value.length;
        if (totalBytes > MAX_DECRYPT_SIZE) {
          throw new Error('Payload too large: Decrypted content exceeds 50MB limit');
        }
        chunks.push(value);
      }
    }

    const decryptedBuffer = Buffer.concat(chunks);
    const isText = !asset.mime_type || asset.mime_type === 'text/plain' || asset.mime_type.startsWith('text/');
    const result = isText 
      ? decryptedBuffer.toString('utf8')
      : decryptedBuffer.toString('base64');

    return NextResponse.json({
      success: true,
      assetId: asset.id,
      assetName: asset.name,
      classification: asset.classification,
      folder: asset.folder,
      fileType: asset.file_type,
      mimeType: asset.mime_type,
      fileSizeBytes: asset.file_size_bytes,
      decryptedData: result,
      decryptedAt: new Date().toISOString(),
      keyVersion: asset.key_version || 'v1',
      encryptionStandard: 'AES-256-GCM',
      authorizedBy: 'Sentinel Zero-Trust Engine'
    });
  } catch (error: any) {
    console.error('[Decryption API Error]:', error);
    
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json(
      { error: error.message || 'Access Denied: You are not authorized to decrypt this asset.' },
      { status: 403 }
    );
  }
}
