// ============================================================
// SecureMax SIH26125 — Global Type Definitions
// ============================================================

export enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER',
  AUDITOR = 'AUDITOR',
  MANAGER = 'MANAGER',
  ENGINEER = 'ENGINEER',
  SECURITY_ANALYST = 'SECURITY_ANALYST',
}

export interface UserDevice {
  id: string;
  user_id: string;
  device_name: string;
  public_key: string; // Base64 SPKI
  algorithm: 'ECDSA_P256';
  status: 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
  is_admin_device: boolean;
  created_at: string;
  last_used_at: string;
  revoked_at?: string | null;

  // Device Passport Fields
  device_id?: string;
  last_active_at?: string;
  device_type?: 'laptop' | 'phone' | 'tablet' | 'desktop' | 'terminal' | string;
  os?: string;
  browser?: string;
  browser_version?: string;
  model?: string;
  credential_id?: string;
  credential_type?: 'WebAuthn' | 'Passkey' | 'ECDSA_P256' | string;
  registered_at?: string;
  last_authenticated_at?: string;
  risk_state?: 'TRUSTED' | 'REVIEW' | 'RESTRICTED' | 'REVOKED';
  registration_region?: string;
  position?: string;
  timeline?: DeviceTimelineEvent[];
}

export interface DeviceTimelineEvent {
  id: string;
  timestamp: string;
  event: string;
  details?: string;
  severity?: 'INFO' | 'WARNING' | 'CRITICAL';
}

export interface DevicePassport extends UserDevice {
  device_id?: string;
  last_active_at?: string;
  device_type: 'laptop' | 'phone' | 'tablet' | 'desktop' | 'terminal' | string;
  os: string;
  browser: string;
  browser_version?: string;
  model?: string;
  credential_id: string;
  credential_type: 'WebAuthn' | 'Passkey' | 'ECDSA_P256' | string;
  registered_at: string;
  last_authenticated_at: string;
  risk_state: 'TRUSTED' | 'REVIEW' | 'RESTRICTED' | 'REVOKED';
  registration_region: string;
  position?: string;
  user_name?: string;
  user_email?: string;
  timeline: DeviceTimelineEvent[];
}

export interface PositionPermissions {
  identity: {
    register: boolean;
    suspend: boolean;
    revoke: boolean;
  };
  users: {
    create: boolean;
    suspend: boolean;
  };
  assets: {
    view: boolean;
    allocate: boolean;
    transfer: boolean;
    delete: boolean;
  };
  access: {
    approve: boolean;
    revoke: boolean;
  };
  audit: {
    view: boolean;
    export: boolean;
  };
  security: {
    view_alerts: boolean;
    manage_devices: boolean;
  };
}

export type AssuranceLevel = 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3' | 'LEVEL_4';

export interface RootAdminBootstrapParams {
  orgName: string;
  orgId?: string;
  orgType?: string;
  country?: string;
  timezone?: string;
  adminName: string;
  adminId?: string;
  email: string;
  phone?: string;
  department?: string;
  designation?: string;
  deviceName: string;
  deviceType?: string;
  os?: string;
  browser?: string;
  publicKey: string;
  credentialId?: string;
  bootstrapSecret?: string;
  adminWallet?: string;
}

export interface AdminRecoveryVault {
  recoveryId: string;
  recoveryCodeHash: string;
  createdAt: string;
  used: boolean;
  usedAt?: string;
}

export interface SystemSettings {
  admin_initialized: boolean;
  bootstrap_enabled: boolean;
  admin_wallet?: string;
  system_state: 'UNINITIALIZED' | 'BOOTSTRAP_OPEN' | 'ADMIN_CREATED' | 'SYSTEM_LOCKED';
  organization?: {
    name: string;
    org_id: string;
    org_type: string;
    country: string;
    timezone: string;
    created_at: string;
  };
  root_admin_id?: string;
  admin_locked: boolean;
  failed_admin_logins: number;
  last_admin_login?: {
    timestamp: string;
    region: string;
    device_name: string;
    auth_method: string;
  };
  last_security_change?: string;
}

