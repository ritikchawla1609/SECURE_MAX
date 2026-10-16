import { NextResponse } from 'next/server';
import { getVerifiedSession } from '@/lib/auth/session';
import { deviceStore } from '@/lib/auth/deviceStore';

export async function GET() {
  if (typeof deviceStore !== 'undefined') {
    await deviceStore.loadFromCloud();
  }
  
  
  if (typeof deviceStore !== 'undefined') {
    await deviceStore.loadFromCloud();
  }
  try {
    const session = await getVerifiedSession();
    const user = session?.userId ? await deviceStore.getUserById(session.userId) : null;
    
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({ 
      session,
      user: user ? {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        position: user.position || user.role,
        did: user.did,
        admin_wallet: user.admin_wallet,
        status: user.status,
      } : null
    });
  } catch (error) {
    
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({ session: null, user: null });
  }
}
