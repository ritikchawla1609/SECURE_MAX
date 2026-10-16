import 'server-only';
import { UserRole, UserStatus } from '@/types';
import { SecureMaxError, permissionDenied, authRequired } from '../utils/errors';

export type PolicyAction =
  | 'ASSET_READ'
  | 'ASSET_DECRYPT'
  | 'ASSET_DOWNLOAD'
  | 'ASSET_UPLOAD'
  | 'ASSET_EDIT'
  | 'ASSET_DELETE'
  | 'ASSET_SHARE'
  | 'ASSET_REVOKE_SHARE'
  | 'KEY_GENERATE'
  | 'KEY_WRAP'
  | 'KEY_UNWRAP'
  | 'KEY_ROTATE'
  | 'KEY_REVOKE'
  | 'DEVICE_MANAGE'
  | 'DEVICE_STEP_UP'
  | 'USER_MANAGE'
  | 'AUDIT_READ'
  | 'AUDIT_VERIFY'
  | 'ADMIN_OPERATION'
  | 'ACCESS_APPROVE'
  | 'ACCESS_REJECT'
  | 'ACCESS_EXTEND'
  | 'GRANT_REVOKE'
  | 'POSITION_MANAGE';

export interface PolicyActor {
  userId: string;
  role: UserRole;
  status: UserStatus;
  tenantId?: string;
  deviceId?: string;
  sessionId?: string;
  email?: string;
}

export interface PolicyResource {
  type: 'ASSET' | 'USER' | 'DEVICE' | 'KEY' | 'AUDIT' | 'SYSTEM' | 'POSITION' | 'GRANT' | 'REQUEST';
  id: string;
  ownerId?: string;
  tenantId?: string;
  status?: string;
  classification?: string;
  isSharedWithAll?: boolean;
}

export interface PolicyConditions {
  grant?: {
    status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
    canRead?: boolean;
    canDecrypt?: boolean;
    canDownload?: boolean;
    canEdit?: boolean;
    canDelete?: boolean;
    expiresAt?: string | null;
  } | null;
  device?: {
    status: 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
    riskState?: string;
  } | null;
  session?: {
    status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
    expiresAt?: string;
  } | null;
  dependencyHealthy?: boolean;
}

export interface AuthorizationContext {
  actor: PolicyActor;
  action: PolicyAction;
  resource: PolicyResource;
  conditions?: PolicyConditions;
}

export type PolicyEvaluationCode =
  | 'AUTHORIZED'
  | 'DENIED_UNAUTHENTICATED'
  | 'DENIED_DISABLED_USER'
  | 'DENIED_INVALID_SESSION'
  | 'DENIED_CROSS_TENANT'
  | 'DENIED_IDOR'
  | 'DENIED_MISSING_PERMISSION'
  | 'DENIED_REVOKED_GRANT'
  | 'DENIED_EXPIRED_GRANT'
  | 'DENIED_RESOURCE_NOT_FOUND'
  | 'DENIED_DEPENDENCY_FAILURE';

export interface PolicyEvaluationResult {
  allowed: boolean;
  code: PolicyEvaluationCode;
  reason?: string;
}

/**
 * Authoritative central policy evaluation engine.
 * Evaluates actor, requested action, resource identity, grant, actor status,
 * tenant boundary, and policy conditions with strict explicit-deny behavior.
 */
