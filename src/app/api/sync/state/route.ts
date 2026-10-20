import { NextResponse } from 'next/server';
import { deviceStore } from '@/lib/auth/deviceStore';

export const dynamic = 'force-dynamic';

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  const diffHours = Math.floor(diffMins / 60);
  return `${diffHours}h ago`;
}

export async function GET() {
  if (typeof deviceStore !== 'undefined') {
    await deviceStore.loadFromCloud();
  }
  try {
    const pending = deviceStore.getAccessRequests().filter(r => r.status === 'PENDING');
    const liveGrants = deviceStore.getLiveGrants();
    const notifications = deviceStore.getNotifications();
    const auditEvents = deviceStore.getAuditEvents();

    const formattedPending = pending.map(r => ({
      id: r.id,
      actor: r.user_name,
      assetCode: r.asset_code || 'SMX-AST-000',
      purpose: r.reason,
      role: r.role || 'USER',
      classification: (r.asset_id && deviceStore.assets.get(r.asset_id)?.classification) || 'RESTRICTED',
      requestedAt: 'requested ' + formatRelative(r.created_at),
      ttlMinutes: r.ttl_minutes || 30,
    }));

    
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({
      success: true,
      pendingRequests: formattedPending,
      liveGrants,
      notifications: notifications.slice(0, 10),
      auditEvents: auditEvents.slice(0, 15),
      stats: {
        identitiesCount: new Set(Array.from(deviceStore.users.values()).map(u => u.id)).size,
        activeAssetsCount: deviceStore.assets.size,
        pendingCount: pending.length,
        openIncidentsCount: auditEvents.filter(a => a.severity === 'CRITICAL').length,
      },
      timestamp: Date.now(),
    });
  } catch (error: any) {
    
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to sync state' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  
  
  if (typeof deviceStore !== 'undefined') {
    await deviceStore.loadFromCloud();
  }
  try {
    const body = await req.json().catch(() => ({}));
    const { action, requestId, grantId, ttlMinutes, reason, assetCode, user } = body;

    if (action === 'APPROVE' && requestId) {
      deviceStore.approveAccessRequest(requestId, 'usr_admin_001', ttlMinutes || 30);
    } else if (action === 'REJECT' && requestId) {
      deviceStore.rejectAccessRequest(requestId, 'usr_admin_001', reason);
    } else if (action === 'REVOKE' && grantId) {
      deviceStore.revokeLiveGrant(grantId, 'Administrator');
    } else if (action === 'EXTEND' && grantId) {
      deviceStore.extendLiveGrant(grantId, ttlMinutes || 15);
    } else if (action === 'REQUEST' && assetCode) {
      const vasu = await deviceStore.getUserByEmail('vasu@securemax.mil');
      const userId = vasu?.id || 'usr_vasu_002';
      let assetId: string | undefined;
      for (const [id, a] of deviceStore.assets.entries()) {
        if (a.asset_code === assetCode) {
          assetId = id;
          break;
        }
      }
      const newReq = deviceStore.createAccessRequest({
        userId,
        requestType: 'ASSET_ACCESS',
        assetId,
        reason: reason || 'Vendor invoice reconciliation',
      });
      if (ttlMinutes) {
        newReq.ttl_minutes = ttlMinutes;
        deviceStore.saveToDisk();
      }
    }

    return GET();
  } catch (error: any) {
    
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json(
      { success: false, error: error.message || 'Sync POST error' },
      { status: 500 }
    );
  }
}
