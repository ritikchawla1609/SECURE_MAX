import { NextResponse } from 'next/server';
import { getVerifiedSession } from '@/lib/auth/session';
import { deviceStore } from '@/lib/auth/deviceStore';

export async function GET(req: Request) {
  if (typeof deviceStore !== 'undefined') {
    await deviceStore.loadFromCloud();
  }
  try {
    await getVerifiedSession();
    const url = new URL(req.url);
    const assetId = url.searchParams.get('assetId');

    if (!assetId) {
      
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({ error: 'Missing assetId parameter' }, { status: 400 });
    }

    const shares = deviceStore.getSharesForAsset(assetId);
    
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({
      success: true,
      shares,
    });
  } catch (error: any) {
    
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({ error: error.message || 'Unauthorized' }, { status: 401 });
  }
}

export async function POST(req: Request) {
  
  
  if (typeof deviceStore !== 'undefined') {
    await deviceStore.loadFromCloud();
  }
  try {
    const session = await getVerifiedSession();
    const body = await req.json().catch(() => ({}));

    const { action, assetId, targetUserId, canRead, canDecrypt, canDownload, canEdit, canDelete, expiry } = body;

    if (!assetId) {
      
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({ error: 'Asset ID is required' }, { status: 400 });
    }

    if (action === 'revoke') {
      if (!targetUserId) {
        
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({ error: 'Target user ID is required to revoke' }, { status: 400 });
      }
      deviceStore.revokeAssetShare(assetId, targetUserId, session.userId);
      
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({
        success: true,
        message: `Access revoked for ${targetUserId === 'ALL' ? 'All People' : targetUserId}.`,
      });
    }

    if (!targetUserId) {
      
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({ error: 'Target user ID is required (specify user ID or "ALL")' }, { status: 400 });
    }

    let expiresAt: string | null = null;
    const now = Date.now();

    if (expiry === '24h') {
      expiresAt = new Date(now + 24 * 3600 * 1000).toISOString();
    } else if (expiry === '7d') {
      expiresAt = new Date(now + 7 * 24 * 3600 * 1000).toISOString();
    } else if (expiry === '30d') {
      expiresAt = new Date(now + 30 * 24 * 3600 * 1000).toISOString();
    } else if (expiry && expiry !== 'never' && typeof expiry === 'string') {
      const parsed = new Date(expiry);
      if (!isNaN(parsed.getTime())) {
        expiresAt = parsed.toISOString();
      }
    }

    const assignment = deviceStore.shareAsset({
      assetId,
      targetUserId,
      callerUserId: session.userId,
      canRead: canRead !== false,
      canDecrypt: canDecrypt !== false,
      canDownload: canDownload !== false,
      canEdit: Boolean(canEdit),
      canDelete: Boolean(canDelete),
      expiresAt,
    });

    const isAll = targetUserId === 'ALL';
    const targetLabel = isAll ? 'All People (Organization-Wide)' : targetUserId;

    
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({
      success: true,
      assignment,
      message: `Access granted to ${targetLabel}${expiresAt ? ` until ${new Date(expiresAt).toLocaleString()}` : ' (Permanent)'}.`,
    });
  } catch (error: any) {
    console.error('[Vault Share Error]:', error);
    
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({ error: error.message || 'Failed to share asset' }, { status: 403 });
  }
}
