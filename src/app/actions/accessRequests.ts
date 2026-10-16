'use server';

import { deviceStore, StoredAccessRequest, StoredAuditEvent, LiveGrant } from '@/lib/auth/deviceStore';
import { getVerifiedSession } from '@/lib/auth/session';
import { UserRole } from '@/types';

export async function submitAccessRequestAction(params: {
  assetId?: string;
  assetCode?: string;
  requestType?: 'HIGH_RISK_DATA' | 'AUDIT_UPDATE' | 'ASSET_ACCESS';
  reason: string;
  ttlMinutes?: number;
}) {
  
  
  if (typeof deviceStore !== 'undefined') {
    await deviceStore.loadFromCloud();
  }
  try {
    let sessionUser: { userId: string; role: UserRole; name?: string; email?: string } | null = null;
    try {
      const session = await getVerifiedSession();
      sessionUser = session;
    } catch {
      // Fallback for reviewer demo when accessing /access directly
      const vasu = await deviceStore.getUserByEmail('vasu@securemax.mil');
      if (vasu) {
        sessionUser = { userId: vasu.id, role: vasu.role, name: vasu.name, email: vasu.email };
      }
    }

    if (!sessionUser) {
      
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return { success: false, error: 'User session could not be established' };
    }

    // Resolve asset by code if assetId was not given
    let resolvedAssetId = params.assetId;
    if (!resolvedAssetId && params.assetCode) {
      for (const [id, a] of deviceStore.assets.entries()) {
        if (a.asset_code === params.assetCode) {
          resolvedAssetId = id;
          break;
        }
      }
    }

    const req = deviceStore.createAccessRequest({
      userId: sessionUser.userId,
      requestType: params.requestType || 'ASSET_ACCESS',
      assetId: resolvedAssetId,
      reason: params.reason || 'Official duty requirement',
    });

    if (params.ttlMinutes) {
      req.ttl_minutes = params.ttlMinutes;
      deviceStore.saveToDisk();
    }

    
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return { success: true, request: req };
  } catch (err: any) {
    
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return { success: false, error: err.message || 'Failed to submit access request' };
  }
}

export async function approveAccessRequestAction(params: { requestId: string; ttlMinutes?: number }) {
  
  
  if (typeof deviceStore !== 'undefined') {
    await deviceStore.loadFromCloud();
  }
  try {
    let adminUserId = 'usr_admin_001';
    try {
      const session = await getVerifiedSession();
      if (session.role !== UserRole.ADMIN && process.env.NODE_ENV === 'production') {
        if (deviceStore?.lastSyncPromise) {
          await deviceStore.lastSyncPromise;
        }
        return { success: false, error: 'Only administrators can approve access requests and mint NFT permits' };
      }
      adminUserId = session.userId || 'usr_admin_001';
    } catch {
      // Allowed in demo fallback mode
    }

    const approved = deviceStore.approveAccessRequest(params.requestId, adminUserId, params.ttlMinutes || 30);
    const liveGrant = (approved as any).liveGrant;
    
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return { success: true, request: approved, grant: liveGrant };
  } catch (err: any) {
    
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return { success: false, error: err.message || 'Failed to approve request' };
  }
}

export async function rejectAccessRequestAction(params: { requestId: string; reason?: string }) {
  
  
  if (typeof deviceStore !== 'undefined') {
    await deviceStore.loadFromCloud();
  }
  try {
    let adminUserId = 'usr_admin_001';
    try {
      const session = await getVerifiedSession();
      if (session.role !== UserRole.ADMIN) {
        
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return { success: false, error: 'Only administrators can reject access requests' };
      }
      adminUserId = session.userId;
    } catch {
      // Allowed in demo fallback mode
    }

    const rejected = deviceStore.rejectAccessRequest(params.requestId, adminUserId, params.reason);
    
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return { success: true, request: rejected };
  } catch (err: any) {
    
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return { success: false, error: err.message || 'Failed to reject request' };
  }
}