export interface StoredPosition {
  id: string;
  name: string;
  description: string;
  privilege_level: 'STANDARD' | 'ELEVATED' | 'ADMINISTRATIVE';
  permissions: PositionPermissions;
  is_predefined: boolean;
  created_at: string;
  created_by?: string;
}

export interface DeviceEnrollment {
  code: string;
  user_id: string;
  expires_at: string;
  created_at: string;
}

export interface StoredEnrollmentCapability {
  id: string;
  code_hash: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
  position_id: string;
  position_name: string;
  duration_minutes: number;
  max_devices: number;
  devices_enrolled: number;
  created_by: string;
  created_at: string;
  expires_at: string;
  status: 'ACTIVE' | 'CONSUMED' | 'EXPIRED' | 'REVOKED';
  used_at?: string | null;
  target_device_type?: string;
}

export interface StoredDeviceSession {
  session_id: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
  device_id: string;
  device_name?: string;
  position: string;
  created_at: string;
  last_activity_at: string;
  expires_at: string;
  authentication_level: 'PASSKEY' | 'WEBAUTHN' | 'P256' | 'METAMASK' | AssuranceLevel;
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
}

export interface StoredAuditEvent {
  id: string;
  event_type: string;
  description: string;
  target_id?: string;
  target?: string;
  before?: any;
  after?: any;
  performed_by?: string;
  user_email?: string;
  user_name?: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  event_hash: string;
  block_number?: number;
  created_at: string;
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  REVOKED = 'REVOKED',
}

export enum ClassificationLevel {
  PUBLIC = 'PUBLIC',
  INTERNAL = 'INTERNAL',
  CONFIDENTIAL = 'CONFIDENTIAL',
  RESTRICTED = 'RESTRICTED',
  HIGH = 'HIGH',
}

export enum AssetStatus {
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
  REVOKED = 'REVOKED',
  TRANSFERRING = 'TRANSFERRING',
}

export enum AssignmentStatus {
  ACTIVE = 'ACTIVE',
  REVOKED = 'REVOKED',
  EXPIRED = 'EXPIRED',
}

export enum AccessStatus {
  PENDING = 'PENDING',
  AUTHORIZED = 'AUTHORIZED',
  DENIED = 'DENIED',
  EXPIRED = 'EXPIRED',
  REVOKED = 'REVOKED',
}

export enum KeyStatus {
  ACTIVE = 'ACTIVE',
  ROTATING = 'ROTATING',
  ROTATED = 'ROTATED',
  REVOKED = 'REVOKED',
  DESTROYED = 'DESTROYED',
}

export enum TokenStatus {
  ACTIVE = 'ACTIVE',
  USED = 'USED',
  EXPIRED = 'EXPIRED',
  REVOKED = 'REVOKED',
}

export enum SeverityLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum FindingStatus {
  OPEN = 'OPEN',
  INVESTIGATING = 'INVESTIGATING',
  REMEDIATED = 'REMEDIATED',
  VERIFIED = 'VERIFIED',
  CLOSED = 'CLOSED',
}

export enum ScanStatus {
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum SessionStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  REVOKED = 'REVOKED',
}

