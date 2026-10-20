'use server';

import { supabaseAdmin } from '@/lib/db/client';
import { getVerifiedSession } from '@/lib/auth/session';
import { UserRole } from '@/types';
import { deviceStore } from '@/lib/auth/deviceStore';

export async function getDashboardMetrics() {
  
  
  if (typeof deviceStore !== 'undefined') {
    await deviceStore.loadFromCloud();
  }
  try {
    const session = await getVerifiedSession();
    if (session.role !== UserRole.ADMIN) {
      throw new Error('Forbidden');
    }

    // Dynamic metrics from deviceStore
    const localUsersCount = new Set([...deviceStore.users.values()].map(u => u.id)).size;
    const localAssetsCount = deviceStore.assets.size;
    const localPendingRequests = deviceStore.accessRequests.filter(r => r.status === 'PENDING').length;
    const localAudits = [...deviceStore.auditEvents].reverse().slice(0, 5).map(a => ({
      id: a.id,
      event_type: a.event_type,
      description: a.description,
      severity: a.severity,
      target_id: a.target_id,
      event_hash: a.event_hash,
      created_at: a.created_at,
    }));

    try {
      const [usersRes, assetsRes, reqRes, alertsRes, auditRes] = await Promise.all([
        supabaseAdmin.from('users').select('*', { count: 'exact', head: true }),
        supabaseAdmin.from('assets').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
        supabaseAdmin.from('access_requests').select('*', { count: 'exact', head: true }).eq('status', 'PENDING'),
        supabaseAdmin.from('security_findings').select('*', { count: 'exact', head: true }).in('severity', ['HIGH', 'CRITICAL']).eq('status', 'OPEN'),
        supabaseAdmin.from('audit_events').select('*').order('created_at', { ascending: false }).limit(5),
      ]);

      const totalUsers = Math.max(localUsersCount, (usersRes.count != null && usersRes.count > 0) ? usersRes.count : 0);
      const activeAssets = Math.max(localAssetsCount, (assetsRes.count != null && assetsRes.count > 0) ? assetsRes.count : 0);
      const pendingAccessRequests = Math.max(localPendingRequests, reqRes.count != null ? reqRes.count : 0);
      const criticalAlerts = alertsRes.count ?? 0;
      const recentAudits = (auditRes.data && auditRes.data.length > 0) ? auditRes.data : localAudits;

      
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return {
        success: true,
        data: {
          totalUsers,
          activeAssets,
          pendingAccessRequests,
          criticalAlerts,
          recentAudits: recentAudits.length > 0 ? recentAudits : localAudits,
        },
      };
    } catch {
      
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return {
        success: true,
        data: {
          totalUsers: localUsersCount,
          activeAssets: localAssetsCount,
          pendingAccessRequests: localPendingRequests,
          criticalAlerts: 0,
          recentAudits: localAudits,
        },
      };
    }
  } catch (error: any) {
    const localUsersCount = new Set([...deviceStore.users.values()].map(u => u.id)).size;
    const localAssetsCount = deviceStore.assets.size;
    const localPendingRequests = deviceStore.accessRequests.filter(r => r.status === 'PENDING').length;
    const localAudits = [...deviceStore.auditEvents].reverse().slice(0, 5).map(a => ({
      id: a.id,
      event_type: a.event_type,
      description: a.description,
      severity: a.severity,
      target_id: a.target_id,
      event_hash: a.event_hash,
      created_at: a.created_at,
    }));

    
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return {
      success: true,
      data: {
        totalUsers: localUsersCount,
        activeAssets: localAssetsCount,
        pendingAccessRequests: localPendingRequests,
        criticalAlerts: 0,
        recentAudits: localAudits,
      },
    };
  }
}
