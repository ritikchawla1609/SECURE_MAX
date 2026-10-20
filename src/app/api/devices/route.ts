import { NextResponse } from 'next/server';
import { getVerifiedSession } from '@/lib/auth/session';
import { deviceStore } from '@/lib/auth/deviceStore';
import { UserRole, UserStatus } from '@/types';

export async function GET() {
  if (typeof deviceStore !== 'undefined') {
    await deviceStore.loadFromCloud();
  }
  try {
    const session = await getVerifiedSession();
    const isAdmin = session.role === UserRole.ADMIN;

    const passports = isAdmin
      ? deviceStore.getAllDevicePassports()
      : deviceStore.getDevicesForUser(session.userId).map(d => deviceStore.getDevicePassport(d.id) || (d as any));

    const safeDevices = await Promise.all(passports.map(async d => {
      const user = await deviceStore.getUserById(d.user_id);
      return {
        id: d.id || d.device_id,
        deviceId: d.device_id || d.id,
        deviceName: d.device_name,
        deviceType: d.device_type || (d.is_admin_device ? 'terminal' : 'laptop'),
        os: d.os || 'macOS',
        browser: d.browser || 'Chrome',
        browserVersion: d.browser_version || '128.0',
        model: d.model || 'MacBook Pro',
        registrationRegion: d.registration_region || 'Punjab, India',
        credentialId: d.credential_id || `cred_${d.id}`,
        credentialType: d.credential_type || 'WebAuthn',
        status: d.status,
        riskState: d.risk_state || 'TRUSTED',
        position: d.position || (user ? user.role : 'USER'),
        isAdminDevice: d.is_admin_device,
        userId: d.user_id,
        userEmail: d.user_email || user?.email || session.email,
        userName: d.user_name || user?.name || session.name,
        createdAt: d.created_at || d.registered_at,
        registeredAt: d.registered_at || d.created_at,
        lastUsedAt: d.last_used_at,
        lastAuthenticatedAt: d.last_authenticated_at || d.last_used_at,
        revokedAt: d.revoked_at,
        timeline: d.timeline || [],
        publicKeyFingerprint: d.public_key ? `P256-${d.public_key.slice(0, 10)}...${d.public_key.slice(-8)}` : 'UNKNOWN',
      };
    }));

    // Positions
    const positions = deviceStore.getPositions();

    // Personnel
    let personnelList: Array<{ id: string; name: string; email: string; role: string; position: string; status: string }> = [];
    if (isAdmin) {
      for (const u of deviceStore.users.values()) {
        if (!personnelList.some(p => p.id === u.id)) {
          personnelList.push({
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role,
            position: u.position || u.role,
            status: u.status,
          });
        }
      }
    }

    // Active Sessions
    const activeSessions = deviceStore.getActiveSessions().map(s => ({
      sessionId: s.session_id,
      userId: s.user_id,
      userName: s.user_name,
      userEmail: s.user_email,
      deviceId: s.device_id,
      deviceName: s.device_name,
      position: s.position,
      createdAt: s.created_at,
      lastActivityAt: s.last_activity_at,
      expiresAt: s.expires_at,
      authenticationLevel: s.authentication_level,
      status: s.status,
    }));

    // Enrollment Capabilities History (Audit safe: hashed, no plaintext codes)
    const enrollmentHistory = Array.from(deviceStore.enrollmentCapabilities.values())
      // Deduplicate by ID
      .filter((cap, index, self) => self.findIndex(c => c.id === cap.id) === index)
      .map(cap => ({
        id: cap.id,
        userId: cap.user_id,
        userName: cap.user_name,
        userEmail: cap.user_email,
        positionName: cap.position_name,
        durationMinutes: cap.duration_minutes,
        maxDevices: cap.max_devices,
        devicesEnrolled: cap.devices_enrolled,
        targetDeviceType: cap.target_device_type,
        createdAt: cap.created_at,
        expiresAt: cap.expires_at,
        status: cap.status,
        usedAt: cap.used_at,
      }));

    
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({
      success: true,
      devices: safeDevices,
      positions,
      personnel: personnelList,
      sessions: activeSessions,
      enrollmentHistory,
      user: {
        id: session.userId,
        email: session.email,
        name: session.name,
        role: session.role,
      },
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
    const { deviceId, action, riskState, sessionId, targetUserId, lostDeviceId } = body;

    if (action === 'revoke_session' && sessionId) {
      deviceStore.revokeSession(sessionId, session.userId);
      
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({ success: true, message: `Session ${sessionId} revoked successfully` });
    }

    if (action === 'revoke_all_sessions') {
      const userToRevoke = targetUserId || session.userId;
      deviceStore.revokeAllSessionsForUser(userToRevoke, session.userId);
      
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({ success: true, message: `All sessions revoked for user ${userToRevoke}` });
    }

    // Emergency Control: Suspend User
    if (action === 'suspend_user') {
      if (!targetUserId) {
        
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({ error: 'Missing targetUserId parameter' }, { status: 400 });
      }
      const suspendedUser = deviceStore.suspendUser(targetUserId, session.userId);
      
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({
        success: true,
        message: `User ${suspendedUser.name} (${targetUserId}) suspended. All sessions revoked and device access blocked.`,
        user: suspendedUser,
      });
    }

    // Emergency Control: Reactivate User
    if (action === 'reactivate_user') {
      if (!targetUserId) {
        
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({ error: 'Missing targetUserId parameter' }, { status: 400 });
      }
      const reactivatedUser = deviceStore.reactivateUser(targetUserId, session.userId);
      
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({
        success: true,
        message: `User ${reactivatedUser.name} (${targetUserId}) reactivated. Device access restored.`,
        user: reactivatedUser,
      });
    }

    // Recovery Workflow: Lost Device Recovery
    if (action === 'recover_device') {
      const targetLostDevice = lostDeviceId || deviceId;
      if (!targetLostDevice) {
        
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({ error: 'Missing lostDeviceId parameter for recovery' }, { status: 400 });
      }
      const recoveryResult = deviceStore.recoverDevice({
        lostDeviceId: targetLostDevice,
        callerUserId: session.userId,
      });
      
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({
        success: true,
        message: `Device recovery executed: Old device revoked, new 15-minute enrollment code issued.`,
        enrollmentCode: recoveryResult.plaintextCode,
        expiresAt: recoveryResult.enrollment.expires_at,
        oldDeviceId: recoveryResult.oldDevice.device_id,
        user: recoveryResult.oldDevice.user_name,
      });
    }

    if (!deviceId) {
      
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({ error: 'Missing deviceId parameter' }, { status: 400 });
    }

    if (action === 'revoke') {
      deviceStore.revokeDevice(session.userId, deviceId);
      
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({ success: true, message: `Device ${deviceId} revoked successfully` });
    }

    if (action === 'suspend') {
      const passport = deviceStore.suspendDevice(deviceId, session.userId);
      
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({ success: true, message: `Device ${deviceId} suspended successfully`, passport });
    }

    if (action === 'reactivate') {
      const passport = deviceStore.reactivateDevice(deviceId, session.userId);
      
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({ success: true, message: `Device ${deviceId} reactivated successfully`, passport });
    }

    if (action === 'update_risk') {
      if (!riskState) {
        
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({ error: 'Missing riskState parameter' }, { status: 400 });
      }
      const passport = deviceStore.updateDeviceRiskState(deviceId, riskState, session.userId);
      
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({ success: true, message: `Device risk state updated to ${riskState}`, passport });
    }

    if (action === 'force_reauth') {
      deviceStore.forceReauthentication(deviceId, session.userId);
      
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({ success: true, message: `Re-authentication enforced for device ${deviceId}` });
    }

    
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({ error: 'Invalid device action' }, { status: 400 });
  } catch (error: any) {
    
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({ error: error.message || 'Failed to update device' }, { status: 400 });
  }
}
