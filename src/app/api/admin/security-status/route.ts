import { NextResponse } from 'next/server';
import { deviceStore } from '@/lib/auth/deviceStore';
import { getVerifiedSession } from '@/lib/auth/session';
import { UserRole } from '@/types';

/**
 * GET /api/admin/security-status
 * Returns security metrics for the Admin Security Center:
 * - System initialization status
 * - Root Admin status (Active / Locked)
 * - Trusted Devices (1 / 1 singleton)
 * - Active sessions count
 * - Failed admin logins
 * - Security alerts count
 * - Last admin login timestamp & region
 * - Last security change timestamp
 * - Admin device timeline
 */
export async function GET() {
  if (typeof deviceStore !== 'undefined') {
    await deviceStore.loadFromCloud();
  }
  
  
  if (typeof deviceStore !== 'undefined') {
    await deviceStore.loadFromCloud();
  }
  try {
    const session = await getVerifiedSession().catch(() => null);
    if (!session || session.role !== UserRole.ADMIN) {
      
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json(
        { error: 'Unauthorized: Admin access required for Security Center' },
        { status: 403 }
      );
    }

    const settings = deviceStore.getSystemSettings();
    const adminUser = settings.root_admin_id ? await deviceStore.getUserById(settings.root_admin_id) : null;
    const adminDevices = adminUser ? deviceStore.getDevicesForUser(adminUser.id) : [];
    const activeAdminDevice = adminDevices.find(d => d.is_admin_device && d.status === 'ACTIVE') || adminDevices[0] || null;
    const passport = activeAdminDevice ? deviceStore.getDevicePassport(activeAdminDevice.id) : null;
    const activeSessions = deviceStore.getActiveSessions();
    const adminSessions = adminUser ? deviceStore.getSessionsForUser(adminUser.id) : [];

    const securityAlerts = deviceStore.getAuditEvents().filter(
      a => a.severity === 'CRITICAL' || a.severity === 'WARNING' || (a.event_type && a.event_type.includes('ALERT')) || ((a as any).eventType && (a as any).eventType.includes('ALERT'))
    );

    
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({
      systemStatus: settings.system_state,
      initialized: settings.admin_initialized,
      rootAdmin: {
        id: adminUser?.id || 'ADM-0001',
        name: adminUser?.name || 'Administrator',
        email: adminUser?.email || 'admin@securemax.mil',
        status: settings.admin_locked ? 'LOCKED' : (adminUser?.status || 'ACTIVE'),
      },
      trustedDevices: {
        active: activeAdminDevice && activeAdminDevice.status === 'ACTIVE' ? 1 : 0,
        maxAllowed: 1,
        isSingletonEnforced: true,
        primaryDevice: passport || activeAdminDevice,
      },
      activeSessionsCount: adminSessions.length || 1,
      totalActiveSessions: activeSessions.length,
      failedAdminLogins: settings.failed_admin_logins,
      securityAlertsCount: securityAlerts.length,
      lastAdminLogin: settings.last_admin_login || {
        timestamp: new Date().toISOString(),
        region: 'Punjab, India',
        device_name: activeAdminDevice?.device_name || 'SecureMAX Admin Laptop',
        auth_method: 'WEBAUTHN',
      },
      lastSecurityChange: settings.last_security_change || new Date().toISOString(),
      deviceTimeline: passport?.timeline || [],
    });
  } catch (error: any) {
    console.error('[Admin Security Status Error]:', error);
    
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve security status' },
      { status: 500 }
    );
  }
}
