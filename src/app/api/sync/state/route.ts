import { NextResponse } from 'next/server';
import { deviceStore } from '@/lib/auth/deviceStore';

import { getVerifiedSession } from '@/lib/auth/session';
import { UserRole } from '@/types';

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
    const session = await getVerifiedSession();
    const isAdmin = session.role === UserRole.ADMIN;
    const allPending = deviceStore.getAccessRequests().filter(r => r.status === 'PENDING');
    const pending = isAdmin ? allPending : allPending.filter(r => r.user_id === session.userId);
    const liveGrants = isAdmin ? deviceStore.getLiveGrants() : deviceStore.getLiveGrants().filter(g => (g.userId || g.user_id) === session.userId);
    const notifications = deviceStore.getNotifications();
    const auditEvents = isAdmin ? deviceStore.getAuditEvents() : [];

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
      { success: false, error: error.message || 'Unauthorized: Active session required' },
      { status: 401 }
    );
  }
}

export async function POST(req: Request) {
  if (typeof deviceStore !== 'undefined') {
    await deviceStore.loadFromCloud();
  }
  try {
    const session = await getVerifiedSession();
    const body = await req.json().catch(() => ({}));
    const { action, requestId, grantId, ttlMinutes, reason, assetCode } = body;

    // Mutating actions require Administrator privileges
    if (['APPROVE', 'REJECT', 'REVOKE', 'EXTEND'].includes(action)) {
      if (session.role !== UserRole.ADMIN) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: Administrator privileges required for state mutation' },
          { status: 403 }
        );
      }
    }

    if (action === 'APPROVE' && requestId) {
      deviceStore.approveAccessRequest(requestId, session.userId, ttlMinutes || 30);
    } else if (action === 'REJECT' && requestId) {
      deviceStore.rejectAccessRequest(requestId, session.userId, reason);
    } else if (action === 'REVOKE' && grantId) {
      deviceStore.revokeLiveGrant(grantId, session.name || session.email || 'Administrator');
    } else if (action === 'EXTEND' && grantId) {
      deviceStore.extendLiveGrant(grantId, ttlMinutes || 15);
    } else if (action === 'REQUEST' && assetCode) {
      let assetId: string | undefined;
      for (const [id, a] of deviceStore.assets.entries()) {
        if (a.asset_code === assetCode) {
          assetId = id;
          break;
        }
      }
      const newReq = deviceStore.createAccessRequest({
        userId: session.userId,
        requestType: 'ASSET_ACCESS',
        assetId,
        reason: reason || 'Operational asset access request',
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
      { status: 401 }
    );
  }
}
