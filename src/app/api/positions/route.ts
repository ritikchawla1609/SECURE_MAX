import { NextResponse } from 'next/server';
import { getVerifiedSession } from '@/lib/auth/session';
import { deviceStore } from '@/lib/auth/deviceStore';
import { UserRole } from '@/types';

export async function GET() {
  if (typeof deviceStore !== 'undefined') {
    await deviceStore.loadFromCloud();
  }
  try {
    const positions = deviceStore.getPositions();
    
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({
      success: true,
      positions,
    });
  } catch (error: any) {
    
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json(
      { error: error.message || 'Failed to fetch positions' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  
  
  if (typeof deviceStore !== 'undefined') {
    await deviceStore.loadFromCloud();
  }
  try {
    const session = await getVerifiedSession();
    if (session.role !== UserRole.ADMIN) {
      
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json(
        { error: 'Unauthorized: Only Administrator can create or configure positions' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { name, description, privilege_level, permissions, adminConfirmed } = body;

    if (!name || !description) {
      
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json(
        { error: 'Position Name and Description are required' },
        { status: 400 }
      );
    }

    const validLevels = ['STANDARD', 'ELEVATED', 'ADMINISTRATIVE'];
    const level = (privilege_level || 'STANDARD').toUpperCase();
    if (!validLevels.includes(level)) {
      
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json(
        { error: 'Invalid privilege level. Must be STANDARD, ELEVATED, or ADMINISTRATIVE' },
        { status: 400 }
      );
    }

    // Security check: High privilege positions require explicit admin confirmation
    const isHighPrivilege = level === 'ADMINISTRATIVE' || level === 'ELEVATED';
    const hasDangerousPerms = Boolean(
      permissions?.identity?.revoke ||
      permissions?.users?.create ||
      permissions?.access?.approve ||
      permissions?.security?.manage_devices
    );

    if ((isHighPrivilege || hasDangerousPerms) && !adminConfirmed) {
      
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json(
        {
          error: 'High-privilege position creation requires explicit administrative confirmation.',
          requiresConfirmation: true,
          details: {
            level,
            dangerousPerms: hasDangerousPerms,
          },
        },
        { status: 400 }
      );
    }

    const defaultPermissions = {
      identity: { register: false, suspend: false, revoke: false },
      users: { create: false, suspend: false },
      assets: { view: true, allocate: false, transfer: false, delete: false },
      access: { approve: false, revoke: false },
      audit: { view: false, export: false },
      security: { view_alerts: false, manage_devices: false },
    };

    const finalPermissions = {
      identity: { ...defaultPermissions.identity, ...(permissions?.identity || {}) },
      users: { ...defaultPermissions.users, ...(permissions?.users || {}) },
      assets: { ...defaultPermissions.assets, ...(permissions?.assets || {}) },
      access: { ...defaultPermissions.access, ...(permissions?.access || {}) },
      audit: { ...defaultPermissions.audit, ...(permissions?.audit || {}) },
      security: { ...defaultPermissions.security, ...(permissions?.security || {}) },
    };

    const newPosition = deviceStore.createPosition({
      name,
      description,
      privilege_level: level as 'STANDARD' | 'ELEVATED' | 'ADMINISTRATIVE',
      permissions: finalPermissions,
      callerUserId: session.userId,
    });

    
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({
      success: true,
      position: newPosition,
      message: `Position "${newPosition.name}" successfully created with ${newPosition.privilege_level} privilege level`,
    });
  } catch (error: any) {
    console.error('[Create Position Error]:', error);
    
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json(
      { error: error.message || 'Failed to create position' },
      { status: 400 }
    );
  }
}
