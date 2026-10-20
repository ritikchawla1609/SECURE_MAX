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
  role: 'USER' | 'MANAGER' | 'AUDITOR';
  deviceName?: string;
}): Promise<AdminCreateUserResult> {
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
    const role = formData.role === 'AUDITOR' 
      ? UserRole.AUDITOR 
      : formData.role === 'MANAGER' 
      ? UserRole.MANAGER 
      : UserRole.USER;
    const positionId = formData.role === 'AUDITOR' 
      ? 'pos_auditor' 
      : formData.role === 'MANAGER' 
      ? 'pos_manager' 
      : 'pos_user';
    const positionName = formData.role === 'AUDITOR' 
      ? 'Auditor' 
      : formData.role === 'MANAGER' 
      ? 'Manager' 
      : 'User';

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

    // Generate a starter enrollment code for device pairing
    const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
    const code = `SMX-${randomHex.slice(0, 4)}-${randomHex.slice(4)}`;
    
    deviceStore.enrollments.set(code, {
      code,
      user_id: newUser.id,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date().toISOString(),
    });

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
        role: newUser.role === UserRole.AUDITOR ? 'Auditor' : 'Team Member',
        did: newUser.did,
        status: 'Active',
        enrollmentCode: code,
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