export enum AuditEventType {
  IDENTITY_CREATED = 'IDENTITY_CREATED',
  ROLE_ASSIGNED = 'ROLE_ASSIGNED',
  ROLE_REVOKED = 'ROLE_REVOKED',
  ASSET_REGISTERED = 'ASSET_REGISTERED',
  ASSET_ASSIGNED = 'ASSET_ASSIGNED',
  ASSET_TRANSFERRED = 'ASSET_TRANSFERRED',
  ACCESS_REQUESTED = 'ACCESS_REQUESTED',
  ACCESS_GRANTED = 'ACCESS_GRANTED',
  ACCESS_DENIED = 'ACCESS_DENIED',
  KEY_POLICY_CREATED = 'KEY_POLICY_CREATED',
  KEY_ACCESS_APPROVED = 'KEY_ACCESS_APPROVED',
  KEY_ACCESS_DENIED = 'KEY_ACCESS_DENIED',
  TEMPORARY_KEY_AUTHORIZED = 'TEMPORARY_KEY_AUTHORIZED',
  DECRYPTION_STARTED = 'DECRYPTION_STARTED',
  DECRYPTION_COMPLETED = 'DECRYPTION_COMPLETED',
  ACCESS_EXPIRED = 'ACCESS_EXPIRED',
  KEY_ROTATED = 'KEY_ROTATED',
  KEY_REVOKED = 'KEY_REVOKED',
  SECURITY_SCAN_STARTED = 'SECURITY_SCAN_STARTED',
  VULNERABILITY_DETECTED = 'VULNERABILITY_DETECTED',
  SECURITY_RESPONSE_TRIGGERED = 'SECURITY_RESPONSE_TRIGGERED',
  BREAK_GLASS_REQUESTED = 'BREAK_GLASS_REQUESTED',
  BREAK_GLASS_GRANTED = 'BREAK_GLASS_GRANTED',
  BREAK_GLASS_DENIED = 'BREAK_GLASS_DENIED',
  TOKEN_REPLAY_ATTEMPT = 'TOKEN_REPLAY_ATTEMPT',
  ADMIN_LOGIN_SUCCESS = 'ADMIN_LOGIN_SUCCESS',
  ADMIN_LOGIN_FAILURE = 'ADMIN_LOGIN_FAILURE',
  USER_LOGIN_SUCCESS = 'USER_LOGIN_SUCCESS',
  USER_LOGIN_FAILURE = 'USER_LOGIN_FAILURE',
  ENROLLMENT_CREATED = 'ENROLLMENT_CREATED',
  ENROLLMENT_USED = 'ENROLLMENT_USED',
  ENROLLMENT_FAILED = 'ENROLLMENT_FAILED',
  CREDENTIAL_REGISTERED = 'CREDENTIAL_REGISTERED',
  CREDENTIAL_REVOKED = 'CREDENTIAL_REVOKED',
  SESSION_CREATED = 'SESSION_CREATED',
  SESSION_REVOKED = 'SESSION_REVOKED',
  USER_SUSPENDED = 'USER_SUSPENDED',
  USER_REACTIVATED = 'USER_REACTIVATED',
  ASSET_CREATED = 'ASSET_CREATED',
  ASSET_ALLOCATED = 'ASSET_ALLOCATED',
  UNAUTHORIZED_OPERATION = 'UNAUTHORIZED_OPERATION',
  KYC_STATUS_CHANGED = 'KYC_STATUS_CHANGED',
}

export enum ChainType {
  CHAIN_1 = 'CHAIN_1',
  CHAIN_2 = 'CHAIN_2',
}

export interface User {
  id: string;
  display_name: string;
  email: string | null;
  status: UserStatus;
  is_sandbox: boolean;
  created_at: string;
  updated_at: string;
  
  // Legacy aliases for backward compatibility with Phase 2/4 files
  did?: string;
  wallet_address?: string;
  role?: UserRole;
}

export interface Role {
  id: string;
  name: UserRole;
  description: string | null;
}

export interface UserRoleMapping {
  user_id: string;
  role_id: string;
}

export interface DID {
  id: string;
  user_id: string;
  did_string: string;
  status: UserStatus;
  registered_at: string;
}

export interface Wallet {
  id: string;
  user_id: string;
  address: string;
  status: UserStatus;
  verified_at: string;
}

export interface Asset {
  id: string;
  asset_code: string;
  name: string;
  description: string | null;
  classification: ClassificationLevel;
  owner_id: string;
  storage_path: string | null;
  status: AssetStatus;
  created_at: string;
  updated_at: string;
}

export interface AssetAssignment {
  id: string;
  asset_id: string;
  user_id: string;
  assigned_by_id: string;
  status: AssignmentStatus;
  created_at: string;
  revoked_at: string | null;
}

