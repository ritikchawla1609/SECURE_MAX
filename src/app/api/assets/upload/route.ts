import { NextResponse } from 'next/server';
import { getVerifiedSession } from '@/lib/auth/session';
import { deviceStore } from '@/lib/auth/deviceStore';

export async function POST(req: Request) {
  
  
  if (typeof deviceStore !== 'undefined') {
    await deviceStore.loadFromCloud();
  }
  try {
    const session = await getVerifiedSession();
    const formData = await req.formData().catch(() => new FormData());

    const name = formData.get('name') as string;
    const folder = formData.get('folder') as string;
    const classification = formData.get('classification') as string;
    const description = formData.get('description') as string;
    const shareScope = formData.get('shareScope') as any;
    const targetUserId = formData.get('targetUserId') as string;
    const saveDefaultPolicy = formData.get('saveDefaultPolicy') === 'true';
    
    const file = formData.get('file') as File | null;
    const plaintextOpt = formData.get('plaintext') as string | null;
    
    // Extracted additional fields for TS compliance
    const fileType = formData.get('fileType') as string | null;
    const canDecryptShared = formData.get('canDecryptShared') !== 'false';
    const canDownloadShared = formData.get('canDownloadShared') !== 'false';
    const expiresAt = formData.get('expiresAt') as string | null;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'File name is required' }, { status: 400 });
    }

    let plaintext = '';
    let sizeBytes = 0;
    let mimeType = 'text/plain';
    
    if (file && typeof file === 'object') {
      const buffer = Buffer.from(await file.arrayBuffer());
      plaintext = buffer.toString('base64');
      sizeBytes = file.size;
      mimeType = file.type || 'application/octet-stream';
    } else if (plaintextOpt) {
      plaintext = plaintextOpt;
      sizeBytes = Buffer.byteLength(plaintext, 'utf8');
    } else {
      return NextResponse.json({ error: 'File or content payload is required for encryption' }, { status: 400 });
    }

    if (sizeBytes > 5 * 1024 * 1024) {
      if (deviceStore?.lastSyncPromise) {
        await deviceStore.lastSyncPromise;
      }
      return NextResponse.json(
        { error: 'Payload exceeds 5MB limit', code: 'PAYLOAD_TOO_LARGE' },
        { status: 413 }
      );
    }

    const validFolders = ['Projects', 'Finance', 'HR', 'Engineering', 'Legal'];
    const assignedFolder = validFolders.includes(folder) ? folder : 'Projects';

    const validClassifications = ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'];
    const assignedClassification = validClassifications.includes(classification) ? classification : 'CONFIDENTIAL';

    const effectiveShareScope = ['PRIVATE', 'SPECIFIC_USER', 'ALL_PEOPLE'].includes(shareScope) 
      ? shareScope 
      : 'PRIVATE';

    const newAsset = deviceStore.createAsset({
      name: name.trim(),
      folder: assignedFolder,
      classification: assignedClassification,
      description: description || `Uploaded via Secure Data Vault by ${session.name || session.email}`,
      plaintext,
      mimeType: mimeType || 'text/plain',
      fileType: fileType || (name.includes('.') ? name.split('.').pop()?.toUpperCase() || 'TXT' : 'TXT'),
      ownerId: session.userId,
      ownerName: session.name || session.email || 'Authorized User',
      sizeBytes: sizeBytes || Buffer.byteLength(plaintext, 'utf8'),
      shareScope: effectiveShareScope,
      targetUserId: effectiveShareScope === 'SPECIFIC_USER' ? targetUserId : undefined,
      canDecryptShared: canDecryptShared !== false,
      canDownloadShared: canDownloadShared !== false,
      expiresAt,
    });

    if (saveDefaultPolicy) {
      const policyToSave = effectiveShareScope === 'ALL_PEOPLE' ? 'ORGANIZATION' : 'PRIVATE';
      deviceStore.setUserDefaultAccessPolicy(session.userId, policyToSave);
    }

    try {
      const { supabaseAdmin, isSupabaseConfigured } = require('@/lib/db/client');
      if (supabaseAdmin && typeof isSupabaseConfigured === 'function' && isSupabaseConfigured()) {
        const encryptedBuffer = Buffer.from(newAsset.encrypted_content, 'base64');
        const { error } = await supabaseAdmin.storage
          .from('securemax-vault')
          .upload(`assets/${newAsset.id}`, encryptedBuffer, { upsert: true, contentType: 'application/octet-stream' });
        if (error) {
          console.warn('[Storage] Failed to upload asset binary:', error.message);
          try {
            deviceStore.deleteAsset(newAsset.id, session.userId);
          } catch {}
          return NextResponse.json({ error: `Storage failure: ${error.message}. Upload rolled back.` }, { status: 502 });
        }
      }
    } catch (e: any) {
      console.warn('[Storage] Exception uploading to Supabase:', e);
      try {
        deviceStore.deleteAsset(newAsset.id, session.userId);
      } catch {}
      return NextResponse.json({ error: `Storage upload exception: ${e.message}. Upload rolled back.` }, { status: 502 });
    }
    
    // Critical for Vercel: Wait for the ledger cloud sync to complete before Lambda freezes
    if (deviceStore.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }

    return NextResponse.json({
      success: true,
      asset: {
        id: newAsset.id,
        code: newAsset.asset_code,
        name: newAsset.name,
        classification: newAsset.classification,
        folder: newAsset.folder,
        fileType: newAsset.file_type,
        fileSizeBytes: newAsset.file_size_bytes,
        status: newAsset.status,
        ownerId: newAsset.owner_id,
        ownerName: newAsset.owner_name,
        sharedWithAll: newAsset.shared_with_all,
      },
      message: `Asset encrypted with AES-256-GCM and registered successfully (${effectiveShareScope === 'ALL_PEOPLE' ? 'Shared with All People' : effectiveShareScope === 'SPECIFIC_USER' ? 'Shared with Specific Person' : 'Private to You'}).`,
    });
  } catch (error: any) {
    console.error('[Vault Upload Error]:', error);
    return NextResponse.json({ error: error.message || 'Failed to upload asset' }, { status: 500 });
  }
}