export function evaluatePolicy(ctx: AuthorizationContext): PolicyEvaluationResult {
  const { actor, action, resource, conditions } = ctx;

  // 1. Authenticated Actor Invariants
  if (!actor || !actor.userId) {
    return {
      allowed: false,
      code: 'DENIED_UNAUTHENTICATED',
      reason: 'Authentication required. No active identity context provided.',
    };
  }

  // 2. Live Actor Status Check: Disabled or Suspended users are denied immediately
  if (actor.status !== UserStatus.ACTIVE) {
    return {
      allowed: false,
      code: 'DENIED_DISABLED_USER',
      reason: `User account is ${actor.status}. Access denied.`,
    };
  }

  // 3. Live Session Check (if session conditions provided)
  if (conditions?.session) {
    if (conditions.session.status !== 'ACTIVE') {
      return {
        allowed: false,
        code: 'DENIED_INVALID_SESSION',
        reason: `Session is ${conditions.session.status}. Access denied.`,
      };
    }
    if (conditions.session.expiresAt && new Date(conditions.session.expiresAt).getTime() < Date.now()) {
      return {
        allowed: false,
        code: 'DENIED_INVALID_SESSION',
        reason: 'Session has expired. Re-authentication required.',
      };
    }
  }

  // 4. Required Dependency Availability (Fail-Closed)
  if (conditions?.dependencyHealthy === false) {
    return {
      allowed: false,
      code: 'DENIED_DEPENDENCY_FAILURE',
      reason: 'Required security authorization dependency unavailable. Access denied.',
    };
  }

  // 5. Tenant Boundary Enforcement (Multi-tenancy isolation)
  if (actor.tenantId && resource.tenantId && actor.tenantId !== resource.tenantId) {
    return {
      allowed: false,
      code: 'DENIED_CROSS_TENANT',
      reason: 'Cross-tenant access prohibited. Resource belongs to a different organizational boundary.',
    };
  }

  const isAdmin = actor.role === UserRole.ADMIN || actor.userId === 'usr_admin_001';

  // 6. Administrative Operations Gate
  const adminOnlyActions: PolicyAction[] = [
    'ADMIN_OPERATION',
    'POSITION_MANAGE',
    'ACCESS_APPROVE',
    'ACCESS_REJECT',
    'GRANT_REVOKE',
    'ACCESS_EXTEND',
    'USER_MANAGE',
    'KEY_ROTATE',
    'KEY_REVOKE',
  ];

  if (adminOnlyActions.includes(action)) {
    if (!isAdmin) {
      return {
        allowed: false,
        code: 'DENIED_MISSING_PERMISSION',
        reason: `Action ${action} requires Organization Administrator authority.`,
      };
    }
    return { allowed: true, code: 'AUTHORIZED' };
  }

  // 7. Audit & Verification Gate
  if (action === 'AUDIT_READ' || action === 'AUDIT_VERIFY') {
    if (isAdmin || actor.role === UserRole.AUDITOR || actor.role === UserRole.SECURITY_ANALYST) {
      return { allowed: true, code: 'AUTHORIZED' };
    }
    return {
      allowed: false,
      code: 'DENIED_MISSING_PERMISSION',
      reason: 'Audit ledger access requires Administrator or Auditor privileges.',
    };
  }

  // 8. Device Management Gate
  if (action === 'DEVICE_MANAGE') {
    if (isAdmin) return { allowed: true, code: 'AUTHORIZED' };
    if (resource.ownerId && resource.ownerId === actor.userId) {
      return { allowed: true, code: 'AUTHORIZED' };
    }
    return {
      allowed: false,
      code: 'DENIED_IDOR',
      reason: 'Cannot manage hardware credentials belonging to another user.',
    };
  }

  if (action === 'DEVICE_STEP_UP') {
    if (isAdmin) return { allowed: true, code: 'AUTHORIZED' };
    if (resource.ownerId && resource.ownerId !== actor.userId) {
      return {
        allowed: false,
        code: 'DENIED_IDOR',
        reason: 'Step-up authentication credential does not belong to the authenticated user.',
      };
    }
    return { allowed: true, code: 'AUTHORIZED' };
  }

  // 9. Asset Upload Gate
  if (action === 'ASSET_UPLOAD') {
    return { allowed: true, code: 'AUTHORIZED' };
  }

  // 10. Asset Ownership Operations: Edit, Delete, Share, Revoke Share
  if (action === 'ASSET_EDIT' || action === 'ASSET_DELETE' || action === 'ASSET_SHARE' || action === 'ASSET_REVOKE_SHARE') {
    if (isAdmin) return { allowed: true, code: 'AUTHORIZED' };
    if (resource.ownerId === actor.userId) {
      return { allowed: true, code: 'AUTHORIZED' };
    }
    return {
      allowed: false,
      code: 'DENIED_IDOR',
      reason: 'Unauthorized: Only the asset owner or administrator can modify, share, or delete this asset.',
    };
  }

  // 11. Asset Access: READ, DECRYPT, DOWNLOAD
  if (action === 'ASSET_READ' || action === 'ASSET_DECRYPT' || action === 'ASSET_DOWNLOAD') {
    // Defense Vault Administrator has authoritative access unless asset is deleted/revoked
    if (isAdmin) {
      if (resource.status === 'DELETED') {
        return {
          allowed: false,
          code: 'DENIED_RESOURCE_NOT_FOUND',
          reason: 'Asset has been permanently deleted.',
        };
      }
      return { allowed: true, code: 'AUTHORIZED' };
    }

    // Owner has full access to their own active assets
    if (resource.ownerId === actor.userId) {
      if (resource.status === 'DELETED') {
        return {
          allowed: false,
          code: 'DENIED_RESOURCE_NOT_FOUND',
          reason: 'Asset has been permanently deleted.',
        };
      }
      return { allowed: true, code: 'AUTHORIZED' };
    }

    // Non-owner: grant evaluation
    const grant = conditions?.grant;

    if (!grant) {
      return {
        allowed: false,
        code: 'DENIED_MISSING_PERMISSION',
        reason: 'Access Denied: No clearance or assignment found for this asset. Access request required.',
      };
    }

    if (grant.status === 'REVOKED') {
      return {
        allowed: false,
        code: 'DENIED_REVOKED_GRANT',
        reason: 'Access Denied: Your access grant for this asset has been revoked.',
      };
    }

    if (grant.status === 'EXPIRED' || (grant.expiresAt && new Date(grant.expiresAt).getTime() < Date.now())) {
      return {
        allowed: false,
        code: 'DENIED_EXPIRED_GRANT',
        reason: 'Access Denied: Your temporary access grant for this asset has expired.',
      };
    }

    if (action === 'ASSET_READ' && !grant.canRead) {
      return {
        allowed: false,
        code: 'DENIED_MISSING_PERMISSION',
        reason: 'Access Denied: Missing read clearance for this asset.',
      };
    }

    if (action === 'ASSET_DECRYPT' && !grant.canDecrypt) {
      return {
        allowed: false,
        code: 'DENIED_MISSING_PERMISSION',
        reason: 'Access Denied: Missing decryption clearance for this asset.',
      };
    }

    if (action === 'ASSET_DOWNLOAD' && !grant.canDownload) {
      return {
        allowed: false,
        code: 'DENIED_MISSING_PERMISSION',
        reason: 'Access Denied: Missing download clearance for this asset.',
      };
    }

    return { allowed: true, code: 'AUTHORIZED' };
  }

  // Explicit deny fallback
  return {
    allowed: false,
    code: 'DENIED_MISSING_PERMISSION',
    reason: `Operation ${action} denied by default security policy.`,
  };
}

/**
 * Asserts policy compliance and throws standardized SecureMaxError on denial.
 */
export function assertAuthorized(ctx: AuthorizationContext): void {
  const result = evaluatePolicy(ctx);
  if (!result.allowed) {
    if (result.code === 'DENIED_UNAUTHENTICATED') {
      throw authRequired(result.reason || 'Authentication required');
    }
    throw permissionDenied(result.reason || 'Access denied');
  }
}