export interface AssetPermission {
  id: string;
  assignment_id: string;
  can_read: boolean;
  can_decrypt: boolean;
  can_transfer: boolean;
}

export interface AccessRequest {
  id: string;
  user_id: string;
  asset_id: string;
  purpose: string | null;
  status: AccessStatus;
  created_at: string;
  resolved_at: string | null;
}

export interface AccessSession {
  id: string;
  user_id: string;
  token_hash: string;
  ip_address: string | null;
  created_at: string;
  expires_at: string;
}

export interface EncryptionKey {
  id: string;
  asset_id: string;
  algorithm: string;
  created_at: string;
  
  // Backwards compatibility for phase 2 lib
  key_version?: number;
  encrypted_dek?: string;
  dek_iv?: string;
  key_status?: KeyStatus;
  created_by_did?: string;
}

export interface KeyVersion {
  id: string;
  key_id: string;
  version_number: number;
  encrypted_dek: string;
  dek_iv: string;
  status: KeyStatus;
  created_at: string;
}

export interface KeyPolicy {
  id: string;
  key_id: string;
  policy_type: string;
  conditions: any;
  created_at: string;
}

export interface KeyAccessEvent {
  id: string;
  key_id: string;
  user_id: string;
  action: string;
  timestamp: string;
}

export interface AuditEvent {
  id: number;
  event_type: string;
  actor_id: string | null;
  target_type: string | null;
  target_id: string | null;
  event_hash: string;
  prev_hash: string;
  created_at: string;
}

export interface SecurityScan {
  id: string;
  triggered_by: string | null;
  status: ScanStatus;
  passed_count: number;
  failed_count: number;
  started_at: string;
  completed_at: string | null;
}

export interface SecurityFinding {
  id: string;
  scan_id: string;
  severity: SeverityLevel;
  description: string;
  status: FindingStatus;
  created_at: string;
}

export interface SecurityIncident {
  id: string;
  title: string;
  severity: SeverityLevel;
  status: string;
  created_at: string;
  resolved_at: string | null;
}

export interface BreakGlassRequest {
  id: string;
  user_id: string;
  reason: string;
  status: string;
  approved_by: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface BlockchainTransaction {
  id: string;
  tx_hash: string;
  chain_id: ChainType;
  entity_type: string;
  entity_id: string;
  status: string;
  created_at: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T | null;
  error: { code: string; message: string } | null;
  meta: { timestamp: string; requestId: string };
}

export const PERMISSIONS = {
  manage_users: 'manage_users',
  assign_roles: 'assign_roles',
  register_assets: 'register_assets',
  assign_assets: 'assign_assets',
  transfer_ownership: 'transfer_ownership',
  request_access: 'request_access',
  approve_access: 'approve_access',
  decrypt_assets: 'decrypt_assets',
  view_audit_trail: 'view_audit_trail',
  manage_keys: 'manage_keys',
  rotate_keys: 'rotate_keys',
  run_security_scan: 'run_security_scan',
  view_findings: 'view_findings',
  emergency_access: 'emergency_access',
  view_blockchain: 'view_blockchain',
} as const;

export type Permission = keyof typeof PERMISSIONS;

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.ADMIN]: Object.keys(PERMISSIONS) as Permission[],
  [UserRole.USER]: ['request_access', 'decrypt_assets', 'view_blockchain'],
  [UserRole.MANAGER]: [
    'register_assets', 'assign_assets', 'transfer_ownership',
    'request_access', 'approve_access', 'decrypt_assets', 'view_blockchain',
  ],
  [UserRole.ENGINEER]: ['request_access', 'decrypt_assets', 'view_blockchain'],
  [UserRole.AUDITOR]: ['view_audit_trail', 'view_findings', 'view_blockchain'],
  [UserRole.SECURITY_ANALYST]: [
    'view_audit_trail', 'run_security_scan', 'view_findings', 'view_blockchain',
  ],
};
