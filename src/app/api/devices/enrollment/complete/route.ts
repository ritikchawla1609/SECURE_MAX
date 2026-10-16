import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SignJWT } from 'jose';
import { deviceStore } from '@/lib/auth/deviceStore';
import { getJwtSecret } from '@/lib/auth/session';

export async function POST(req: Request) {
  
  
  if (typeof deviceStore !== 'undefined') {
    await deviceStore.loadFromCloud();
  }
  try {
    const body = await req.json().catch(() => ({}));
    const { 
      enrollmentCode, 
      deviceName, 
      publicKey, 
      deviceId,
      deviceType,
      os,
      browser,
      browserVersion,
      model,
      region,
      credentialId,
      credentialType
    } = body;

    if (!enrollmentCode || !publicKey) {
      return NextResponse.json(
        { error: 'Missing required parameters: enrollmentCode and publicKey are mandatory' },
        { status: 400 }
      );
    }

    // Consume enrollment capability and create Device Passport
    let result: { passport: any; user: any };
    try {
      result = deviceStore.consumeEnrollmentCapability(enrollmentCode, {
        deviceName: deviceName || 'Enrolled Device',
        deviceType,
        os,
        browser,
        browserVersion,
        model,
        region,
        publicKey,
        credentialId,
        credentialType: credentialType || 'WebAuthn',
        customDeviceId: deviceId,
      });
    } catch (err: any) {
    // Critical for Vercel: Wait for the ledger cloud sync to complete before Lambda freezes 
    if (deviceStore.lastSyncPromise) { 
      await deviceStore.lastSyncPromise; 
    } 

      return NextResponse.json({ error: err.message || 'Invalid or expired enrollment code' }, { status: 400 });
    }

    const { passport, user } = result;

    // Optional: update name if user customized it during registration
    if (body.name && typeof body.name === 'string' && body.name.trim() && user.name !== body.name.trim()) {
      user.name = body.name.trim();
    }

    // Create active session for the newly registered device
    const session = await deviceStore.createSession({
      userId: user.id,
      deviceId: passport.device_id,
      position: passport.position,
      authLevel: 'PASSKEY',
      durationHours: 8,
    });

    // Issue SecureMAX 8-Hour Session cookie
    const sessionId = session.session_id;
    const assuranceLevel = user.role === 'ADMIN' ? 'LEVEL_3' : 'LEVEL_2';

    const sessionToken = await new SignJWT({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      did: user.did,
      deviceId: passport.device_id,
      deviceName: passport.device_name,
      sessionId,
      assuranceLevel,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('8h')
      .sign(getJwtSecret());

    cookies().set('securemesh_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 8 * 60 * 60, // 8 hours
    });

    // Critical for Vercel: Wait for the ledger cloud sync to complete before Lambda freezes 
    if (deviceStore.lastSyncPromise) { 
      await deviceStore.lastSyncPromise; 
    } 

    return NextResponse.json({
      success: true,
      message: `Device "${passport.device_name}" successfully linked to SecureMAX identity`,
      passport,
      device: {
        id: passport.device_id,
        name: passport.device_name,
        status: passport.status,
        risk_state: passport.risk_state,
        registration_region: passport.registration_region,
      },
      session: {
        id: session.session_id,
        expiresAt: session.expires_at,
      },
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        did: user.did,
        role: user.role,
        position: passport.position,
      },
    });
  } catch (error: any) {
    console.error('[Enrollment Complete Error]:', error);
    // Critical for Vercel: Wait for the ledger cloud sync to complete before Lambda freezes 
    if (deviceStore.lastSyncPromise) { 
      await deviceStore.lastSyncPromise; 
    } 

    return NextResponse.json({ error: error.message || 'Failed to complete device enrollment' }, { status: 500 });
  }
}
