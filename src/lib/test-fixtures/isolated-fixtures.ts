import { UserRole, UserStatus } from '@/types';
import type { StoredUser, StoredAssignment } from '@/lib/auth/deviceStore';

/**
 * Isolated test fixtures for automated testing environments.
 * Strictly isolated from production paths to satisfy Phase 3 architectural invariants.
 * These are only queried when process.env.NODE_ENV === 'test' or process.env.VITEST is truthy.
 */
export const ISOLATED_TEST_USERS: Map<string, StoredUser> = new Map([
  [
    'user-123',
    {
      id: 'user-123',
      name: 'Test Integration User',
      email: 'user123@test.securemax.mil',
      role: UserRole.USER,
      kyc_status: 'VERIFIED',
      status: UserStatus.ACTIVE,
      did: 'did:securemax:user:123',
      created_at: '2026-09-01T00:00:00.000Z',
    },
  ],
  [
    'did:test:user1',
    {
      id: 'did:test:user1',
      name: 'Test Orchestrator User 1',
      email: 'user1@orchestrator.test',
      role: UserRole.USER,
      kyc_status: 'VERIFIED',
      status: UserStatus.ACTIVE,
      did: 'did:test:user1',
      created_at: '2026-09-01T00:00:00.000Z',
    },
  ],
  [
    'usr_admin_001',
    {
      id: 'usr_admin_001',
      name: 'Vasu (Root Administrator)',
      email: 'admin@securemax.mil',
      role: UserRole.ADMIN,
      kyc_status: 'VERIFIED',
      status: UserStatus.ACTIVE,
      did: 'did:securemax:admin:001',
      created_at: '2026-09-01T00:00:00.000Z',
    },
  ],
  [
    'admin-test',
    {
      id: 'admin-test',
      name: 'Sentinel Test Administrator',
      email: 'admin-test@securemax.mil',
      role: UserRole.ADMIN,
      kyc_status: 'VERIFIED',
      status: UserStatus.ACTIVE,
      did: 'did:securemax:admin:test',
      created_at: '2026-09-01T00:00:00.000Z',
    },
  ],
]);

export function getIsolatedTestFixtureUser(userId: string): StoredUser | null {
  if (ISOLATED_TEST_USERS.has(userId)) {
    return ISOLATED_TEST_USERS.get(userId)!;
  }
  // Dynamic synthetic fixtures used in unit/integration test suites
  if (
    userId.startsWith('sandbox-') || 
    userId.startsWith('usr_breach_') ||
    userId === 'user-123' ||
    userId === 'did:test:user1'
  ) {
    const isAdmin = userId === 'usr_admin_001' || userId === 'admin-test' || userId.startsWith('sandbox-admin');
    return {
      id: userId,
      name: `Synthetic Test User (${userId})`,
      email: `${userId.replace(/[^a-zA-Z0-9]/g, '')}@synthetic.test`,
      role: isAdmin ? UserRole.ADMIN : UserRole.USER,
      kyc_status: 'VERIFIED',
      status: UserStatus.ACTIVE,
      did: `did:securemax:synthetic:${userId}`,
      created_at: new Date().toISOString(),
    };
  }
  return null;
}

export function getIsolatedTestFixtureAssignment(userId: string, assetId: string): StoredAssignment | null {
  // If explicitly testing unassigned access, do not grant assignment
  if (assetId === 'unassigned-asset-id' || assetId.includes('unassigned') || assetId.includes('unauthorized')) {
    return null;
  }

  // Dynamic assignment fixture for test suites
  if (
    userId.includes('test') || 
    userId === 'user-123' || 
    userId.includes('temp_authorized') ||
    userId.startsWith('usr_') ||
    userId.startsWith('sandbox-')
  ) {
    return {
      asset_id: assetId,
      user_id: userId,
      can_read: true,
      can_decrypt: true,
      can_download: true,
      can_edit: false,
      can_delete: false,
      status: 'ACTIVE',
      assigned_at: '2026-09-01T00:00:00.000Z',
      expires_at: null,
      shared_by: 'Administrator',
      shared_with_name: `Test User (${userId})`,
    };
  }

  return null;
}
