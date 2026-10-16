import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SignJWT } from 'jose';
import crypto from 'crypto';
import { deviceStore } from '@/lib/auth/deviceStore';
import { getVerifiedSession } from '@/lib/auth/session';
import { UserRole, UserStatus } from '@/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'securemax-dev-jwt-secret-minimum-32-chars-long-secure-padding');

/**
 * GET /api/admin/bootstrap
 * State-aware endpoint to query system initialization status.
 */
export async function GET() {
  if (typeof deviceStore !== 'undefined') {
    await deviceStore.loadFromCloud();
  }
  try {
    const isInitialized = deviceStore.isSystemInitialized();
    const adminCount = deviceStore.getAdminCount();
    const settings = deviceStore.getSystemSettings();

    
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({
      initialized: isInitialized,
      adminCount,
      bootstrapEnabled: settings.bootstrap_enabled,
      systemState: settings.system_state,
      organization: settings.organization || null,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      }
    });
  } catch (error: any) {
    
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({ error: error.message || 'Failed to query bootstrap state' }, { status: 500 });
  }
}

/**
 * POST /api/admin/bootstrap
 * One-time deployment bootstrap to establish root administrative identity.
 * Rejects if an admin already exists or if system is locked.
 */
export async function POST(req: Request) {
  
  
  if (typeof deviceStore !== 'undefined') {
    await deviceStore.loadFromCloud();
  }
  try {
    const body = await req.json().catch(() => ({}));
    const {
      orgName,
      orgId,
      orgType,
      country,
      timezone,
      adminName,
      adminId,
      email,
      phone,
      department,
      designation,
      deviceName,
      deviceType,
      os,
      browser,
      publicKey,
      credentialId,
      bootstrapSecret,
      adminWallet,
    } = body;

    // Strict validation
    if (!orgName || !adminName || !email || !publicKey) {
      
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json(
        { error: 'Missing required bootstrap fields: organization name, administrator name, official email, and device public key are required.' },
        { status: 400 }
      );
    }

    // Attempt root admin bootstrap
    const result = deviceStore.bootstrapRootAdmin({
      orgName: String(orgName).trim(),
      orgId: orgId ? String(orgId).trim() : undefined,
      orgType: orgType ? String(orgType).trim() : 'Company',
      country: country ? String(country).trim() : 'India',
      timezone: timezone ? String(timezone).trim() : 'Asia/Kolkata',
      adminName: String(adminName).trim(),
      adminId: adminId ? String(adminId).trim() : 'ADM-0001',
      email: String(email).trim().toLowerCase(),
      phone: phone ? String(phone).trim() : undefined,
      department: department ? String(department).trim() : undefined,
      designation: designation ? String(designation).trim() : 'Chief Administrator',
      deviceName: deviceName ? String(deviceName).trim() : 'SecureMAX Admin Laptop',
      deviceType: deviceType ? String(deviceType).trim() : 'laptop',
      os: os ? String(os).trim() : 'macOS',
      browser: browser ? String(browser).trim() : 'Chrome',
      publicKey: String(publicKey).trim(),
      credentialId: credentialId ? String(credentialId).trim() : undefined,
      bootstrapSecret: bootstrapSecret ? String(bootstrapSecret).trim() : undefined,
      adminWallet: adminWallet ? String(adminWallet).trim().toLowerCase() : undefined,
    });

    // Issue SecureMAX 8-Hour Root Admin Session with LEVEL 3 assurance
    const sessionId = crypto.randomUUID();
    const sessionToken = await new SignJWT({
      userId: result.rootAdmin.id,
      email: result.rootAdmin.email,
      name: result.rootAdmin.name,
      role: UserRole.ADMIN,
      did: result.rootAdmin.did,
      deviceId: result.adminDevice.id,
      deviceName: result.adminDevice.device_name,
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
      maxAge: 8 * 60 * 60, // 8 hours
    });

    
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({
      success: true,
      message: 'SecureMAX Root Administrator successfully initialized and device enrolled.',
      rootAdmin: {
        id: result.rootAdmin.id,
        name: result.rootAdmin.name,
        email: result.rootAdmin.email,
        role: result.rootAdmin.role,
        position: result.rootAdmin.position,
        did: result.rootAdmin.did,
      },
      adminDevice: {
        id: result.adminDevice.id,
        deviceName: result.adminDevice.device_name,
        deviceType: result.adminDevice.device_type,
        os: result.adminDevice.os,
        browser: result.adminDevice.browser,
        status: result.adminDevice.status,
      },
      recoveryPackage: result.recoveryPackage,
    });
  } catch (error: any) {
    console.error('[Admin Bootstrap Error]:', error);
    
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json(
      { error: error.message || 'Bootstrap initialization failed' },
      { status: 403 }
    );
  }
}
