import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createChallenge } from '@/lib/crypto/p256';
import { deviceStore } from '@/lib/auth/deviceStore';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: Request) {
  
  
  if (typeof deviceStore !== 'undefined') {
    await deviceStore.loadFromCloud();
  }
  try {
    const body = await req.json().catch(() => ({}));
    const type: 'P256' | 'ETHEREUM' = (body.type === 'ETHEREUM' || body.type === 'METAMASK' || body.walletAddress) ? 'ETHEREUM' : 'P256';
    const walletAddress = body.walletAddress ? String(body.walletAddress).toLowerCase().trim() : undefined;
    const identifier = (walletAddress || body.identifier || body.email || body.userId || (type === 'ETHEREUM' ? 'admin' : 'client')).toLowerCase().trim();

    const record = deviceStore.createChallengeRecord({
      identifier,
      type,
      walletAddress,
      userId: body.userId,
      deviceId: body.deviceId,
      ttlSeconds: 120, // 2-minute short-lived challenge
    });

    cookies().set('auth_nonce', record.challengeId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/auth',
      maxAge: 120,
    });

    
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({
      challengeId: record.challengeId,
      challengeToken: record.nonce,
      nonce: record.nonce,
      message: record.message,
      expiresAt: record.expiresAt,
      type: record.type,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    console.error('[Challenge API Error]:', error);
    
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({ error: 'Failed to generate cryptographic challenge' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  if (typeof deviceStore !== 'undefined') {
    await deviceStore.loadFromCloud();
  }
  try {
    const { searchParams } = new URL(req.url);
    const typeParam = searchParams.get('type')?.toUpperCase();
    const type: 'P256' | 'ETHEREUM' = (typeParam === 'ETHEREUM' || typeParam === 'METAMASK' || searchParams.get('walletAddress')) ? 'ETHEREUM' : 'P256';
    const walletAddress = searchParams.get('walletAddress')?.toLowerCase().trim();
    const identifier = (walletAddress || searchParams.get('identifier') || searchParams.get('email') || (type === 'ETHEREUM' ? 'admin' : 'client')).toLowerCase().trim();

    const record = deviceStore.createChallengeRecord({
      identifier,
      type,
      walletAddress,
      ttlSeconds: 120,
    });

    cookies().set('auth_nonce', record.challengeId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/auth',
      maxAge: 120,
    });

    
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({
      challengeId: record.challengeId,
      challengeToken: record.nonce,
      nonce: record.nonce,
      message: record.message,
      expiresAt: record.expiresAt,
      type: record.type,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({ error: 'Internal challenge error' }, { status: 500 });
  }
}
