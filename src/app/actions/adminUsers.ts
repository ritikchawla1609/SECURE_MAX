'use server';

import { deviceStore, StoredUser } from '@/lib/auth/deviceStore';
import { UserRole, UserStatus } from '@/types';
import crypto from 'crypto';
import { syncUserToSupabase } from '@/lib/db/supabase-sync';

export interface AdminCreateUserResult {
  success: boolean;
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
    did: string;
    status: string;
    enrollmentCode?: string;
  };
  error?: string;
}

export async function getRegisteredPersonnel() {
  if (typeof deviceStore !== 'undefined') {
    deviceStore.loadFromDisk(true);
    await deviceStore.loadFromCloud();
  }
  const users: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    did: string;
    status: string;
    created_at: string;
  }> = [];

  for (const user of deviceStore.users.values()) {
    // Deduplicate by ID
    if (!users.some(u => u.id === user.id)) {
      users.push({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        did: user.did,
        status: user.status,
        created_at: user.created_at,
      });
    }
  }

  return users;
}

export async function registerNewUserByAdmin(formData: {
  name: string;
  email: string;
  role?: 'USER' | 'MANAGER' | 'AUDITOR' | 'ENGINEER' | 'ADMIN' | string;
  deviceName?: string;
  department?: string;
}): Promise<AdminCreateUserResult> {
  if (typeof deviceStore !== 'undefined') {
    deviceStore.loadFromDisk(true);
    await deviceStore.loadFromCloud();
  }
  try {
    const cleanEmail = String(formData.email || '').toLowerCase().trim();
    const cleanName = String(formData.name || '').trim();

    if (!cleanEmail || !cleanName) {
      if (deviceStore?.lastSyncPromise) {
        await deviceStore.lastSyncPromise;
      }
      return { success: false, error: 'Please enter both a name and an email address.' };
    }

    const existing = await deviceStore.getUserByEmail(cleanEmail);
    if (existing) {
      if (deviceStore?.lastSyncPromise) {
        await deviceStore.lastSyncPromise;
      }
      return { success: false, error: `A team member with email ${cleanEmail} is already registered.` };
    }

    const userId = 'usr_' + crypto.randomUUID().slice(0, 8);
    const did = `did:securemax:user:${userId.slice(-6)}`;
    const roleInput = String(formData.role || 'USER').toUpperCase();
    
    let role: UserRole = UserRole.USER;
    let positionId = 'pos_user';
    let positionName = 'Standard User';

    if (roleInput === 'ADMIN') {
      role = UserRole.ADMIN;
      positionId = 'pos_admin';
      positionName = 'Administrator';
    } else if (roleInput === 'AUDITOR') {
      role = UserRole.AUDITOR;
      positionId = 'pos_auditor';
      positionName = 'Auditor';
    } else if (roleInput === 'MANAGER') {
      role = UserRole.MANAGER;
      positionId = 'pos_manager';
      positionName = 'Manager';
    } else if (roleInput === 'ENGINEER') {
      role = UserRole.ENGINEER;
      positionId = 'pos_engineer';
      positionName = 'Lead Engineer';
    } else if (formData.department) {
      positionName = formData.department;
    }

    const newUser: StoredUser = {
      id: userId,
      name: cleanName,
      email: cleanEmail,
      role,
      position: positionName,
      position_id: positionId,
      kyc_status: 'VERIFIED',
      status: UserStatus.ACTIVE,
      did,
      created_at: new Date().toISOString(),
    };

    deviceStore.users.set(newUser.id, newUser);
    deviceStore.users.set(newUser.email, newUser);

    // Record in permanent cryptographic audit ledger
    await deviceStore.recordAuditEvent({
      eventType: 'USER_IDENTITY_REGISTERED',
      description: `Admin registered new identity: ${newUser.name} (${positionName}). DID: ${newUser.did}`,
      targetId: newUser.id,
      userEmail: newUser.email,
      userName: newUser.name,
      severity: 'INFO',
    });

    // Generate enrollment capability for device pairing
    let enrollmentCode = '';
    try {
      const { enrollment, plaintextCode } = deviceStore.createEnrollmentCapability({
        userId: newUser.id,
        positionId,
        durationMinutes: 1440, // 24 hours validity
        maxDevices: 1,
        callerUserId: 'ADM-0001',
        callerRole: UserRole.ADMIN,
      });
      enrollmentCode = plaintextCode;

      deviceStore.enrollments.set(plaintextCode, {
        code: plaintextCode,
        user_id: newUser.id,
        expires_at: enrollment.expires_at,
        created_at: enrollment.created_at,
      });
      const prefixed = plaintextCode.startsWith('SMX-') ? plaintextCode : `SMX-${plaintextCode}`;
      deviceStore.enrollments.set(prefixed, {
        code: prefixed,
        user_id: newUser.id,
        expires_at: enrollment.expires_at,
        created_at: enrollment.created_at,
      });
    } catch {
      const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
      enrollmentCode = `SMX-${randomHex.slice(0, 4)}-${randomHex.slice(4)}`;
      deviceStore.enrollments.set(enrollmentCode, {
        code: enrollmentCode,
        user_id: newUser.id,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
      });
    }

    deviceStore.saveToDisk();
    syncUserToSupabase(newUser).catch(() => {});

    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return {
      success: true,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.position || (newUser.role === UserRole.AUDITOR ? 'Auditor' : 'Team Member'),
        did: newUser.did,
        status: 'Active',
        enrollmentCode,
      },
    };
  } catch (err: any) {
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return {
      success: false,
      error: err.message || 'Failed to register user.',
    };
  }
}
