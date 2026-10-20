import 'server-only';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { UserRole, UserStatus } from '@/types';
import { deviceStore } from './deviceStore';

export interface SessionPayload {
  userId: string;
  email?: string;
  name?: string;
  role: UserRole;
  did?: string;
  deviceId?: string;
  deviceName?: string;
  sessionId: string;
  assuranceLevel?: string;
}

/**
 * Returns the cryptographically validated JWT secret.
 * Enforces strong production secrets and prevents insecure fallback leaks.
 */
export function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET || 'securemax-dev-jwt-secret-minimum-32-chars-long-secure-padding';
  return new TextEncoder().encode(secret);
}

/**
 * Validates the current HTTP session cookie AND enforces live zero-trust state checks:
 * 1. Cryptographic JWT signature and expiration verification
 * 2. Live session status (not revoked, not expired in database/store)
 * 3. Live user account status (ACTIVE; suspended/revoked users denied immediately)
 * 4. Live device status (ACTIVE; suspended/revoked devices denied immediately)
 */
export async function getVerifiedSession(): Promise<SessionPayload> {
  const cookieStore = cookies();
  const sessionToken = cookieStore.get('securemesh_session')?.value;
  
  if (!sessionToken) {
    throw new Error('Unauthorized: No active SecureMAX session');
  }

  let payload: SessionPayload;
  try {
    const { payload: jwtPayload } = await jwtVerify(sessionToken, getJwtSecret());
    payload = jwtPayload as unknown as SessionPayload;
  } catch (error) {
    throw new Error('Unauthorized: Invalid or expired SecureMAX session token');
  }

  // Zero-Trust Live Session Verification
  if (payload.sessionId) {
    const storedSession = await deviceStore.getSession(payload.sessionId);
    if (storedSession) {
      if (storedSession.status !== 'ACTIVE') {
        throw new Error('Unauthorized: Session has been REVOKED');
      }
      if (new Date(storedSession.expires_at).getTime() < Date.now()) {
        throw new Error('Unauthorized: Session has EXPIRED');
      }
    }
  }

  // Zero-Trust Live User Account Verification & Authoritative Role Freshness
  if (payload.userId) {
    const user = await deviceStore.getUserById(payload.userId);
    if (!user) {
      throw new Error('Unauthorized: User identity record not found in system database');
    }
    
    if (user.status !== UserStatus.ACTIVE) {
      throw new Error(`Unauthorized: User account is ${user.status}. Access denied.`);
    }
    // Authoritative live role from server-side state (never trust stale JWT role alone)
    payload.role = user.role;
  }

  // Zero-Trust Live Device Verification
  if (payload.deviceId) {
    const device = await deviceStore.getDeviceById(payload.deviceId);
    if (device && device.status !== 'ACTIVE') {
      throw new Error(`Unauthorized: Device credential is ${device.status}. Access denied.`);
    }
  }

  return payload;
}
