import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SignJWT } from 'jose';
import crypto from 'crypto';
import { deviceStore } from '@/lib/auth/deviceStore';
import { getJwtSecret } from '@/lib/auth/session';
import { UserRole, UserStatus } from '@/types';
import { syncUserToSupabase } from '@/lib/db/supabase-sync';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: Request) {
  
  
  if (typeof deviceStore !== 'undefined') {
    await deviceStore.loadFromCloud();
  }
  try {
    const body = await req.json().catch(() => ({}));
    const { email, name, publicKey, deviceName, role: requestedRole, deviceType, os, browser } = body;

    if (!email || !name || !publicKey) {
      
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json(
        { error: 'Missing required registration fields (email, name, publicKey required)' },
        { status: 400 }
      );
    }

    const cleanEmail = String(email).toLowerCase().trim();
    const existing = await deviceStore.getUserByEmail(cleanEmail);
    if (existing) {
      
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({ error: 'User already registered with this email address' }, { status: 409 });
    }

    // Zero-Trust: Public self-registration ALWAYS defaults to USER.
    // Privileged roles (ADMIN, MANAGER, AUDITOR) require Administrator approval / enrollment.
    const userRole = UserRole.USER;

    const userId = 'usr_' + crypto.randomUUID().slice(0, 8);
    const did = `did:securemax:user:${userId.slice(-6)}`;

    // INITIAL KYC STATUS MUST BE PENDING (Zero-Trust)
    const newUser = {
      id: userId,
      name: String(name).trim(),
      email: cleanEmail,
      role: userRole,
      kyc_status: 'PENDING' as const,
      status: UserStatus.ACTIVE,
      did,
      created_at: new Date().toISOString(),
    };

    deviceStore.users.set(newUser.id, newUser);
    deviceStore.users.set(newUser.email, newUser);
    syncUserToSupabase(newUser).catch(() => {});

    // Enroll initial device credential
    const device = await deviceStore.registerDevice({
      userId: newUser.id,
      deviceName: deviceName || 'Primary Enrolled Device',
      publicKey: String(publicKey).trim(),
      isAdminDevice: false,
    });

    // Record audit trails
    await deviceStore.recordAuditEvent({
      eventType: 'USER_IDENTITY_REGISTERED',
      description: `New identity registered: ${newUser.name} (${newUser.role}) with status PENDING KYC - ${newUser.did}`,
      targetId: newUser.id,
      userEmail: newUser.email,
      userName: newUser.name,
      severity: 'INFO',
    });

    await deviceStore.recordAuditEvent({
      eventType: 'HARDWARE_DEVICE_ENROLLED',
      description: `Primary device credential enrolled: ${device.device_name} (${device.algorithm})`,
      targetId: device.id,
      userEmail: newUser.email,
      userName: newUser.name,
      severity: 'INFO',
    });

    // Establish stateful session
    const session = await deviceStore.createSession({
      userId: newUser.id,
      deviceId: device.id,
      authLevel: 'P256',
      durationHours: 8,
    });

    deviceStore.saveToDisk();

    // Issue SecureMAX 8-Hour Session Token
    const jwtSecret = getJwtSecret();
    const sessionToken = await new SignJWT({
      userId: newUser.id,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role,
      did: newUser.did,
      deviceId: device.id,
      deviceName: device.device_name,
      sessionId: session.session_id,
      assuranceLevel: 'LEVEL_2',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('8h')
      .sign(jwtSecret);

    cookies().set('securemesh_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
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
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        did: newUser.did,
        role: newUser.role,
        kycStatus: newUser.kyc_status,
        device: {
          id: device.id,
          name: device.device_name,
        },
      },
    });
  } catch (error: any) {
    console.error('[Register API Error]:', error);
    
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({ error: error.message || 'Registration failed' }, { status: 500 });
  }
}
