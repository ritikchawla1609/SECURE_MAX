import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SignJWT } from 'jose';
import { deviceStore } from '@/lib/auth/deviceStore';
import { getJwtSecret } from '@/lib/auth/session';
import { UserRole } from '@/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: Request) {
  
  
  if (typeof deviceStore !== 'undefined') {
    await deviceStore.loadFromCloud();
  }
  // CRITICAL PRODUCTION GUARD
  if (process.env.NODE_ENV === 'production') {
    
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json(
      { error: 'ACCESS DENIED: Demo bypass authentication is strictly disabled in production environments.' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const requestedRole = (body.role as UserRole) || UserRole.ADMIN;

    let targetEmail = 'admin@securemax.mil';
    if (requestedRole === UserRole.USER) targetEmail = 'vasu@securemax.mil';
    if (requestedRole === UserRole.AUDITOR) targetEmail = 'auditor@securemax.mil';

    const user = await deviceStore.getUserByEmail(targetEmail);
    if (!user) {
      
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({ error: 'Demo user record not found' }, { status: 404 });
    }

    const devices = deviceStore.getDevicesForUser(user.id);
    const activeDevice = devices.find(d => d.status === 'ACTIVE') || devices[0] || null;

    if (!activeDevice) {
      
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({ error: 'No active device configured for demo user' }, { status: 400 });
    }

    // Establish stateful session
    const session = await deviceStore.createSession({
      userId: user.id,
      deviceId: activeDevice.id,
      authLevel: user.role === UserRole.ADMIN ? 'WEBAUTHN' : 'P256',
      durationHours: 8,
    });

    deviceStore.recordLogin({
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      role: user.role,
      deviceName: activeDevice.device_name || 'Verified Demo Terminal',
      status: 'SUCCESS',
    });

    const jwtSecret = getJwtSecret();
    const sessionToken = await new SignJWT({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      did: user.did,
      deviceId: activeDevice.id,
      deviceName: activeDevice.device_name || 'Verified Demo Terminal',
      sessionId: session.session_id,
      assuranceLevel: user.role === UserRole.ADMIN ? 'LEVEL_3' : 'LEVEL_2',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('8h')
      .sign(jwtSecret);

    cookies().set('securemesh_session', sessionToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 8 * 60 * 60, // 8 hours
    });

    
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        did: user.did,
        device: { id: activeDevice.id, name: activeDevice.device_name },
      },
    });
  } catch (error: any) {
    console.error('[Demo Login Error]:', error);
    
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({ error: 'Failed to create demo session' }, { status: 500 });
  }
}
