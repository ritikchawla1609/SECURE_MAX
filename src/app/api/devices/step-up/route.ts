import { NextResponse } from 'next/server';
import { getVerifiedSession } from '@/lib/auth/session';
import { deviceStore } from '@/lib/auth/deviceStore';

export async function POST(req: Request) {
  
  
  if (typeof deviceStore !== 'undefined') {
    await deviceStore.loadFromCloud();
  }
  try {
    const session = await getVerifiedSession();
    const body = await req.json().catch(() => ({}));
    const { deviceId, assetId } = body;

    const targetDeviceId = deviceId || session.deviceId;
    if (!targetDeviceId) {
      
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json(
        { error: 'Missing deviceId parameter for step-up authentication' },
        { status: 400 }
      );
    }

    const result = deviceStore.verifyStepUpAuthentication({
      userId: session.userId,
      deviceId: targetDeviceId,
      assetId,
    });

    
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({
      success: true,
      message: 'Step-up authentication verified successfully. Temporary Server-Side KMS decryption permit granted.',
      authorized: result.authorized,
      decryptionToken: result.token,
      expiresAt: result.expiresAt,
    });
  } catch (error: any) {
    console.error('[Step-Up Auth Error]:', error);
    
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json(
      { error: error.message || 'Step-up authentication failed' },
      { status: 403 }
    );
  }
}
