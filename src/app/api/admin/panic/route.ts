import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getVerifiedSession } from '@/lib/auth/session';
import { deviceStore } from '@/lib/auth/deviceStore';
import { UserRole } from '@/types';

/**
 * POST /api/admin/panic
 * Emergency panic lock for Administrator.
 * Immediately:
 * 1. Revokes all active admin sessions
 * 2. Disables/suspends admin device
 * 3. Requires emergency recovery ceremony to restore access
 */
export async function POST(req: Request) {
  
  
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
        { error: 'Unauthorized: Only authenticated root administrator accounts can activate panic lockout' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const adminId = session.userId || body.adminId;

    if (!adminId) {
      if (deviceStore?.lastSyncPromise) {
        await deviceStore.lastSyncPromise;
      }
      return NextResponse.json(
        { error: 'Missing administrator ID for panic lock' },
        { status: 400 }
      );
    }

    // Verify target is admin
    const targetAdmin = await deviceStore.getUserByEmailOrId(adminId);
    if (!targetAdmin || targetAdmin.role !== UserRole.ADMIN) {
      if (deviceStore?.lastSyncPromise) {
        await deviceStore.lastSyncPromise;
      }
      return NextResponse.json(
        { error: 'Only root administrator accounts can activate panic lockout' },
        { status: 403 }
      );
    }

    deviceStore.lockAdministrator(targetAdmin.id, session?.userId || 'PANIC_TRIGGER');

    // Clear session cookie immediately
    cookies().delete('securemesh_session');

    
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({
      success: true,
      message: 'CRITICAL SECURITY ACTION: Administrator account is locked. All sessions revoked and device suspended. Emergency recovery ceremony is required to re-establish access.',
      adminLocked: true,
    });
  } catch (error: any) {
    console.error('[Admin Panic Error]:', error);
    
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json(
      { error: error.message || 'Failed to trigger panic lock' },
      { status: 500 }
    );
  }
}
