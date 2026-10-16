import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SignJWT } from 'jose';
import crypto from 'crypto';
import { deviceStore } from '@/lib/auth/deviceStore';
import { UserRole } from '@/types';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'securemax-dev-jwt-secret-minimum-32-chars-long-secure-padding');

/**
 * POST /api/admin/recovery
 * Emergency Recovery Ceremony: Restores root administrator access if device is lost or compromised.
 * Uses 2-factor recovery: Offline Recovery Code (Factor A) + Deployment Secret (Factor B).
 */
export async function POST(req: Request) {
  
  
  if (typeof deviceStore !== 'undefined') {
    await deviceStore.loadFromCloud();
  }
  try {
    const body = await req.json().catch(() => ({}));
    const {
      adminId,
      recoveryCode,
      bootstrapSecret,
      newDeviceName,
      newPublicKey,
      newDeviceType,
      os,
      browser,
    } = body;

    if (!adminId || !recoveryCode || !newPublicKey) {
      
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json(
        { error: 'Missing required recovery parameters: admin ID, recovery code, and new device public key are required.' },
        { status: 400 }
      );
    }

    const result = deviceStore.emergencyRecovery({
      adminId: String(adminId).trim(),
      recoveryCode: String(recoveryCode).trim(),
      bootstrapSecret: bootstrapSecret ? String(bootstrapSecret).trim() : undefined,
      newDeviceName: newDeviceName ? String(newDeviceName).trim() : 'SecureMAX Replacement Admin Laptop',
      newPublicKey: String(newPublicKey).trim(),
      newDeviceType: newDeviceType ? String(newDeviceType).trim() : 'laptop',
      os: os ? String(os).trim() : 'macOS',
      browser: browser ? String(browser).trim() : 'Chrome',
    });

    const adminUser = await deviceStore.getUserByEmailOrId(adminId);
    if (!adminUser) {
      throw new Error('Admin user resolution error post-recovery.');
    }

    // Issue new 8-Hour Session with LEVEL 3 assurance
    const sessionId = crypto.randomUUID();
    const sessionToken = await new SignJWT({
      userId: adminUser.id,
      email: adminUser.email,
      name: adminUser.name,
      role: UserRole.ADMIN,
      did: adminUser.did,
      deviceId: result.newDevice.id,
      deviceName: result.newDevice.device_name,
      sessionId,
      assuranceLevel: 'LEVEL_3',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('8h')
      .sign(JWT_SECRET);

    cookies().set('securemesh_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 8 * 60 * 60,
    });

    
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({
      success: true,
      message: 'Emergency recovery ceremony completed. Previous credentials revoked and new device securely enrolled.',
      newDevice: {
        id: result.newDevice.id,
        deviceName: result.newDevice.device_name,
        deviceType: result.newDevice.device_type,
        status: result.newDevice.status,
      },
      newRecoveryPackage: result.newRecoveryPackage,
    });
  } catch (error: any) {
    console.error('[Admin Emergency Recovery Error]:', error);
    
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json(
      { error: error.message || 'Emergency recovery ceremony failed' },
      { status: 403 }
    );
  }
}