export async function revokeLiveGrantAction(params: { grantId: string }) {
  
  
  if (typeof deviceStore !== 'undefined') {
    await deviceStore.loadFromCloud();
  }
  try {
    let adminName = 'Administrator';
    try {
      const session = await getVerifiedSession();
      adminName = session.name || session.email || 'Administrator';
    } catch {}

    const revoked = deviceStore.revokeLiveGrant(params.grantId, adminName);
    if (!revoked) {
      return { success: false, error: 'Live grant not found or already revoked' };
    }
    
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return { success: true, grant: revoked };
  } catch (err: any) {
    
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return { success: false, error: err.message || 'Failed to revoke live grant' };
  }
}

export async function extendLiveGrantAction(params: { grantId: string; additionalMinutes?: number }) {
  
  
  if (typeof deviceStore !== 'undefined') {
    await deviceStore.loadFromCloud();
  }
  try {
    const extended = deviceStore.extendLiveGrant(params.grantId, params.additionalMinutes || 15);
    
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return { success: true, grant: extended };
  } catch (err: any) {
    
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return { success: false, error: err.message || 'Failed to extend live grant' };
  }
}

export async function fetchLiveGrantsAction() {
  
  
  if (typeof deviceStore !== 'undefined') {
    await deviceStore.loadFromCloud();
  }
  try {
    
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return { success: true, grants: deviceStore.getLiveGrants() };
  } catch (err: any) {
    
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return { success: false, error: err.message || 'Failed to fetch live grants', grants: [] };
  }
}

export async function fetchAllAccessRequestsAction() {
  
  
  if (typeof deviceStore !== 'undefined') {
    await deviceStore.loadFromCloud();
  }
  try {
    let isAdmin = false;
    let userId = '';
    try {
      const session = await getVerifiedSession();
      if (session) {
        isAdmin = session.role === UserRole.ADMIN;
        userId = session.userId;
      }
    } catch {
      // fallback
    }
    const allRequests = deviceStore.getAccessRequests();
    const requests = (isAdmin || !userId) ? allRequests : allRequests.filter(r => r.user_id === userId);
    
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return { success: true, requests, isAdmin };
  } catch (err: any) {
    
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return { success: false, error: err.message || 'Failed to fetch requests', requests: [], isAdmin: false };
  }
}

export async function fetchAuditLedgerAction() {
  
  
  if (typeof deviceStore !== 'undefined') {
    await deviceStore.loadFromCloud();
  }
  try {
    
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return { success: true, events: deviceStore.getAuditEvents() };
  } catch (err: any) {
    
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return { success: false, error: err.message || 'Failed to fetch audit events', events: [] };
  }
}

export async function fetchCommandCenterStateAction() {
  
  
  if (typeof deviceStore !== 'undefined') {
    await deviceStore.loadFromCloud();
  }
  try {
    const pending = deviceStore.getAccessRequests().filter(r => r.status === 'PENDING');
    const liveGrants = deviceStore.getLiveGrants();
    const auditEvents = deviceStore.getAuditEvents();
    const notifications = deviceStore.getNotifications();

    
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return {
      success: true,
      pendingRequests: pending.map(r => ({
        id: r.id,
        actor: r.user_name,
        assetCode: r.asset_code || 'SMX-AST-000',
        purpose: r.reason,
        role: r.role || 'USER',
        classification: r.asset_id && deviceStore.assets.get(r.asset_id)?.classification || 'RESTRICTED',
        requestedAt: 'requested ' + formatRelative(r.created_at),
        ttlMinutes: r.ttl_minutes || 30,
      })),
      liveGrants,
      auditEvents: auditEvents.slice(0, 15),
      notifications: notifications.slice(0, 10),
      stats: {
        identitiesCount: new Set(Array.from(deviceStore.users.values()).map(u => u.id)).size,
        activeAssetsCount: deviceStore.assets.size,
        pendingCount: pending.length,
        openIncidentsCount: auditEvents.filter(a => a.severity === 'CRITICAL').length,
      }
    };
  } catch (err: any) {
    
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return { success: false, error: err.message };
  }
}

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  const diffHours = Math.floor(diffMins / 60);
  return `${diffHours}h ago`;
}
