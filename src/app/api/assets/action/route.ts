import { NextResponse } from 'next/server';
import { getVerifiedSession } from '@/lib/auth/session';
import { deviceStore } from '@/lib/auth/deviceStore';

export async function POST(req: Request) {
  
  
  if (typeof deviceStore !== 'undefined') {
    await deviceStore.loadFromCloud();
  }
  try {
    const session = await getVerifiedSession();
    const body = await req.json().catch(() => ({}));
    const { action, assetId, newName, newFolder } = body;

    if (!assetId) {
      
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({ error: 'Asset ID is required' }, { status: 400 });
    }

    if (action === 'rename') {
      if (!newName || typeof newName !== 'string' || !newName.trim()) {
        
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({ error: 'New file name is required' }, { status: 400 });
      }
      const updated = deviceStore.renameAsset(assetId, newName.trim(), session.userId);
      
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({
        success: true,
        message: `Asset renamed to "${updated.name}".`,
        asset: updated,
      });
    }

    if (action === 'move') {
      const validFolders = ['Projects', 'Finance', 'HR', 'Engineering', 'Legal'];
      if (!newFolder || !validFolders.includes(newFolder)) {
        
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({ error: 'Invalid destination folder' }, { status: 400 });
      }
      const updated = deviceStore.moveAssetFolder(assetId, newFolder, session.userId);
      
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({
        success: true,
        message: `Asset moved to folder "${newFolder}".`,
        asset: updated,
      });
    }

    if (action === 'delete') {
      deviceStore.deleteAsset(assetId, session.userId);
      
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({
        success: true,
        message: 'Asset permanently deleted from vault.',
      });
    }

    
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({ error: 'Invalid action requested' }, { status: 400 });
  } catch (error: any) {
    console.error('[Vault Action Error]:', error);
    
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({ error: error.message || 'Operation failed' }, { status: 403 });
  }
}
