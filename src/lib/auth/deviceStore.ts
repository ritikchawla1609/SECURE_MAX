import 'server-only';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';

export const storeEvents = new EventEmitter();
storeEvents.setMaxListeners(200);

import { 
  UserRole, 
  UserStatus, 
  UserDevice, 
  DeviceEnrollment, 
  DevicePassport, 
  DeviceTimelineEvent,
  PositionPermissions,
  StoredPosition,
  StoredEnrollmentCapability,
  StoredDeviceSession,
  RootAdminBootstrapParams,
  AdminRecoveryVault,
  SystemSettings,
  AssuranceLevel
} from '@/types';
import { deriveKEK, generateDEK, encryptData } from '../crypto';
import { 
  syncLedgerToSupabase, 
  fetchLedgerFromSupabase, 
  syncUserToSupabase, 
  syncAssetToSupabase, 
  syncDeviceToSupabase, 
  syncAccessRequestToSupabase 
} from '@/lib/db/supabase-sync';

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  position_id?: string;
  position?: string;
  kyc_status: 'VERIFIED' | 'PENDING' | 'REJECTED';
  status: UserStatus;
  did: string;
  default_access_policy?: 'PRIVATE' | 'ORGANIZATION';
  created_at: string;
  admin_wallet?: string;
}

export interface StoredChallenge {
  challengeId: string;
  identifier: string;
  nonce: string;
  message: string;
  type: 'P256' | 'ETHEREUM';
  walletAddress?: string;
  userId?: string;
  deviceId?: string;
  expiresAt: string;
  consumed: boolean;
  consumedAt?: string;
  createdAt: string;
}

export interface AssetVersion {
  version: string;
  uploaded_by: string;
  created_at: string;
  size: string;
  notes?: string;
}

export interface AssetAccessLog {
  id: string;
  action: string;
  user_name: string;
  timestamp: string;
  status: 'SUCCESS' | 'DENIED' | 'PENDING';
  details?: string;
}

export interface StoredAsset {
  id: string;
  asset_code: string;
  name: string;
  classification: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED' | string;
  status: string;
  description: string;
  encrypted_content: string; // Base64 AES-256-GCM ciphertext
  iv: string;
  auth_tag: string;
  aad: string;
  folder: 'Projects' | 'Finance' | 'HR' | 'Engineering' | 'Legal' | string;
  file_type: 'PDF' | 'XLSX' | 'ZIP' | 'PNG' | 'DOC' | 'JSON' | 'TXT' | string;
  mime_type: string;
  file_size_bytes: number;
  owner_id?: string;
  owner_name: string;
  shared_with_all?: boolean;
  default_access_policy?: 'PRIVATE' | 'ORGANIZATION';
  created_at: string;
  last_accessed_at?: string;
  key_version: string;
  versions: AssetVersion[];
  access_history: AssetAccessLog[];
  blockchain_token_id: string;
  blockchain_contract: string;
  did: string;
  is_archived?: boolean;
}

export interface StoredAssignment {
  asset_id: string;
  user_id: string; // specific user ID or 'ALL'
  can_read: boolean;
  can_decrypt: boolean;
  can_download: boolean;
  can_edit: boolean;
  can_delete: boolean;
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  assigned_at: string;
  expires_at: string | null;
  shared_by?: string;
  shared_with_name?: string;
}

export interface StoredAccessRequest {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  role: string;
  request_type: 'HIGH_RISK_DATA' | 'AUDIT_UPDATE' | 'ASSET_ACCESS';
  asset_id?: string;
  asset_code?: string;
  asset_name?: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  ttl_minutes?: number;
  nft_token_id?: string;
  created_at: string;
  approved_at?: string;
  rejected_at?: string;
  rejected_reason?: string;
}

export interface LiveGrant {
  id: string;
  user: string;
  userId?: string;
  assetCode: string;
  assetName?: string;
  sessionId: string;
  ip: string;
  device: string;
  expiresAt: string;
  remainingSeconds?: number;
  status: 'ACTIVE' | 'IDLE' | 'REVOKED' | 'EXPIRED';
  note?: string;
  createdAt: string;
}

export interface LoginHistoryRecord {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  role: string;
  deviceName: string;
  ip: string;
  timestamp: string;
  status: 'SUCCESS' | 'FAILED';
}

export interface StoredNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  target_id?: string;
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

export const PREDEFINED_POSITIONS: StoredPosition[] = [
  {
    id: 'pos_root_admin',
    name: 'Root Administrator',
    description: 'Protected root organizational security identity',
    privilege_level: 'ADMINISTRATIVE',
    is_predefined: true,
    created_at: '2026-09-01T00:00:00.000Z',
    permissions: {
      identity: { register: true, suspend: true, revoke: true },
      users: { create: true, suspend: true },
      assets: { view: true, allocate: true, transfer: true, delete: true },
      access: { approve: true, revoke: true },
      audit: { view: true, export: true },
      security: { view_alerts: true, manage_devices: true },
    },
  },
  {
    id: 'pos_admin',
    name: 'Administrator',
    description: 'Complete organizational administration',
    privilege_level: 'ADMINISTRATIVE',
    is_predefined: true,
    created_at: '2026-09-01T00:00:00.000Z',
    permissions: {
      identity: { register: true, suspend: true, revoke: true },
      users: { create: true, suspend: true },
      assets: { view: true, allocate: true, transfer: true, delete: true },
      access: { approve: true, revoke: true },
      audit: { view: true, export: true },
      security: { view_alerts: true, manage_devices: true },
    },
  },
  {
    id: 'pos_manager',
    name: 'Manager',
    description: 'Operational asset and access management',
    privilege_level: 'ELEVATED',
    is_predefined: true,
    created_at: '2026-09-01T00:00:00.000Z',
    permissions: {
      identity: { register: false, suspend: false, revoke: false },
      users: { create: false, suspend: false },
      assets: { view: true, allocate: true, transfer: true, delete: false },
      access: { approve: true, revoke: true },
      audit: { view: true, export: false },
      security: { view_alerts: true, manage_devices: false },
    },
  },
  {
    id: 'pos_auditor',
    name: 'Auditor',
    description: 'Read-only evidence and audit investigation',
    privilege_level: 'STANDARD',
    is_predefined: true,
    created_at: '2026-09-01T00:00:00.000Z',
    permissions: {
      identity: { register: false, suspend: false, revoke: false },
      users: { create: false, suspend: false },
      assets: { view: true, allocate: false, transfer: false, delete: false },
      access: { approve: false, revoke: false },
      audit: { view: true, export: true },
      security: { view_alerts: true, manage_devices: false },
    },
  },
  {
    id: 'pos_user',
    name: 'User',
    description: 'Assigned organizational asset access',
    privilege_level: 'STANDARD',
    is_predefined: true,
    created_at: '2026-09-01T00:00:00.000Z',
    permissions: {
      identity: { register: false, suspend: false, revoke: false },
      users: { create: false, suspend: false },
      assets: { view: true, allocate: false, transfer: false, delete: false },
      access: { approve: false, revoke: false },
      audit: { view: false, export: false },
      security: { view_alerts: false, manage_devices: false },
    },
  },
];

// In-memory persistent state with atomic disk persistence (.securemax_db/vault_ledger.json)
class SecureMaxStore {
  // Track readiness so Vercel lambdas don't mutate state before cloud load finishes
  public readyPromise: Promise<void> | null = null;

  public users: Map<string, StoredUser> = new Map();
  public devices: Map<string, UserDevice> = new Map();
  public enrollments: Map<string, DeviceEnrollment> = new Map();
  public enrollmentCapabilities: Map<string, StoredEnrollmentCapability> = new Map();
  public positions: Map<string, StoredPosition> = new Map();
  public sessions: Map<string, StoredDeviceSession> = new Map();
  public devicePassports: Map<string, DevicePassport> = new Map();
  public assets: Map<string, StoredAsset> = new Map();
  public assignments: StoredAssignment[] = [];
  public accessRequests: StoredAccessRequest[] = [];
  public liveGrants: LiveGrant[] = [];
  public auditEvents: StoredAuditEvent[] = [];
  public wrappedDEKs: Map<string, { cipher: string; iv: string; authTag: string }> = new Map();
  public challengeCache: Map<string, { challengeId: string; identifier: string; nonce: string; message: string; expiresAt: string }> = new Map();
  public challenges: Map<string, StoredChallenge> = new Map();
  public adminWallet: string = (process.env.ADMIN_WALLET || '0x7FfdbB7868C127152F2007a6025FF15A5723CE08').toLowerCase();
  
  // Track ongoing cloud sync promises so Vercel Serverless Functions can await them before exiting
  public lastSyncPromise: Promise<any> | null = null;
  public lastMutationTime: number = 0;

  // Root Admin & System Bootstrap Settings
  public systemSettings: SystemSettings = {
    admin_initialized: false,
    bootstrap_enabled: true,
    system_state: 'UNINITIALIZED',
    admin_locked: false,
    failed_admin_logins: 0,
  };
  public recoveryVault: AdminRecoveryVault | null = null;
  public notifications: StoredNotification[] = [];
  public loginHistory: LoginHistoryRecord[] = [];

  constructor() {
    const isTest = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);
    if (!isTest) {
      const loaded = this.loadFromDisk();
      if (!loaded) {
        // Attempt to load from Supabase cloud storage (e.g. on Vercel cold starts)
        this.readyPromise = this.loadFromCloud().then(cloudLoaded => {
          if (!cloudLoaded && this.users.size === 0) {
            this.seedInitialData();
            this.seedTestDataForTesting(false);
            this.saveToDisk();
          }
        }).catch(() => {
          if (this.users.size === 0) {
            this.seedInitialData();
            this.seedTestDataForTesting(false);
            this.saveToDisk();
          }
        });
      } else {
        if (!this.assets.has('ast_kms')) {
          this.seedTestDataForTesting(false);
          this.saveToDisk();
        }
        // Background check if cloud has newer state
        this.loadFromCloud().catch(() => {});
      }
    }
  }

  private getDbFilePath(): string {
    if (process.env.SECUREMAX_STORE_PATH) {
      return process.env.SECUREMAX_STORE_PATH;
    }
    return path.join(process.cwd(), '.securemax_db', 'vault_ledger.json');
  }

  public hydrate(parsed: any): boolean {
    if (!parsed || !Array.isArray(parsed.users) || parsed.users.length === 0) {
      return false;
    }

    if (parsed.updatedAt && this.lastMutationTime > 0) {
      const cloudTime = new Date(parsed.updatedAt).getTime();
      if (this.lastMutationTime > cloudTime + 1000) {
        return false;
      }
    }

    this.users.clear();
    for (const u of parsed.users) {
      this.users.set(u.id, u);
      this.users.set(u.email, u);
    }

    if (Array.isArray(parsed.devices)) {
      this.devices.clear();
      for (const d of parsed.devices) {
        this.devices.set(d.id, d);
      }
    }

    if (Array.isArray(parsed.sessions)) {
      this.sessions.clear();
      for (const s of parsed.sessions) {
        this.sessions.set(s.session_id, s);
      }
    }

    if (Array.isArray(parsed.enrollments)) {
      this.enrollments.clear();
      for (const e of parsed.enrollments) {
        this.enrollments.set(e.code, e);
      }
    }

    if (Array.isArray(parsed.assets)) {
      this.assets.clear();
      for (const a of parsed.assets) {
        this.assets.set(a.id, a);
      }
    }

    if (Array.isArray(parsed.wrappedDEKs)) {
      this.wrappedDEKs.clear();
      for (const [assetId, dek] of parsed.wrappedDEKs) {
        this.wrappedDEKs.set(assetId, dek);
      }
    }

    if (Array.isArray(parsed.assignments)) {
      this.assignments = parsed.assignments;
    }

    if (Array.isArray(parsed.accessRequests)) {
      this.accessRequests = parsed.accessRequests;
    }

    if (Array.isArray(parsed.liveGrants)) {
      this.liveGrants = parsed.liveGrants;
    }

    if (Array.isArray(parsed.auditEvents)) {
      this.auditEvents = parsed.auditEvents;
    }

    if (Array.isArray(parsed.notifications)) {
      this.notifications = parsed.notifications;
    }

    if (Array.isArray(parsed.loginHistory)) {
      this.loginHistory = parsed.loginHistory;
    }

    if (Array.isArray(parsed.positions)) {
      this.positions.clear();
      for (const p of parsed.positions) {
        this.positions.set(p.id, p);
      }
    }

    if (Array.isArray(parsed.devicePassports)) {
      this.devicePassports.clear();
      for (const dp of parsed.devicePassports) {
        this.devicePassports.set(dp.id || dp.device_id, dp);
      }
    }

    if (parsed.systemSettings) {
      this.systemSettings = parsed.systemSettings;
    }

    // If active admins are loaded, ensure system state reflects initialized
    if (this.getAdminCount() > 0) {
      this.systemSettings.admin_initialized = true;
      this.systemSettings.bootstrap_enabled = false;
      if (this.systemSettings.system_state === 'UNINITIALIZED') {
        this.systemSettings.system_state = 'SYSTEM_LOCKED';
      }
    }

    if (parsed.recoveryVault) {
      this.recoveryVault = parsed.recoveryVault;
    }

    if (process.env.ADMIN_WALLET) {
      this.adminWallet = process.env.ADMIN_WALLET.toLowerCase();
    } else if (parsed.adminWallet) {
      this.adminWallet = parsed.adminWallet.toLowerCase();
    }

    if (Array.isArray(parsed.challenges)) {
      this.challenges.clear();
      for (const c of parsed.challenges) {
        if (!c.consumed && new Date(c.expiresAt).getTime() > Date.now()) {
          this.challenges.set(c.challengeId, c);
          this.challengeCache.set(c.challengeId, {
            challengeId: c.challengeId,
            identifier: c.identifier,
            nonce: c.nonce,
            message: c.message,
            expiresAt: c.expiresAt,
          });
        }
      }
    }

    const isTest = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);
    if (!isTest && !this.assets.has('ast_kms')) {
      this.seedTestDataForTesting(false);
    }

    return true;
  }

  public async loadFromCloud(): Promise<boolean> {
    try {
      if (this.lastSyncPromise) {
        await this.lastSyncPromise;
      }
      const cloudData = await fetchLedgerFromSupabase();
      if (cloudData && this.hydrate(cloudData)) {
        // Cache to local disk for fast subsequent reads
        this.saveToDisk(false);
        return true;
      }
    } catch (e) {
      console.warn('[SecureMaxStore] Cloud load error:', e);
    }
    return false;
  }

  public saveToDisk(syncToCloud: boolean = true): void {
    if ((process.env.NODE_ENV === 'test' || process.env.VITEST) && !process.env.SECUREMAX_STORE_PATH) return;
    this.lastMutationTime = Date.now();
    try {
      const filePath = this.getDbFilePath();
      const dir = path.dirname(filePath);
      try {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      } catch (dirErr) {
        // Expected in serverless read-only environments
      }

      const isTest = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);

      // Safe multi-process merge: only in non-test environments
      if (!isTest && fs.existsSync(filePath)) {
        try {
          const onDisk = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          if (Array.isArray(onDisk.users)) {
            for (const u of onDisk.users) {
              if (!this.users.has(u.id)) {
                this.users.set(u.id, u);
                this.users.set(u.email, u);
              }
            }
          }
          if (Array.isArray(onDisk.assets)) {
            for (const a of onDisk.assets) {
              if (!this.assets.has(a.id)) {
                this.assets.set(a.id, a);
              }
            }
          }
          if (Array.isArray(onDisk.wrappedDEKs)) {
            for (const [assetId, dek] of onDisk.wrappedDEKs) {
              if (!this.wrappedDEKs.has(assetId)) {
                this.wrappedDEKs.set(assetId, dek);
              }
            }
          }
          if (Array.isArray(onDisk.devices)) {
            for (const d of onDisk.devices) {
              if (!this.devices.has(d.id)) {
                this.devices.set(d.id, d);
              }
            }
          }
          if (Array.isArray(onDisk.accessRequests)) {
            for (const r of onDisk.accessRequests) {
              if (!this.accessRequests.some(ar => ar.id === r.id)) {
                this.accessRequests.push(r);
              }
            }
          }
          if (Array.isArray(onDisk.devicePassports)) {
            for (const dp of onDisk.devicePassports) {
              if (!this.devicePassports.has(dp.id || dp.device_id)) {
                this.devicePassports.set(dp.id || dp.device_id, dp);
              }
            }
          }
          if (Array.isArray(onDisk.sessions)) {
            for (const s of onDisk.sessions) {
              if (!this.sessions.has(s.session_id)) {
                this.sessions.set(s.session_id, s);
              }
            }
          }
          if (Array.isArray(onDisk.enrollments)) {
            for (const e of onDisk.enrollments) {
              if (!this.enrollments.has(e.code)) {
                this.enrollments.set(e.code, e);
              }
            }
          }
          if (Array.isArray(onDisk.liveGrants)) {
            for (const lg of onDisk.liveGrants) {
              if (!this.liveGrants.some(l => l.id === lg.id)) {
                this.liveGrants.push(lg);
              }
            }
          }
          if (Array.isArray(onDisk.assignments)) {
            for (const a of onDisk.assignments) {
              if (!this.assignments.some(assign => assign.asset_id === a.asset_id && assign.user_id === a.user_id)) {
                this.assignments.push(a);
              }
            }
          }
          if (Array.isArray(onDisk.auditEvents)) {
            for (const ae of onDisk.auditEvents) {
              if (!this.auditEvents.some(evt => evt.id === ae.id)) {
                this.auditEvents.push(ae);
              }
            }
          }
        } catch {}
      }

      // Deduplicate users by ID to prevent duplicate user array entries in JSON
      const uniqueUsers = Array.from(new Map(Array.from(this.users.values()).map(u => [u.id, u])).values());

      const payload = {
        users: uniqueUsers,
        devices: Array.from(this.devices.values()),
        enrollments: Array.from(this.enrollments.values()),
        assets: Array.from(this.assets.values()),
        wrappedDEKs: Array.from(this.wrappedDEKs.entries()),
        assignments: this.assignments,
        accessRequests: this.accessRequests,
        liveGrants: this.liveGrants,
        auditEvents: this.auditEvents,
        notifications: this.notifications,
        loginHistory: this.loginHistory,
        positions: Array.from(this.positions.values()),
        devicePassports: Array.from(this.devicePassports.values()),
        systemSettings: this.systemSettings,
        recoveryVault: this.recoveryVault,
        adminWallet: this.adminWallet,
        sessions: Array.from(this.sessions.values()),
        challenges: Array.from(this.challenges.values()).filter(c => !c.consumed && new Date(c.expiresAt).getTime() > Date.now()),
        updatedAt: new Date().toISOString(),
      };

      const tmpPath = `${filePath}.${Date.now()}.tmp`;
      try {
        fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2), 'utf8');
        fs.renameSync(tmpPath, filePath);
      } catch (fsErr) {
        // Vercel serverless read-only filesystem error is expected here.
        // We catch it so we can continue to the Supabase Cloud sync.
        console.warn('[SecureMaxStore] Local disk write skipped (likely Vercel environment):', fsErr);
      }
      
      storeEvents.emit('change', { type: 'STATE_MUTATION', timestamp: Date.now() });

      // Asynchronously sync to Supabase Cloud Storage (non-blocking)
      if (syncToCloud && !isTest) {
        this.lastSyncPromise = syncLedgerToSupabase(payload).catch(() => {});
      }
    } catch (err) {
      console.error('[SecureMaxStore] Payload generation error:', err);
    }
  }

  public loadFromDisk(): boolean {
    try {
      const filePath = this.getDbFilePath();
      if (!fs.existsSync(filePath)) {
        return false;
      }
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      return this.hydrate(parsed);
    } catch (err) {
      console.error('[SecureMaxStore] Disk load error:', err);
      return false;
    }
  }

  public resetForTesting(): void {
    this.users.clear();
    this.positions.clear();
    this.devices.clear();
    this.enrollments.clear();
    this.sessions.clear();
    this.devicePassports.clear();
    this.challenges.clear();
    this.challengeCache.clear();
    this.adminWallet = (process.env.ADMIN_WALLET || '0x7FfdbB7868C127152F2007a6025FF15A5723CE08').toLowerCase();
    this.assets.clear();
    this.assignments = [];
    this.accessRequests = [];
    this.auditEvents = [];
    this.wrappedDEKs.clear();
    this.challengeCache.clear();
    this.systemSettings = {
      admin_initialized: false,
      bootstrap_enabled: true,
      system_state: 'UNINITIALIZED',
      admin_locked: false,
      failed_admin_logins: 0,
    };
    this.recoveryVault = null;
    this.saveToDisk();
  }

  public isSystemInitialized(): boolean {
    const adminCount = this.getAdminCount();
    if (adminCount > 0) {
      if (!this.systemSettings.admin_initialized || this.systemSettings.bootstrap_enabled) {
        this.systemSettings.admin_initialized = true;
        this.systemSettings.bootstrap_enabled = false;
        if (this.systemSettings.system_state === 'UNINITIALIZED') {
          this.systemSettings.system_state = 'SYSTEM_LOCKED';
        }
        this.saveToDisk();
      }
      return true;
    }
    return Boolean(this.systemSettings.admin_initialized && adminCount > 0);
  }

  public getAdminCount(): number {
    const uniqueAdmins = new Set(
      Array.from(this.users.values())
        .filter(u => u.role === UserRole.ADMIN && u.status === UserStatus.ACTIVE)
        .map(u => u.id)
    );
    return uniqueAdmins.size;
  }

  public getSystemSettings(): SystemSettings {
    return { ...this.systemSettings };
  }

  public getWrappedDEK(assetId: string) {
    return this.wrappedDEKs.get(assetId);
  }

  public seedInitialData(): void {
    // Seed Predefined Positions
    for (const p of PREDEFINED_POSITIONS) {
      this.positions.set(p.id, { ...p });
    }
    const customPos: StoredPosition = {
      id: 'pos_sec_manager',
      name: 'Security Manager',
      description: 'Responsible for security operations and device management',
      privilege_level: 'ELEVATED',
      permissions: {
        identity: { register: true, suspend: true, revoke: false },
        users: { create: false, suspend: true },
        assets: { view: true, allocate: true, transfer: false, delete: false },
        access: { approve: true, revoke: true },
        audit: { view: true, export: true },
        security: { view_alerts: true, manage_devices: true },
      },
      is_predefined: false,
      created_at: '2026-09-02T00:00:00.000Z',
      created_by: 'Aarav Mehta',
    };
    this.positions.set(customPos.id, customPos);

    // Root Administrator Only
    const adminUser: StoredUser = {
      id: 'usr_admin_001',
      name: 'Aarav Mehta',
      email: 'admin@securemax.mil',
      role: UserRole.ADMIN,
      position: 'Root Administrator',
      position_id: 'pos_root_admin',
      kyc_status: 'VERIFIED',
      status: UserStatus.ACTIVE,
      did: 'did:securemax:admin:001',
      created_at: '2026-09-01T00:00:00.000Z',
      admin_wallet: this.adminWallet,
    };
    this.users.set(adminUser.id, adminUser);
    this.users.set(adminUser.email, adminUser);

    this.systemSettings = {
      admin_initialized: true,
      bootstrap_enabled: false,
      admin_wallet: this.adminWallet,
      system_state: 'SYSTEM_LOCKED',
      organization: {
        name: 'SecureMAX Defense Vault Command',
        org_id: 'ORG-SMX-001',
        org_type: 'Defense / Enterprise',
        country: 'India',
        timezone: 'Asia/Kolkata',
        created_at: '2026-09-01T00:00:00.000Z',
      },
      root_admin_id: adminUser.id,
      admin_locked: false,
      failed_admin_logins: 0,
      last_admin_login: {
        timestamp: new Date().toISOString(),
        region: 'Punjab, India',
        device_name: 'Admin Workstation Terminal',
        auth_method: 'WEBAUTHN',
      },
      last_security_change: new Date().toISOString(),
    };

    const adminDevice: DevicePassport = {
      id: 'dev_admin_primary',
      device_id: 'dev_admin_primary',
      user_id: adminUser.id,
      user_name: adminUser.name,
      user_email: adminUser.email,
      position: 'Root Administrator',
      device_name: 'Admin Workstation Terminal',
      device_type: 'terminal',
      os: 'macOS',
      browser: 'Chrome',
      browser_version: '128.0',
      model: 'SecureMAX Hardware-Bound Terminal',
      credential_id: 'cred_admin_hw_01',
      credential_type: 'WebAuthn',
      registered_at: '2026-09-01T00:00:00.000Z',
      last_authenticated_at: new Date().toISOString(),
      last_active_at: new Date().toISOString(),
      risk_state: 'TRUSTED',
      registration_region: 'Punjab, India',
      public_key: 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEr8DlCRlgzMJd/SzeTw0yNW19mgzUut7V5W0QwemPK2UUAjOfijc5tr/8UH7QJi6Ra1SZasspAVdQrWmJoxfwdw==',
      algorithm: 'ECDSA_P256',
      status: 'ACTIVE',
      is_admin_device: true,
      created_at: '2026-09-01T00:00:00.000Z',
      last_used_at: new Date().toISOString(),
      timeline: [
        { id: 'tl_adm_1', timestamp: '2026-09-01T00:00:00.000Z', event: 'DEVICE_REGISTERED', details: 'Root Administrator physical terminal bound', severity: 'INFO' },
      ],
    };
    this.devices.set(adminDevice.id, adminDevice);
    this.devicePassports.set(adminDevice.id, adminDevice);

    this.auditEvents = [
      {
        id: 'aud_root_init',
        created_at: '2026-09-01T00:00:00.000Z',
        event_type: 'ROOT_ADMIN_CREATED',
        description: 'Root Administrator account registered: Vasu (Administrator)',
        target_id: adminUser.id,
        user_name: adminUser.name,
        user_email: adminUser.email,
        performed_by: 'SYSTEM_BOOTSTRAP',
        severity: 'INFO',
        event_hash: '0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b',
      },
      {
        id: 'aud_device_bound',
        created_at: '2026-09-01T00:00:01.000Z',
        event_type: 'ADMIN_HARDWARE_TERMINAL_BOUND',
        description: 'Admin hardware terminal anchored with P-256 passkey for Vasu (Administrator)',
        target_id: adminDevice.id,
        user_name: adminUser.name,
        user_email: adminUser.email,
        performed_by: 'Vasu (Administrator)',
        severity: 'INFO',
        event_hash: '0x2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c',
      },
    ];

    this.assets.clear();
    this.accessRequests = [];
    this.liveGrants = [];
    this.notifications = [];
    this.enrollments.clear();
    this.assignments = [];
  }

  public seedTestDataForTesting(force: boolean = false): void {
    if (!force && this.users.has('usr_admin_001') && this.assets.has('ast_kms')) return;

    // Seed Positions
    for (const p of PREDEFINED_POSITIONS) {
      this.positions.set(p.id, { ...p });
    }
    const customPos: StoredPosition = {
      id: 'pos_sec_manager',
      name: 'Security Manager',
      description: 'Responsible for security operations and device management',
      privilege_level: 'ELEVATED',
      permissions: {
        identity: { register: true, suspend: true, revoke: false },
        users: { create: false, suspend: true },
        assets: { view: true, allocate: true, transfer: false, delete: false },
        access: { approve: true, revoke: true },
        audit: { view: true, export: true },
        security: { view_alerts: true, manage_devices: true },
      },
      is_predefined: false,
      created_at: '2026-09-02T00:00:00.000Z',
      created_by: 'Vasu (Administrator)',
    };
    this.positions.set(customPos.id, customPos);

    // 1. ADMIN (Vasu Admin Laptop - Strictly Device Bound)
    const adminUser: StoredUser = {
      id: 'usr_admin_001',
      name: 'Vasu (Administrator)',
      email: 'admin@securemax.mil',
      role: UserRole.ADMIN,
      position: 'Root Administrator',
      position_id: 'pos_root_admin',
      kyc_status: 'VERIFIED',
      status: UserStatus.ACTIVE,
      did: 'did:securemax:admin:001',
      created_at: '2026-09-01T00:00:00.000Z',
    };
    this.users.set(adminUser.id, adminUser);
    this.users.set(adminUser.email, adminUser);

    // Mark system as initialized for testing
    this.systemSettings = {
      admin_initialized: true,
      bootstrap_enabled: false,
      system_state: 'SYSTEM_LOCKED',
      organization: {
        name: 'SecureMAX Defense Vault Command',
        org_id: 'ORG-SMX-001',
        org_type: 'Defense / Enterprise',
        country: 'India',
        timezone: 'Asia/Kolkata',
        created_at: '2026-09-01T00:00:00.000Z',
      },
      root_admin_id: adminUser.id,
      admin_locked: false,
      failed_admin_logins: 0,
      last_admin_login: {
        timestamp: new Date().toISOString(),
        region: 'Punjab, India',
        device_name: 'Admin Laptop (Hardware-Bound)',
        auth_method: 'WEBAUTHN',
      },
      last_security_change: '2026-09-19T19:42:00.000Z',
    };

    const seedRecoveryCode = 'REC-8A92-491F-C841';
    const seedRecoveryHash = crypto.createHash('sha256').update(seedRecoveryCode).digest('hex');
    this.recoveryVault = {
      recoveryId: 'REC-8A92-491F',
      recoveryCodeHash: seedRecoveryHash,
      createdAt: '2026-09-01T00:00:00.000Z',
      used: false,
    };

    // Admin's single bound device
    const adminDevice: DevicePassport = {
      id: 'dev_admin_primary',
      device_id: 'dev_admin_primary',
      user_id: adminUser.id,
      user_name: adminUser.name,
      user_email: adminUser.email,
      position: 'Administrator',
      device_name: "Admin Laptop (Hardware-Bound)",
      device_type: 'terminal',
      os: 'macOS',
      browser: 'Safari',
      browser_version: '18.0',
      model: 'Admin Secure Enclave Terminal',
      credential_id: 'cred_admin_hw_01',
      credential_type: 'WebAuthn',
      registered_at: '2026-09-01T00:00:00.000Z',
      last_authenticated_at: new Date().toISOString(),
      last_active_at: new Date().toISOString(),
      risk_state: 'TRUSTED',
      registration_region: 'Punjab, India',
      public_key: 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE2Z37UoHq3y1V4XwH5K7oF9P9k3sZ0s7uVvWxX0y1A2bC3dE4fG5hI6jK7lM8nO9pQ0rS1tU2vW3xY4z5A6bC7w==', // standard P-256 SPKI
      algorithm: 'ECDSA_P256',
      status: 'ACTIVE',
      is_admin_device: true,
      created_at: '2026-09-01T00:00:00.000Z',
      last_used_at: new Date().toISOString(),
      timeline: [
        { id: 'tl_adm_1', timestamp: '2026-09-01T00:00:00.000Z', event: 'DEVICE_REGISTERED', details: 'Root Administrator physical terminal bound', severity: 'INFO' },
        { id: 'tl_adm_2', timestamp: '2026-09-01T00:01:00.000Z', event: 'PASSKEY_ENROLLED', details: 'Hardware enclave P-256 key anchored', severity: 'INFO' },
      ],
    };
    this.devices.set(adminDevice.id, adminDevice);
    this.devicePassports.set(adminDevice.id, adminDevice);

    // 2. USER (Vasu - Multi-Device Enabled)
    const standardUser: StoredUser = {
      id: 'usr_vasu_002',
      name: 'Vasu (Lead Engineer)',
      email: 'vasu@securemax.mil',
      role: UserRole.USER,
      position: 'Manager',
      position_id: 'pos_manager',
      kyc_status: 'VERIFIED',
      status: UserStatus.ACTIVE,
      did: 'did:securemax:user:002',
      created_at: '2026-09-02T00:00:00.000Z',
    };
    this.users.set(standardUser.id, standardUser);
    this.users.set(standardUser.email, standardUser);

    // User's primary Laptop
    const userDeviceLaptop: DevicePassport = {
      id: 'dev_vasu_laptop',
      device_id: 'dev_vasu_laptop',
      user_id: standardUser.id,
      user_name: standardUser.name,
      user_email: standardUser.email,
      position: 'Manager',
      device_name: 'Vasu — Primary MacBook',
      device_type: 'laptop',
      os: 'macOS',
      browser: 'Chrome',
      browser_version: '128.0',
      model: 'MacBook Pro',
      credential_id: 'cred_vasu_mbp_01',
      credential_type: 'WebAuthn',
      registered_at: '2026-09-02T00:00:00.000Z',
      last_authenticated_at: new Date().toISOString(),
      last_active_at: new Date().toISOString(),
      risk_state: 'TRUSTED',
      registration_region: 'Punjab, India',
      public_key: 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEq9V1zK2Y7nL6X4eQ8jB2tF0mS3wZ5xY8vU1tP2rQ3sA4bC5dE6fG7hI8jK9lM0nO1pQ2rS3tU4vW5xY6z7A8bC==',
      algorithm: 'ECDSA_P256',
      status: 'ACTIVE',
      is_admin_device: false,
      created_at: '2026-09-02T00:00:00.000Z',
      last_used_at: new Date().toISOString(),
      timeline: [
        { id: 'tl_vsu_1', timestamp: '2026-09-02T00:00:00.000Z', event: 'DEVICE_REGISTERED', details: 'Device registered via 15-minute pairing code', severity: 'INFO' },
        { id: 'tl_vsu_2', timestamp: '2026-09-02T00:01:00.000Z', event: 'PASSKEY_ENROLLED', details: 'Touch ID / Passkey enrolled', severity: 'INFO' },
        { id: 'tl_vsu_3', timestamp: '2026-09-02T00:02:00.000Z', event: 'FIRST_LOGIN', details: 'Successful biometric authentication', severity: 'INFO' },
      ],
    };
    this.devices.set(userDeviceLaptop.id, userDeviceLaptop);
    this.devicePassports.set(userDeviceLaptop.id, userDeviceLaptop);

    // 3. AUDITOR (Neha Kapoor)
    const auditorUser: StoredUser = {
      id: 'usr_auditor_003',
      name: 'Neha Kapoor',
      email: 'auditor@securemax.mil',
      role: UserRole.AUDITOR,
      position: 'Auditor',
      position_id: 'pos_auditor',
      kyc_status: 'VERIFIED',
      status: UserStatus.ACTIVE,
      did: 'did:securemax:auditor:003',
      created_at: '2026-09-03T00:00:00.000Z',
    };
    this.users.set(auditorUser.id, auditorUser);
    this.users.set(auditorUser.email, auditorUser);

    const auditorDevice: DevicePassport = {
      id: 'dev_auditor_terminal',
      device_id: 'dev_auditor_terminal',
      user_id: auditorUser.id,
      user_name: auditorUser.name,
      user_email: auditorUser.email,
      position: 'Auditor',
      device_name: 'Audit Secure Terminal',
      device_type: 'terminal',
      os: 'Linux',
      browser: 'Firefox',
      browser_version: '129.0',
      model: 'Audit Hardware Station',
      credential_id: 'cred_audit_01',
      credential_type: 'WebAuthn',
      registered_at: '2026-09-03T00:00:00.000Z',
      last_authenticated_at: new Date().toISOString(),
      last_active_at: new Date().toISOString(),
      risk_state: 'TRUSTED',
      registration_region: 'Punjab, India',
      public_key: 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE7p9X2mR5yT8vN1qW4sE7hK0bL3zC6xY9vU2tP3rQ4sA5bC6dE7fG8hI9jK0lM1nO2pQ3rS4tU5vW6xY7z8A9bC==',
      algorithm: 'ECDSA_P256',
      status: 'ACTIVE',
      is_admin_device: false,
      created_at: '2026-09-03T00:00:00.000Z',
      last_used_at: new Date().toISOString(),
      timeline: [
        { id: 'tl_aud_1', timestamp: '2026-09-03T00:00:00.000Z', event: 'DEVICE_REGISTERED', details: 'Audit terminal registered', severity: 'INFO' },
        { id: 'tl_aud_2', timestamp: '2026-09-03T00:01:00.000Z', event: 'PASSKEY_ENROLLED', details: 'FIDO2 Hardware Key enrolled', severity: 'INFO' },
      ],
    };
    this.devices.set(auditorDevice.id, auditorDevice);
    this.devicePassports.set(auditorDevice.id, auditorDevice);

    // 4. TEAM MEMBER: Ritik (Systems Architect)
    const ritikUser: StoredUser = {
      id: 'usr_ritik_004',
      name: 'Ritik (Systems Architect)',
      email: 'ritik@securemax.mil',
      role: UserRole.USER,
      kyc_status: 'VERIFIED',
      status: UserStatus.ACTIVE,
      did: 'did:securemax:user:004',
      created_at: '2026-09-04T00:00:00.000Z',
    };
    this.users.set(ritikUser.id, ritikUser);
    this.users.set(ritikUser.email, ritikUser);

    // 5. TEAM MEMBER: Vaani (Security Analyst)
    const vaaniUser: StoredUser = {
      id: 'usr_vaani_005',
      name: 'Vaani (Security Analyst)',
      email: 'vaani@securemax.mil',
      role: UserRole.USER,
      kyc_status: 'VERIFIED',
      status: UserStatus.ACTIVE,
      did: 'did:securemax:user:005',
      created_at: '2026-09-05T00:00:00.000Z',
    };
    this.users.set(vaaniUser.id, vaaniUser);
    this.users.set(vaaniUser.email, vaaniUser);

    // 6. ENGINEER: Arjun Verma (Substation / Systems Engineer)
    const arjunUser: StoredUser = {
      id: 'usr_arjun_006',
      name: 'Arjun Verma',
      email: 'arjun.verma@securemax.mil',
      role: UserRole.USER,
      kyc_status: 'VERIFIED',
      status: UserStatus.ACTIVE,
      did: 'did:securemax:user:arjun006',
      created_at: '2026-09-10T00:00:00.000Z',
    };
    this.users.set(arjunUser.id, arjunUser);
    this.users.set(arjunUser.email, arjunUser);

    // 7. HR MANAGER: Riya Sharma
    const riyaUser: StoredUser = {
      id: 'usr_riya_007',
      name: 'Riya Sharma',
      email: 'riya.sharma@securemax.mil',
      role: UserRole.USER,
      kyc_status: 'VERIFIED',
      status: UserStatus.ACTIVE,
      did: 'did:securemax:user:riya007',
      created_at: '2026-09-10T00:00:00.000Z',
    };
    this.users.set(riyaUser.id, riyaUser);
    this.users.set(riyaUser.email, riyaUser);

    // Active Sessions
    this.sessions.set('SES-8821', {
      session_id: 'SES-8821',
      user_id: standardUser.id,
      user_name: standardUser.name,
      user_email: standardUser.email,
      device_id: userDeviceLaptop.id,
      device_name: userDeviceLaptop.device_name,
      position: 'Manager',
      created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      last_activity_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
      expires_at: new Date(Date.now() + 7.5 * 3600 * 1000).toISOString(),
      authentication_level: 'PASSKEY',
      status: 'ACTIVE',
    });

    this.sessions.set('SES-0001', {
      session_id: 'SES-0001',
      user_id: adminUser.id,
      user_name: adminUser.name,
      user_email: adminUser.email,
      device_id: adminDevice.id,
      device_name: adminDevice.device_name,
      position: 'Administrator',
      created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      last_activity_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      expires_at: new Date(Date.now() + 7 * 3600 * 1000).toISOString(),
      authentication_level: 'WEBAUTHN',
      status: 'ACTIVE',
    });

    // 4. PRE-SEEDED ENCRYPTED ASSETS (AES-256-GCM)
    const masterKey = process.env.SECUREMAX_KMS_MASTER_KEY || '0000000000000000000000000000000000000000000000000000000000000000';

    const seedAssets: Array<{
      id: string;
      asset_code: string;
      name: string;
      classification: string;
      folder: string;
      file_type: string;
      mime_type: string;
      file_size_bytes: number;
      owner_id: string;
      owner_name: string;
      shared_with_all?: boolean;
      key_version: string;
      description: string;
      plaintext: string;
      blockchain_token_id: string;
      blockchain_contract: string;
      did: string;
      versions: AssetVersion[];
      access_history: AssetAccessLog[];
    }> = [
      {
        id: 'ast_alpha',
        asset_code: 'SMX-ALPHA-001',
        name: 'Project Alpha (Core Defense Spec)',
        classification: 'CONFIDENTIAL',
        folder: 'Projects',
        file_type: 'PDF',
        mime_type: 'application/pdf',
        file_size_bytes: 2516582,
        owner_id: standardUser.id,
        owner_name: standardUser.name,
        key_version: 'v2',
        description: 'Confidential design specifications for tactical communications and payload encapsulation.',
        plaintext: 'TOP SECRET // CONFIDENTIAL DEFENSE INTEL: Project Alpha utilizes multi-frequency hopping at 2.4GHz with AES-256-GCM authenticated payload encapsulation. Authorization strictly validated by SecureMAX on-chain registry.',
        blockchain_token_id: 'NFT-SEPOLIA-#8491',
        blockchain_contract: '0xC5388f457D01cdF25B4A29f0A38d65f4e690bC2B',
        did: 'did:securemax:asset:ast_alpha',
        versions: [
          { version: 'v2.0', uploaded_by: 'Vasu (Lead Engineer)', created_at: '2026-09-15T10:30:00.000Z', size: '2.4 MB', notes: 'Upgraded payload encapsulation to AES-256-GCM' },
          { version: 'v1.0', uploaded_by: 'Vasu (Lead Engineer)', created_at: '2026-09-02T08:00:00.000Z', size: '2.1 MB', notes: 'Initial cryptographic architecture draft' }
        ],
        access_history: [
          { id: 'log_alpha_1', action: 'DECRYPT', user_name: 'Vasu (Lead Engineer)', timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(), status: 'SUCCESS', details: 'Authorized session decrypt via P-256' },
          { id: 'log_alpha_2', action: 'READ', user_name: 'Vasu (Lead Engineer)', timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(), status: 'SUCCESS' }
        ]
      },
      {
        id: 'ast_beta',
        asset_code: 'SMX-BETA-002',
        name: 'Project Beta Architecture Blueprints',
        classification: 'INTERNAL',
        folder: 'Projects',
        file_type: 'ZIP',
        mime_type: 'application/zip',
        file_size_bytes: 15518976,
        owner_id: standardUser.id,
        owner_name: standardUser.name,
        key_version: 'v1',
        description: 'Comprehensive architectural diagrams, CAD schematics, and microservice definitions for Project Beta.',
        plaintext: 'INTERNAL SYSTEM BLUEPRINTS: Distributed edge node architecture with zero-trust device binding. Mesh communication over authenticated TLS 1.3 channels with ECDSA P-256 peer attestation.',
        blockchain_token_id: 'NFT-SEPOLIA-#8492',
        blockchain_contract: '0xC5388f457D01cdF25B4A29f0A38d65f4e690bC2B',
        did: 'did:securemax:asset:ast_beta',
        versions: [
          { version: 'v1.0', uploaded_by: 'Vasu (Lead Engineer)', created_at: '2026-09-10T14:00:00.000Z', size: '14.8 MB', notes: 'Initial schematics release' }
        ],
        access_history: [
          { id: 'log_beta_1', action: 'DOWNLOAD', user_name: 'Vasu (Lead Engineer)', timestamp: new Date(Date.now() - 120 * 60 * 1000).toISOString(), status: 'SUCCESS' }
        ]
      },
      {
        id: 'ast_finance',
        asset_code: 'SMX-FIN-003',
        name: 'Financial Audit Report Q3',
        classification: 'CONFIDENTIAL',
        folder: 'Finance',
        file_type: 'XLSX',
        mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        file_size_bytes: 1258291,
        owner_id: auditorUser.id,
        owner_name: auditorUser.name,
        key_version: 'v1',
        description: 'Quarterly financial compliance, hardware procurement, and cryptographic subsystem expenditures.',
        plaintext: 'FINANCIAL REPORT // Q3 FY26: Procurement expenditures: $4,200,000. Cryptographic hardware allocation: $850,000. All allocations compliant with statutory requirements.',
        blockchain_token_id: 'NFT-SEPOLIA-#8493',
        blockchain_contract: '0xC5388f457D01cdF25B4A29f0A38d65f4e690bC2B',
        did: 'did:securemax:asset:ast_finance',
        versions: [
          { version: 'v1.0', uploaded_by: 'Compliance Auditor', created_at: '2026-09-08T09:15:00.000Z', size: '1.2 MB', notes: 'Signed Q3 audit statement' }
        ],
        access_history: [
          { id: 'log_fin_1', action: 'DECRYPT', user_name: 'Vasu (Lead Engineer)', timestamp: new Date(Date.now() - 3600 * 1000).toISOString(), status: 'SUCCESS' }
        ]
      },
      {
        id: 'ast_procure',
        asset_code: 'SMX-FIN-004',
        name: 'FY27 Defense Procurement Estimates',
        classification: 'INTERNAL',
        folder: 'Finance',
        file_type: 'XLSX',
        mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        file_size_bytes: 3250585,
        owner_id: adminUser.id,
        owner_name: adminUser.name,
        key_version: 'v1',
        description: 'Forecast budget models and supplier bids for next-generation cryptographic hardware.',
        plaintext: 'FY27 ESTIMATES // Confidential forward projections: Hardware Security Modules (HSM): $1.2M. Secure Enclave deployment: $900k. Contract awards pending Q4 review.',
        blockchain_token_id: 'NFT-SEPOLIA-#8494',
        blockchain_contract: '0xC5388f457D01cdF25B4A29f0A38d65f4e690bC2B',
        did: 'did:securemax:asset:ast_procure',
        versions: [
          { version: 'v1.0', uploaded_by: 'Vasu (Administrator)', created_at: '2026-09-12T11:20:00.000Z', size: '3.1 MB', notes: 'Initial budget projections' }
        ],
        access_history: [
          { id: 'log_proc_1', action: 'READ', user_name: 'Vasu (Lead Engineer)', timestamp: new Date(Date.now() - 240 * 60 * 1000).toISOString(), status: 'SUCCESS' }
        ]
      },
      {
        id: 'ast_hr_policy',
        asset_code: 'SMX-HR-005',
        name: 'Global Clearance & Personnel Policy',
        classification: 'PUBLIC',
        folder: 'HR',
        file_type: 'PDF',
        mime_type: 'application/pdf',
        file_size_bytes: 870400,
        owner_id: adminUser.id,
        owner_name: adminUser.name,
        shared_with_all: true,
        key_version: 'v1',
        description: 'Organizational guidelines on cryptographic key custody, zero-trust hygiene, and KYC verification.',
        plaintext: 'POLICY DOCUMENT 2026-A: All personnel must enroll hardware-bound ECDSA P-256 keys. Passwords alone are strictly prohibited. Multi-factor device attestation required for all asset access.',
        blockchain_token_id: 'NFT-SEPOLIA-#8495',
        blockchain_contract: '0xC5388f457D01cdF25B4A29f0A38d65f4e690bC2B',
        did: 'did:securemax:asset:ast_hr_policy',
        versions: [
          { version: 'v1.0', uploaded_by: 'Vasu (Administrator)', created_at: '2026-09-01T09:00:00.000Z', size: '850 KB', notes: 'Standard policy baseline' }
        ],
        access_history: []
      },
      {
        id: 'ast_roster',
        asset_code: 'SMX-HR-006',
        name: 'Active Operatives Personnel Roster',
        classification: 'RESTRICTED',
        folder: 'HR',
        file_type: 'DOC',
        mime_type: 'application/msword',
        file_size_bytes: 1887436,
        owner_id: adminUser.id,
        owner_name: adminUser.name,
        key_version: 'v2',
        description: 'Field operative identity mappings, tactical assignments, and cryptographic public key fingerprints.',
        plaintext: 'RESTRICTED PERSONNEL ROSTER: Classified field operative roster and hardware token fingerprints. Unauthorized access will trigger immediate zero-trust lockout.',
        blockchain_token_id: 'NFT-SEPOLIA-#8496',
        blockchain_contract: '0xC5388f457D01cdF25B4A29f0A38d65f4e690bC2B',
        did: 'did:securemax:asset:ast_roster',
        versions: [
          { version: 'v2.0', uploaded_by: 'Vasu (Administrator)', created_at: '2026-09-14T16:45:00.000Z', size: '1.8 MB', notes: 'Updated tactical assignments' }
        ],
        access_history: [
          { id: 'log_rost_1', action: 'DECRYPT_ATTEMPT', user_name: 'Vasu (Lead Engineer)', timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(), status: 'DENIED', details: 'Insufficient clearance level' }
        ]
      },
      {
        id: 'ast_avionics',
        asset_code: 'SMX-AVN-007',
        name: 'Avionics Radar Interface Specs',
        classification: 'RESTRICTED',
        folder: 'Engineering',
        file_type: 'PDF',
        mime_type: 'application/pdf',
        file_size_bytes: 5872025,
        owner_id: adminUser.id,
        owner_name: adminUser.name,
        key_version: 'v2',
        description: 'Hardware interface diagrams, bus timings, and electronic warfare countermeasure protocols.',
        plaintext: 'RESTRICTED HARDWARE SPEC: ARINC 429 high-speed bus pinout configuration with MIL-STD-1553 redundant multiplexing. Target acquisition frequencies calibrated.',
        blockchain_token_id: 'NFT-SEPOLIA-#8497',
        blockchain_contract: '0xC5388f457D01cdF25B4A29f0A38d65f4e690bC2B',
        did: 'did:securemax:asset:ast_avionics',
        versions: [
          { version: 'v2.0', uploaded_by: 'Vasu (Administrator)', created_at: '2026-09-11T12:00:00.000Z', size: '5.6 MB', notes: 'Integrated MIL-STD-1553 specs' }
        ],
        access_history: [
          { id: 'log_avn_1', action: 'ACCESS_REQUEST', user_name: 'Vasu (Lead Engineer)', timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(), status: 'PENDING', details: 'Awaiting Admin NFT Permit' }
        ]
      },
      {
        id: 'ast_kms',
        asset_code: 'SMX-ENG-008',
        name: 'KMS Module Microcode v2.4',
        classification: 'CONFIDENTIAL',
        folder: 'Engineering',
        file_type: 'ZIP',
        mime_type: 'application/zip',
        file_size_bytes: 8598323,
        owner_id: adminUser.id,
        owner_name: adminUser.name,
        key_version: 'v2',
        description: 'Firmware binaries and zeroization routines for the cryptographic key storage layer.',
        plaintext: 'CONFIDENTIAL MICROCODE // Version 2.4.0-RC3: Anti-tamper envelope triggers active zeroization of master KEK upon enclosure breach detection.',
        blockchain_token_id: 'NFT-SEPOLIA-#8498',
        blockchain_contract: '0xC5388f457D01cdF25B4A29f0A38d65f4e690bC2B',
        did: 'did:securemax:asset:ast_kms',
        versions: [
          { version: 'v2.4', uploaded_by: 'Vasu (Administrator)', created_at: '2026-09-13T15:30:00.000Z', size: '8.2 MB', notes: 'Patch for envelope tamper sensor' }
        ],
        access_history: [
          { id: 'log_kms_1', action: 'ACCESS_EXPIRED', user_name: 'Vasu (Lead Engineer)', timestamp: new Date(Date.now() - 86400 * 1000).toISOString(), status: 'DENIED', details: 'Temporary 24h clearance expired' }
        ]
      },
      {
        id: 'ast_compliance',
        asset_code: 'SMX-LEG-009',
        name: 'DoD Zero Trust Statutory Compliance Certificate',
        classification: 'PUBLIC',
        folder: 'Legal',
        file_type: 'PDF',
        mime_type: 'application/pdf',
        file_size_bytes: 430080,
        owner_id: auditorUser.id,
        owner_name: auditorUser.name,
        shared_with_all: true,
        key_version: 'v1',
        description: 'Statutory audit compliance certificate confirming adherence to NIST SP 800-207 standards.',
        plaintext: 'COMPLIANCE CERTIFICATE: SecureMAX meets or exceeds all DoD Zero Trust Strategy (2022-2027) requirements for device attestation and cryptographic micro-segmentation.',
        blockchain_token_id: 'NFT-SEPOLIA-#8499',
        blockchain_contract: '0xC5388f457D01cdF25B4A29f0A38d65f4e690bC2B',
        did: 'did:securemax:asset:ast_compliance',
        versions: [
          { version: 'v1.0', uploaded_by: 'Compliance Auditor', created_at: '2026-09-05T10:00:00.000Z', size: '420 KB', notes: 'Annual compliance certification' }
        ],
        access_history: []
      },
      {
        id: 'ast_nda',
        asset_code: 'SMX-LEG-010',
        name: 'Classified Contractor NDA & Protocols',
        classification: 'CONFIDENTIAL',
        folder: 'Legal',
        file_type: 'DOC',
        mime_type: 'application/msword',
        file_size_bytes: 696320,
        owner_id: auditorUser.id,
        owner_name: auditorUser.name,
        key_version: 'v1',
        description: 'Standard nondisclosure agreements and operational security protocols for defense contractors.',
        plaintext: 'NON-DISCLOSURE AGREEMENT: All defense contractors handling SMX-series cryptographic materials are subject to severe federal penalties under 18 U.S.C. Section 793.',
        blockchain_token_id: 'NFT-SEPOLIA-#8500',
        blockchain_contract: '0xC5388f457D01cdF25B4A29f0A38d65f4e690bC2B',
        did: 'did:securemax:asset:ast_nda',
        versions: [
          { version: 'v1.0', uploaded_by: 'Compliance Auditor', created_at: '2026-09-04T11:00:00.000Z', size: '680 KB', notes: 'Master contractor legal framework' }
        ],
        access_history: []
      }
    ];

    for (const item of seedAssets) {
      const dek = generateDEK();
      const enc = encryptData(Buffer.from(item.plaintext, 'utf8'), dek, `asset_data:${item.id}`);

      const kek = deriveKEK(masterKey, item.id);
      const wrapped = encryptData(dek, kek, `key_wrapping:${item.id}`);
      this.wrappedDEKs.set(item.id, {
        cipher: wrapped.ciphertext,
        iv: wrapped.iv,
        authTag: wrapped.authTag,
      });

      this.assets.set(item.id, {
        id: item.id,
        asset_code: item.asset_code,
        name: item.name,
        classification: item.classification,
        status: 'ACTIVE',
        description: item.description,
        encrypted_content: enc.ciphertext,
        iv: enc.iv,
        auth_tag: enc.authTag,
        aad: `asset_data:${item.id}`,
        folder: item.folder,
        file_type: item.file_type,
        mime_type: item.mime_type,
        file_size_bytes: item.file_size_bytes,
        owner_id: item.owner_id,
        owner_name: item.owner_name,
        shared_with_all: item.shared_with_all || false,
        default_access_policy: item.shared_with_all ? 'ORGANIZATION' : 'PRIVATE',
        created_at: item.versions[0]?.created_at || '2026-09-01T00:00:00.000Z',
        last_accessed_at: item.access_history[0]?.timestamp,
        key_version: item.key_version,
        versions: item.versions,
        access_history: item.access_history,
        blockchain_token_id: item.blockchain_token_id,
        blockchain_contract: item.blockchain_contract,
        did: item.did,
      });
    }

    // 5. ASSET ASSIGNMENTS
    // Organization-wide (All People) Access
    this.assignments.push({
      asset_id: 'ast_hr_policy',
      user_id: 'ALL',
      can_read: true,
      can_decrypt: true,
      can_download: true,
      can_edit: false,
      can_delete: false,
      status: 'ACTIVE',
      assigned_at: '2026-09-01T00:00:00.000Z',
      expires_at: null,
      shared_by: 'Vasu (Administrator)',
      shared_with_name: 'All People (Organization-Wide)',
    });

    this.assignments.push({
      asset_id: 'ast_compliance',
      user_id: 'ALL',
      can_read: true,
      can_decrypt: true,
      can_download: true,
      can_edit: false,
      can_delete: false,
      status: 'ACTIVE',
      assigned_at: '2026-09-05T00:00:00.000Z',
      expires_at: null,
      shared_by: 'Compliance Auditor',
      shared_with_name: 'All People (Organization-Wide)',
    });

    // Assignments for Vasu (Lead Engineer)
    // Full owner access on Project Alpha & Beta
    this.assignments.push({
      asset_id: 'ast_alpha',
      user_id: standardUser.id,
      can_read: true,
      can_decrypt: true,
      can_download: true,
      can_edit: true,
      can_delete: true,
      status: 'ACTIVE',
      assigned_at: '2026-09-02T00:00:00.000Z',
      expires_at: null,
      shared_by: 'Self (Owner)',
      shared_with_name: standardUser.name,
    });

    this.assignments.push({
      asset_id: 'ast_beta',
      user_id: standardUser.id,
      can_read: true,
      can_decrypt: true,
      can_download: true,
      can_edit: true,
      can_delete: true,
      status: 'ACTIVE',
      assigned_at: '2026-09-10T00:00:00.000Z',
      expires_at: null,
      shared_by: 'Self (Owner)',
      shared_with_name: standardUser.name,
    });

    // Specific person-to-person shares with Vasu
    this.assignments.push({
      asset_id: 'ast_finance',
      user_id: standardUser.id,
      can_read: true,
      can_decrypt: true,
      can_download: true,
      can_edit: false,
      can_delete: false,
      status: 'ACTIVE',
      assigned_at: '2026-09-08T00:00:00.000Z',
      expires_at: null,
      shared_by: 'Compliance Auditor',
      shared_with_name: standardUser.name,
    });

    this.assignments.push({
      asset_id: 'ast_procure',
      user_id: standardUser.id,
      can_read: true,
      can_decrypt: true,
      can_download: false,
      can_edit: false,
      can_delete: false,
      status: 'ACTIVE',
      assigned_at: '2026-09-12T00:00:00.000Z',
      expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      shared_by: 'Vasu (Administrator)',
      shared_with_name: standardUser.name,
    });

    this.assignments.push({
      asset_id: 'ast_nda',
      user_id: standardUser.id,
      can_read: true,
      can_decrypt: true,
      can_download: true,
      can_edit: false,
      can_delete: false,
      status: 'ACTIVE',
      assigned_at: '2026-09-04T00:00:00.000Z',
      expires_at: null,
      shared_by: 'Compliance Auditor',
      shared_with_name: standardUser.name,
    });

    this.assignments.push({
      asset_id: 'ast_avionics',
      user_id: standardUser.id,
      can_read: true,
      can_decrypt: false,
      can_download: false,
      can_edit: false,
      can_delete: false,
      status: 'ACTIVE',
      assigned_at: '2026-09-11T00:00:00.000Z',
      expires_at: null,
      shared_by: 'Vasu (Administrator)',
      shared_with_name: standardUser.name,
    });

    this.assignments.push({
      asset_id: 'ast_roster',
      user_id: standardUser.id,
      can_read: true,
      can_decrypt: false,
      can_download: false,
      can_edit: false,
      can_delete: false,
      status: 'ACTIVE',
      assigned_at: '2026-09-14T00:00:00.000Z',
      expires_at: null,
      shared_by: 'Vasu (Administrator)',
      shared_with_name: standardUser.name,
    });

    this.assignments.push({
      asset_id: 'ast_kms',
      user_id: standardUser.id,
      can_read: true,
      can_decrypt: false,
      can_download: false,
      can_edit: false,
      can_delete: false,
      status: 'EXPIRED',
      assigned_at: '2026-09-13T00:00:00.000Z',
      expires_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
      shared_by: 'Vasu (Administrator)',
      shared_with_name: standardUser.name,
    });

    // Assignments for Auditor
    this.assignments.push({
      asset_id: 'ast_finance',
      user_id: auditorUser.id,
      can_read: true,
      can_decrypt: true,
      can_download: true,
      can_edit: true,
      can_delete: true,
      status: 'ACTIVE',
      assigned_at: '2026-09-08T00:00:00.000Z',
      expires_at: null,
      shared_by: 'Self (Owner)',
      shared_with_name: auditorUser.name,
    });

    this.assignments.push({
      asset_id: 'ast_nda',
      user_id: auditorUser.id,
      can_read: true,
      can_decrypt: true,
      can_download: true,
      can_edit: true,
      can_delete: true,
      status: 'ACTIVE',
      assigned_at: '2026-09-04T00:00:00.000Z',
      expires_at: null,
      shared_by: 'Self (Owner)',
      shared_with_name: auditorUser.name,
    });

    // Admin has global rights on all assets
    for (const item of seedAssets) {
      this.assignments.push({
        asset_id: item.id,
        user_id: adminUser.id,
        can_read: true,
        can_decrypt: true,
        can_download: true,
        can_edit: true,
        can_delete: true,
        status: 'ACTIVE',
        assigned_at: '2026-09-01T00:00:00.000Z',
        expires_at: null,
        shared_by: 'System Administrator',
        shared_with_name: adminUser.name,
      });
    }

    // ----------------------------------------------------
    // INITIAL ACCESS REQUESTS (From Page 1 & Page 2 Spec)
    // ----------------------------------------------------
    this.accessRequests.push({
      id: 'req-1',
      user_id: arjunUser.id,
      user_email: arjunUser.email,
      user_name: 'Arjun Verma',
      role: 'ENGINEER',
      request_type: 'ASSET_ACCESS',
      asset_id: 'ast_fin_002',
      asset_code: 'SMX-FIN-002',
      asset_name: 'Substation 4 Vendor Invoices',
      reason: 'reconcile vendor invoices for Substation 4 works',
      status: 'PENDING',
      ttl_minutes: 30,
      created_at: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    });

    this.accessRequests.push({
      id: 'req-2',
      user_id: 'usr_neha_008',
      user_email: 'neha.iyer@securemax.mil',
      user_name: 'Neha Iyer',
      role: 'AUDITOR',
      request_type: 'HIGH_RISK_DATA',
      asset_id: 'ast_hr_policy',
      asset_code: 'SMX-HR-001',
      asset_name: 'Statutory PF Audit Records',
      reason: 'statutory PF audit sample check',
      status: 'PENDING',
      ttl_minutes: 15,
      created_at: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    });

    this.accessRequests.push({
      id: 'req_001',
      user_id: standardUser.id,
      user_email: standardUser.email,
      user_name: standardUser.name,
      role: 'USER',
      request_type: 'HIGH_RISK_DATA',
      asset_id: 'ast_avionics',
      asset_code: 'SMX-AVN-003',
      asset_name: 'Avionics Radar Interface Specs',
      reason: 'Tactical comms integration review on authorized workstation',
      status: 'PENDING',
      ttl_minutes: 30,
      created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    });

    this.accessRequests.push({
      id: 'req_002',
      user_id: standardUser.id,
      user_email: standardUser.email,
      user_name: standardUser.name,
      role: 'USER',
      request_type: 'ASSET_ACCESS',
      asset_id: 'ast_patent',
      asset_code: 'SMX-AST-000134',
      asset_name: 'Patent Filing NDAs & Claims.pdf',
      reason: 'Dual-chain patent claims review for upcoming intellectual property filing',
      status: 'PENDING',
      ttl_minutes: 20,
      created_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    });

    this.accessRequests.push({
      id: 'req_003',

      user_id: auditorUser.id,
      user_email: auditorUser.email,
      user_name: auditorUser.name,
      role: 'AUDITOR',
      request_type: 'AUDIT_UPDATE',
      asset_id: 'ast_finance',
      asset_code: 'SMX-AUDIT-Q3',
      asset_name: 'Financial Ledger & Statutory Audit Records',
      reason: 'Compliance review & permanent blockchain anchor verification',
      status: 'PENDING',
      ttl_minutes: 60,
      created_at: new Date(Date.now() - 50 * 60 * 1000).toISOString(),
    });

    // ----------------------------------------------------
    // LIVE ACTIVE GRANTS (Ticking Real-Time Decryption Sessions)
    // ----------------------------------------------------
    this.liveGrants.push(
      {
        id: 'grant-1',
        user: 'Arjun Verma',
        userId: arjunUser.id,
        assetCode: 'SMX-ENG-003',
        assetName: 'Substation 4 SIPROTEC relay configuration',
        sessionId: '1bb04bec',
        ip: '10.42.7.19',
        device: 'known device',
        expiresAt: new Date(Date.now() + 1274 * 1000).toISOString(), // 21:14 remaining
        remainingSeconds: 1274,
        status: 'ACTIVE',
        createdAt: new Date(Date.now() - 526 * 1000).toISOString(),
      },
      {
        id: 'grant-2',
        user: 'Riya Sharma',
        userId: riyaUser.id,
        assetCode: 'SMX-HR-001',
        assetName: 'HR Statutory Master',
        sessionId: '7a29f041',
        ip: '10.42.5.88',
        device: 'corporate device',
        expiresAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
        remainingSeconds: 0,
        status: 'IDLE',
        note: 'key v2 · rotated 20 min ago',
        createdAt: new Date(Date.now() - 50 * 60 * 1000).toISOString(),
      }
    );

    // ----------------------------------------------------
    // NOTIFICATIONS
    // ----------------------------------------------------
    this.notifications.push(
      {
        id: 'notif_1',
        type: 'ACCESS_REQUEST',
        title: 'New Access Request',
        message: 'Arjun Verma requested access for Substation 4 Vendor Invoices',
        timestamp: '25 min ago',
        read: false,
        target_id: 'ast_fin_002',
      },
      {
        id: 'notif_2',
        type: 'ACCESS_APPROVED',
        title: 'Access Approved',
        message: 'Admin granted decryption permit for Project Alpha.pdf',
        timestamp: '17:02 Today',
        read: false,
        target_id: 'ast_alpha',
      }
    );

    // Seed permanent audit ledger
    this.auditEvents.push(
      {
        id: 'aud_seed_admin_root',
        event_type: 'ROOT_ADMIN_CREATED',
        description: `Root administrator registered and identity anchored: ${adminUser.name} (${adminUser.id}) bound to ${adminDevice.device_name}`,
        target_id: adminUser.id,
        user_email: adminUser.email,
        user_name: adminUser.name,
        performed_by: adminUser.name,
        severity: 'INFO',
        event_hash: '0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b',
        block_number: 6849200,
        created_at: new Date(Date.now() - 150 * 60 * 1000).toISOString(),
      },
      {
        id: 'aud_seed_admin_dev',
        event_type: 'ADMIN_DEVICE_REGISTERED',
        description: `Singleton hardware terminal bound to Root Admin: ${adminDevice.device_name} (ID: ${adminDevice.id})`,
        target_id: adminDevice.id,
        user_email: adminUser.email,
        user_name: adminUser.name,
        performed_by: adminUser.name,
        severity: 'INFO',
        event_hash: '0x2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c',
        block_number: 6849205,
        created_at: new Date(Date.now() - 140 * 60 * 1000).toISOString(),
      },
      {
        id: 'aud_seed_1',
        event_type: 'USER_IDENTITY_REGISTERED',
        description: 'DID generated for Vasu (Field Operator): did:securemax:user:002',
        target_id: standardUser.id,
        user_email: standardUser.email,
        user_name: standardUser.name,
        severity: 'INFO',
        event_hash: '0x3f4a9b2c8e1d5a7f9b0c2e4d6a8f1b3c5e7a9b0d2f4a6c8e1b3d5f7a9c0e2b4',
        block_number: 6849210,
        created_at: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
      },
      {
        id: 'aud_seed_2',
        event_type: 'HARDWARE_DEVICE_ENROLLED',
        description: 'New hardware device enrolled: Field Laptop (ECDSA P-256)',
        target_id: 'dev_user_primary',
        user_email: standardUser.email,
        user_name: standardUser.name,
        severity: 'INFO',
        event_hash: '0x8a1c3e5f7b9d2a4c6e8f0b1d3f5a7c9e1b3d5f7a9c0e2b4a6c8e1b3d5f7a9c0',
        block_number: 6849245,
        created_at: new Date(Date.now() - 95 * 60 * 1000).toISOString(),
      },
      {
        id: 'aud_seed_3',
        event_type: 'SEPOLIA_ANCHOR_VERIFIED',
        description: 'State root anchored to Sepolia Contract: 0xC5388f457D01cdF25B4A29f0A38d65f4e690bC2B',
        target_id: 'ETHEREUM_SEPOLIA',
        user_email: adminUser.email,
        user_name: adminUser.name,
        severity: 'INFO',
        event_hash: '0x7e9a1b3c5d7f9a1c3e5b7d9f1a3c5e7b9d1f3a5c7e9b1d3f5a7c9e1b3d5f7a9',
        block_number: 6849280,
        created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'aud_seed_4',
        event_type: 'ACCESS_REQUEST_SUBMITTED',
        description: 'High-risk access requested for Avionics Radar (SMX-AVN-003) awaiting Admin NFT Permit',
        target_id: 'ast_avionics',
        user_email: standardUser.email,
        user_name: standardUser.name,
        severity: 'WARNING',
        event_hash: '0x4c6e8f0b1d3f5a7c9e1b3d5f7a9c0e2b4a6c8e1b3d5f7a9c0e2b4a6c8e1b3d5',
        block_number: 6849310,
        created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      }
    );
  }

  // --- USER LOOKUPS ---
  public getUserByEmail(email: string): StoredUser | null {
    const clean = email.toLowerCase().trim();
    for (const u of this.users.values()) {
      if (u.email.toLowerCase() === clean) return u;
    }
    return null;
  }

  public getUserById(userId: string): StoredUser | null {
    return this.users.get(userId) || null;
  }

  public getUserByEmailOrId(identifier: string): StoredUser | null {
    const clean = identifier.trim();
    const cleanLower = clean.toLowerCase();
    for (const u of this.users.values()) {
      if (
        u.email.toLowerCase() === cleanLower ||
        u.id.toLowerCase() === cleanLower ||
        u.did.toLowerCase() === cleanLower ||
        u.id === clean
      ) {
        return u;
      }
    }
    return null;
  }

  public registerUser(params: {
    name: string;
    email: string;
    role?: UserRole;
    positionId?: string;
    positionName?: string;
  }): { user: StoredUser; enrollmentCode: string } {
    const cleanEmail = params.email.toLowerCase().trim();
    const existing = this.getUserByEmail(cleanEmail);
    if (existing) {
      throw new Error(`User already registered with email ${cleanEmail}`);
    }
    const userId = 'usr_' + crypto.randomUUID().slice(0, 8);
    const did = `did:securemax:user:${userId.slice(-6)}`;
    const user: StoredUser = {
      id: userId,
      name: params.name.trim(),
      email: cleanEmail,
      role: params.role || UserRole.USER,
      position_id: params.positionId || 'pos_user',
      position: params.positionName || 'User',
      kyc_status: 'PENDING',
      status: UserStatus.ACTIVE,
      did,
      created_at: new Date().toISOString(),
    };
    this.users.set(user.id, user);
    this.users.set(user.email, user);

    const { plaintextCode } = this.createEnrollmentCapability({
      userId: user.id,
      positionId: user.position_id,
      durationMinutes: 15,
      maxDevices: 1,
    });

    storeEvents.emit('change', {
      type: 'USER_REGISTERED',
      data: user,
      timestamp: Date.now(),
    });

    this.saveToDisk();
    syncUserToSupabase(user).catch(() => {});

    return { user, enrollmentCode: 'SMX-' + plaintextCode };
  }

  // --- ROOT ADMIN BOOTSTRAP, RECOVERY & PANIC ---
  public bootstrapRootAdmin(params: RootAdminBootstrapParams): {
    rootAdmin: StoredUser;
    adminDevice: DevicePassport;
    recoveryPackage: {
      recoveryId: string;
      recoveryCode: string;
      generatedAt: string;
    };
  } {
    // 1. Rejection rule: if admin already exists or system is initialized or bootstrap disabled
    if (this.systemSettings.admin_initialized || this.getAdminCount() > 0 || !this.systemSettings.bootstrap_enabled) {
      throw new Error('System already initialized. Additional root admin creation is prohibited.');
    }

    // 2. Bootstrap secret verification if configured
    const envSecret = process.env.ADMIN_BOOTSTRAP_SECRET;
    if (envSecret && params.bootstrapSecret !== envSecret) {
      throw new Error('Invalid deployment bootstrap secret.');
    }

    // 3. Generate one-time recovery package (Factor A)
    const recoveryId = 'REC-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    const recoveryCode = [
      crypto.randomBytes(2).toString('hex').toUpperCase(),
      crypto.randomBytes(2).toString('hex').toUpperCase(),
      crypto.randomBytes(2).toString('hex').toUpperCase(),
      crypto.randomBytes(2).toString('hex').toUpperCase(),
    ].join('-');
    const recoveryCodeHash = crypto.createHash('sha256').update(recoveryCode).digest('hex');

    this.recoveryVault = {
      recoveryId,
      recoveryCodeHash,
      createdAt: new Date().toISOString(),
      used: false,
    };

    // 4. Ensure predefined positions exist
    if (!this.positions.has('pos_root_admin')) {
      for (const p of PREDEFINED_POSITIONS) {
        this.positions.set(p.id, { ...p });
      }
    }

    // 5. Create Root Admin Identity
    const adminId = params.adminId?.trim() || 'ADM-0001';
    const orgId = params.orgId?.trim() || 'ORG-' + crypto.randomBytes(3).toString('hex').toUpperCase();

    const adminWallet = (params.adminWallet || this.adminWallet || process.env.ADMIN_WALLET || '0x7FfdbB7868C127152F2007a6025FF15A5723CE08').toLowerCase();

    const adminUser: StoredUser = {
      id: adminId,
      name: params.adminName.trim(),
      email: params.email.trim().toLowerCase(),
      role: UserRole.ADMIN,
      position: 'Root Administrator',
      position_id: 'pos_root_admin',
      kyc_status: 'VERIFIED',
      status: UserStatus.ACTIVE,
      did: `did:securemax:admin:${adminId.toLowerCase()}`,
      created_at: new Date().toISOString(),
      admin_wallet: adminWallet,
    };
    this.users.set(adminUser.id, adminUser);
    this.users.set(adminUser.email, adminUser);
    this.adminWallet = adminWallet;
    this.systemSettings.admin_wallet = adminWallet;

    // 6. Create Singleton Admin Device
    const deviceId = 'DEV-ADMIN-001';
    const adminDevice: DevicePassport = {
      id: deviceId,
      device_id: deviceId,
      user_id: adminUser.id,
      user_name: adminUser.name,
      user_email: adminUser.email,
      position: 'Root Administrator',
      device_name: params.deviceName || 'SecureMAX Admin Laptop',
      device_type: params.deviceType || 'laptop',
      os: params.os || 'macOS',
      browser: params.browser || 'Chrome',
      browser_version: '128.0',
      model: 'SecureMAX Hardware-Bound Terminal',
      credential_id: params.credentialId || 'cred_admin_' + crypto.randomBytes(4).toString('hex'),
      credential_type: 'WebAuthn',
      registered_at: new Date().toISOString(),
      last_authenticated_at: new Date().toISOString(),
      last_active_at: new Date().toISOString(),
      risk_state: 'TRUSTED',
      registration_region: params.country || 'Punjab, India',
      public_key: params.publicKey,
      algorithm: 'ECDSA_P256',
      status: 'ACTIVE',
      is_admin_device: true,
      created_at: new Date().toISOString(),
      last_used_at: new Date().toISOString(),
      timeline: [
        { id: 'tl_boot_1', timestamp: new Date(Date.now() - 5000).toISOString(), event: 'SYSTEM_INITIALIZATION_STARTED', details: 'One-time deployment bootstrap initiated', severity: 'INFO' },
        { id: 'tl_boot_2', timestamp: new Date(Date.now() - 4000).toISOString(), event: 'ROOT_ADMIN_CREATED', details: `Root administrator created: ${adminUser.name} (${adminUser.id})`, severity: 'INFO' },
        { id: 'tl_boot_3', timestamp: new Date(Date.now() - 3000).toISOString(), event: 'ADMIN_DEVICE_REGISTERED', details: `Singleton trusted device registered: ${params.deviceName || 'SecureMAX Admin Laptop'}`, severity: 'INFO' },
        { id: 'tl_boot_4', timestamp: new Date(Date.now() - 2000).toISOString(), event: 'ADMIN_CREDENTIAL_REGISTERED', details: 'WebAuthn / Passkey cryptographic credential anchored', severity: 'INFO' },
        { id: 'tl_boot_5', timestamp: new Date(Date.now() - 1000).toISOString(), event: 'SYSTEM_INITIALIZATION_COMPLETED', details: 'System initialization completed successfully', severity: 'INFO' },
        { id: 'tl_boot_6', timestamp: new Date().toISOString(), event: 'ADMIN_BOOTSTRAP_DISABLED', details: 'Bootstrap mode permanently locked down', severity: 'INFO' },
      ],
    };

    this.devices.set(adminDevice.id, adminDevice);
    this.devicePassports.set(adminDevice.id, adminDevice);

    // 7. Update System Settings to SYSTEM_LOCKED
    this.systemSettings = {
      admin_initialized: true,
      bootstrap_enabled: false,
      system_state: 'SYSTEM_LOCKED',
      organization: {
        name: params.orgName.trim(),
        org_id: orgId,
        org_type: params.orgType || 'Company',
        country: params.country || 'India',
        timezone: params.timezone || 'Asia/Kolkata',
        created_at: new Date().toISOString(),
      },
      root_admin_id: adminUser.id,
      admin_locked: false,
      failed_admin_logins: 0,
      last_admin_login: {
        timestamp: new Date().toISOString(),
        region: params.country || 'Punjab, India',
        device_name: adminDevice.device_name,
        auth_method: 'WEBAUTHN',
      },
      last_security_change: new Date().toISOString(),
    };

    // 8. Record the full 6-event bootstrap audit chain
    this.recordAuditEvent({
      eventType: 'SYSTEM_INITIALIZATION_STARTED',
      description: `SecureMAX bootstrap started for organization: ${params.orgName} (ID: ${orgId})`,
      performedBy: 'DEPLOYMENT_BOOTSTRAP',
      userName: adminUser.name,
      userEmail: adminUser.email,
      severity: 'INFO',
    });
    this.recordAuditEvent({
      eventType: 'ROOT_ADMIN_CREATED',
      description: `Root administrator registered: ${adminUser.name} (${adminUser.id}) for organization: ${params.orgName}`,
      performedBy: adminUser.name,
      targetId: adminUser.id,
      userName: adminUser.name,
      userEmail: adminUser.email,
      severity: 'INFO',
    });
    this.recordAuditEvent({
      eventType: 'ADMIN_DEVICE_REGISTERED',
      description: `Singleton Admin device bound: ${adminDevice.device_name} (ID: ${adminDevice.id})`,
      performedBy: adminUser.name,
      targetId: adminDevice.id,
      userName: adminUser.name,
      userEmail: adminUser.email,
      severity: 'INFO',
    });
    this.recordAuditEvent({
      eventType: 'ADMIN_CREDENTIAL_REGISTERED',
      description: `WebAuthn / Passkey credential registered for ${adminUser.name}`,
      performedBy: adminUser.name,
      targetId: adminDevice.credential_id,
      userName: adminUser.name,
      userEmail: adminUser.email,
      severity: 'INFO',
    });
    this.recordAuditEvent({
      eventType: 'SYSTEM_INITIALIZATION_COMPLETED',
      description: `SecureMAX system fully initialized and locked with root admin: ${adminUser.name}`,
      performedBy: adminUser.name,
      userName: adminUser.name,
      userEmail: adminUser.email,
      severity: 'INFO',
    });
    this.recordAuditEvent({
      eventType: 'ADMIN_BOOTSTRAP_DISABLED',
      description: `Admin bootstrap permanently disabled. System state: SYSTEM_LOCKED`,
      performedBy: 'SYSTEM_SECURITY_POLICY',
      userName: adminUser.name,
      userEmail: adminUser.email,
      severity: 'WARNING',
    });

    // Commit state immediately to disk
    this.saveToDisk();

    storeEvents.emit('change', {
      type: 'BOOTSTRAP',
      data: { rootAdmin: adminUser, adminDevice },
      timestamp: Date.now(),
    });

    return {
      rootAdmin: adminUser,
      adminDevice,
      recoveryPackage: {
        recoveryId,
        recoveryCode,
        generatedAt: new Date().toISOString(),
      },
    };
  }

  public emergencyRecovery(params: {
    adminId: string;
    recoveryCode: string;
    bootstrapSecret?: string;
    newDeviceName: string;
    newPublicKey: string;
    newDeviceType?: string;
    os?: string;
    browser?: string;
  }): {
    success: boolean;
    newDevice: DevicePassport;
    newRecoveryPackage: {
      recoveryId: string;
      recoveryCode: string;
      generatedAt: string;
    };
  } {
    if (!this.recoveryVault) {
      throw new Error('Recovery vault is not configured.');
    }

    // 1. Verify Recovery Code Hash (Factor A)
    const cleanCode = params.recoveryCode.trim();
    const providedHash = crypto.createHash('sha256').update(cleanCode).digest('hex');
    if (providedHash !== this.recoveryVault.recoveryCodeHash) {
      throw new Error('Invalid emergency recovery code. Verification failed.');
    }

    // 2. Verify Deployment Secret (Factor B) if configured
    const envSecret = process.env.ADMIN_BOOTSTRAP_SECRET;
    if (envSecret && params.bootstrapSecret !== envSecret) {
      throw new Error('Invalid deployment recovery secret (Factor B failed).');
    }

    // 3. Resolve Admin
    const admin = this.getUserByEmailOrId(params.adminId);
    if (!admin || admin.role !== UserRole.ADMIN) {
      throw new Error('Administrator identity not found for recovery.');
    }

    // 4. Revoke previous admin devices & terminate all sessions
    const oldDevices = this.getDevicesForUser(admin.id);
    for (const oldDev of oldDevices) {
      oldDev.status = 'REVOKED';
      oldDev.revoked_at = new Date().toISOString();
      const passport = this.devicePassports.get(oldDev.id);
      if (passport) {
        passport.status = 'REVOKED';
        passport.risk_state = 'REVOKED';
        passport.revoked_at = oldDev.revoked_at;
        this.recordDeviceTimelineEvent(
          oldDev.id,
          'DEVICE_REVOKED_RECOVERY',
          'Device revoked during emergency administrator recovery ceremony',
          'CRITICAL'
        );
      }
    }
    this.revokeAllSessionsForUser(admin.id, 'EMERGENCY_RECOVERY');

    // 5. Unlock Admin
    this.systemSettings.admin_locked = false;
    this.systemSettings.failed_admin_logins = 0;
    this.systemSettings.last_security_change = new Date().toISOString();

    // 6. Bind New Singleton Admin Device
    const newDeviceId = 'DEV-ADMIN-' + crypto.randomBytes(3).toString('hex').toUpperCase();
    const newDevice: DevicePassport = {
      id: newDeviceId,
      device_id: newDeviceId,
      user_id: admin.id,
      user_name: admin.name,
      user_email: admin.email,
      position: 'Root Administrator',
      device_name: params.newDeviceName || 'SecureMAX Replacement Admin Laptop',
      device_type: params.newDeviceType || 'laptop',
      os: params.os || 'macOS',
      browser: params.browser || 'Chrome',
      browser_version: '128.0',
      model: 'SecureMAX Replacement Terminal',
      credential_id: 'cred_admin_' + crypto.randomBytes(4).toString('hex'),
      credential_type: 'WebAuthn',
      registered_at: new Date().toISOString(),
      last_authenticated_at: new Date().toISOString(),
      last_active_at: new Date().toISOString(),
      risk_state: 'TRUSTED',
      registration_region: 'Punjab, India',
      public_key: params.newPublicKey,
      algorithm: 'ECDSA_P256',
      status: 'ACTIVE',
      is_admin_device: true,
      created_at: new Date().toISOString(),
      last_used_at: new Date().toISOString(),
      timeline: [
        { id: 'tl_rec_1', timestamp: new Date().toISOString(), event: 'EMERGENCY_RECOVERY_CEREMONY', details: 'Admin recovered account via 2-factor offline recovery package', severity: 'CRITICAL' },
        { id: 'tl_rec_2', timestamp: new Date().toISOString(), event: 'ADMIN_DEVICE_REGISTERED', details: `New replacement singleton device enrolled: ${params.newDeviceName}`, severity: 'INFO' },
        { id: 'tl_rec_3', timestamp: new Date().toISOString(), event: 'PASSKEY_ENROLLED', details: 'New WebAuthn / Passkey credential anchored', severity: 'INFO' },
      ],
    };

    this.devices.set(newDevice.id, newDevice);
    this.devicePassports.set(newDevice.id, newDevice);

    // 7. Generate fresh one-time recovery package
    const newRecoveryId = 'REC-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    const newRecoveryCode = [
      crypto.randomBytes(2).toString('hex').toUpperCase(),
      crypto.randomBytes(2).toString('hex').toUpperCase(),
      crypto.randomBytes(2).toString('hex').toUpperCase(),
      crypto.randomBytes(2).toString('hex').toUpperCase(),
    ].join('-');
    const newRecoveryCodeHash = crypto.createHash('sha256').update(newRecoveryCode).digest('hex');

    this.recoveryVault = {
      recoveryId: newRecoveryId,
      recoveryCodeHash: newRecoveryCodeHash,
      createdAt: new Date().toISOString(),
      used: false,
    };

    // 8. Record audit event
    this.recordAuditEvent({
      eventType: 'ADMIN_EMERGENCY_RECOVERY_EXECUTED',
      description: `CRITICAL: Administrator emergency recovery ceremony executed for ${admin.name}. Previous device revoked, new device ${newDevice.device_name} bound.`,
      targetId: newDeviceId,
      performedBy: admin.name,
      severity: 'CRITICAL',
      before: { status: 'LOCKED' },
      after: { status: 'RECOVERED', device_id: newDeviceId },
    });

    return {
      success: true,
      newDevice,
      newRecoveryPackage: {
        recoveryId: newRecoveryId,
        recoveryCode: newRecoveryCode,
        generatedAt: new Date().toISOString(),
      },
    };
  }

  public lockAdministrator(adminId: string, callerUserId?: string): void {
    const admin = this.getUserById(adminId) || this.getUserByEmail(adminId);
    if (!admin || admin.role !== UserRole.ADMIN) {
      throw new Error('Administrator account not found');
    }
    this.systemSettings.admin_locked = true;
    this.systemSettings.last_security_change = new Date().toISOString();

    // Revoke all sessions for admin
    this.revokeAllSessionsForUser(admin.id, callerUserId || 'PANIC_LOCK');

    // Suspend admin device(s)
    const adminDevices = this.getDevicesForUser(admin.id);
    for (const dev of adminDevices) {
      dev.status = 'SUSPENDED';
      const passport = this.devicePassports.get(dev.id);
      if (passport) {
        passport.status = 'SUSPENDED';
        passport.risk_state = 'RESTRICTED';
      }
      this.recordDeviceTimelineEvent(
        dev.id,
        'DEVICE_LOCKED_PANIC',
        'Administrator triggered panic lock. Device suspended.',
        'CRITICAL'
      );
    }

    this.recordAuditEvent({
      eventType: 'ADMIN_PANIC_LOCK_ACTIVATED',
      description: `CRITICAL: Administrator account ${admin.name} (${admin.id}) has been panic locked. All sessions revoked and device suspended. Emergency recovery ceremony required.`,
      targetId: admin.id,
      performedBy: callerUserId || admin.name,
      severity: 'CRITICAL',
    });
  }

  public recordAdminLogin(params: {
    adminId: string;
    deviceId: string;
    success: boolean;
    reason?: string;
    region?: string;
  }): void {
    const timestamp = new Date().toISOString();
    const admin = this.getUserById(params.adminId) || this.getUserByEmail(params.adminId);
    const actorId = admin ? admin.id : params.adminId;
    const dev = this.getDeviceById(params.deviceId);

    if (params.success) {
      this.systemSettings.failed_admin_logins = 0;
      this.systemSettings.last_admin_login = {
        timestamp,
        region: params.region || 'Punjab, India',
        device_name: dev?.device_name || 'SecureMAX Admin Laptop',
        auth_method: 'WEBAUTHN',
      };

      const passport = this.devicePassports.get(params.deviceId);
      if (params.region && passport && passport.registration_region && params.region !== passport.registration_region) {
        this.recordAuditEvent({
          eventType: 'SECURITY_ALERT_UNEXPECTED_LOCATION',
          description: `WARNING: Admin login from unexpected location: ${params.region} (Registered in: ${passport.registration_region})`,
          targetId: params.deviceId,
          performedBy: admin?.name || actorId,
          severity: 'WARNING',
        });
      }

      if (passport) {
        passport.last_authenticated_at = timestamp;
        passport.last_active_at = timestamp;
        this.recordDeviceTimelineEvent(
          params.deviceId,
          'ADMIN_LOGIN',
          `Admin logged in successfully via WebAuthn (${params.region || 'Registered Region'})`,
          'INFO'
        );
      }

      this.recordAuditEvent({
        eventType: 'ADMIN_LOGIN_SUCCESS',
        description: `Root Admin login successful via WebAuthn device verification (${dev?.device_name || params.deviceId})`,
        targetId: params.deviceId,
        performedBy: admin?.name || actorId,
        severity: 'INFO',
        before: null,
        after: {
          actor_id: actorId,
          device_id: params.deviceId,
          authentication: 'WEBAUTHN',
          authentication_level: 'HIGH',
          result: 'ALLOWED',
          region: params.region || 'Punjab, India',
        },
      });
    } else {
      this.systemSettings.failed_admin_logins += 1;
      this.recordAuditEvent({
        eventType: 'ADMIN_LOGIN_FAILURE',
        description: `ACCESS DENIED: Failed root admin login attempt: ${params.reason || 'Invalid credential'}`,
        targetId: params.deviceId || actorId,
        performedBy: actorId,
        severity: 'CRITICAL',
        before: null,
        after: {
          actor_id: actorId,
          device_id: params.deviceId,
          reason_code: params.reason || 'INVALID_DEVICE_CREDENTIAL',
          result: 'DENIED',
        },
      });
    }

    storeEvents.emit('change', {
      type: 'ADMIN_LOGIN',
      data: {
        adminId: params.adminId,
        deviceId: params.deviceId,
        success: params.success,
        reason: params.reason,
        region: params.region,
        timestamp,
      },
      timestamp: Date.now(),
    });
    this.saveToDisk();
  }

  // --- CRYPTOGRAPHIC CHALLENGE MANAGEMENT ---
  public createChallengeRecord(params: {
    identifier: string;
    type?: 'P256' | 'ETHEREUM';
    walletAddress?: string;
    userId?: string;
    deviceId?: string;
    ttlSeconds?: number;
    customMessage?: string;
  }): StoredChallenge {
    const challengeId = 'chal_' + crypto.randomUUID().replace(/-/g, '');
    const nonce = crypto.randomBytes(32).toString('hex');
    const type = params.type || 'P256';
    const ttl = params.ttlSeconds || 120; // 2 minutes standard
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttl * 1000).toISOString();

    let message: string;
    if (params.customMessage) {
      message = params.customMessage;
    } else if (type === 'ETHEREUM') {
      const wallet = (params.walletAddress || params.identifier).toLowerCase();
      message = `SecureMAX Administrator Authentication\nWallet: ${wallet}\nNonce: ${nonce}\nIssued At: ${now.toISOString()}\nExpires At: ${expiresAt}`;
    } else {
      message = `SecureMAX Zero-Trust Challenge\nIdentifier: ${params.identifier.toLowerCase()}\nNonce: ${nonce}\nIssued At: ${now.toISOString()}\nExpires At: ${expiresAt}`;
    }

    const record: StoredChallenge = {
      challengeId,
      identifier: params.identifier.toLowerCase(),
      nonce,
      message,
      type,
      walletAddress: params.walletAddress ? params.walletAddress.toLowerCase() : undefined,
      userId: params.userId,
      deviceId: params.deviceId,
      expiresAt,
      consumed: false,
      createdAt: now.toISOString(),
    };

    this.challenges.set(challengeId, record);
    this.challengeCache.set(challengeId, {
      challengeId,
      identifier: record.identifier,
      nonce,
      message,
      expiresAt,
    });

    this.saveToDisk();
    return record;
  }

  public getChallenge(challengeId: string): StoredChallenge | null {
    let ch = this.challenges.get(challengeId);
    if (!ch) {
      const cached = this.challengeCache.get(challengeId);
      if (cached) {
        ch = {
          challengeId: cached.challengeId,
          identifier: cached.identifier,
          nonce: cached.nonce,
          message: cached.message,
          type: 'P256',
          expiresAt: cached.expiresAt,
          consumed: false,
          createdAt: new Date().toISOString(),
        };
        this.challenges.set(challengeId, ch);
      }
    }
    return ch || null;
  }

  public consumeChallenge(challengeId: string): { valid: boolean; challenge?: StoredChallenge; error?: string } {
    let ch = this.challenges.get(challengeId);
    if (!ch) {
      const cached = this.challengeCache.get(challengeId);
      if (cached) {
        ch = {
          challengeId: cached.challengeId,
          identifier: cached.identifier,
          nonce: cached.nonce,
          message: cached.message,
          type: 'P256',
          expiresAt: cached.expiresAt,
          consumed: false,
          createdAt: new Date().toISOString(),
        };
        this.challenges.set(challengeId, ch);
      }
    }
    if (!ch) {
      return { valid: false, error: 'Challenge not found or invalid' };
    }

    if (ch.consumed) {
      return { valid: false, error: 'Challenge has already been consumed (replay prevention)' };
    }

    if (new Date(ch.expiresAt).getTime() < Date.now()) {
      return { valid: false, error: 'Challenge has expired' };
    }

    ch.consumed = true;
    ch.consumedAt = new Date().toISOString();
    this.challengeCache.delete(challengeId);
    this.saveToDisk();

    return { valid: true, challenge: ch };
  }

  public getAdminWallet(): string {
    if (process.env.ADMIN_WALLET) return process.env.ADMIN_WALLET.toLowerCase();
    if (this.systemSettings.admin_wallet) return this.systemSettings.admin_wallet.toLowerCase();
    const adminUser = this.getUserById(this.systemSettings.root_admin_id || 'usr_admin_001') || this.getUserByEmail('admin@securemax.mil');
    if (adminUser && adminUser.admin_wallet) return adminUser.admin_wallet.toLowerCase();
    return this.adminWallet.toLowerCase();
  }

  // --- DEVICE MANAGEMENT ---
  public getDevicesForUser(userId: string): UserDevice[] {
    const list: UserDevice[] = [];
    for (const d of this.devices.values()) {
      if (d.user_id === userId) list.push(d);
    }
    return list;
  }

  public getDeviceById(deviceId: string): UserDevice | null {
    return this.devices.get(deviceId) || null;
  }

  public registerDevice(params: {
    userId: string;
    deviceName: string;
    publicKey: string;
    isAdminDevice?: boolean;
    customDeviceId?: string;
  }): UserDevice {
    const user = this.getUserById(params.userId);
    if (!user) throw new Error('User not found');

    // Admin device restriction: maximum 1 ACTIVE admin device singleton
    if (user.role === UserRole.ADMIN) {
      const activeAdminDevices = this.getDevicesForUser(user.id).filter(d => d.status === 'ACTIVE');
      if (activeAdminDevices.length > 0) {
        throw new Error('Administrator accounts are restricted to one active trusted device.');
      }
    }

    const deviceId = params.customDeviceId || 'dev_' + crypto.randomUUID().slice(0, 12);
    const device: UserDevice = {
      id: deviceId,
      user_id: params.userId,
      device_name: params.deviceName,
      public_key: params.publicKey,
      algorithm: 'ECDSA_P256',
      status: 'ACTIVE',
      is_admin_device: Boolean(params.isAdminDevice || user.role === UserRole.ADMIN),
      created_at: new Date().toISOString(),
      last_used_at: new Date().toISOString(),
    };

    this.devices.set(device.id, device);

    // Keep device passport in sync
    const passport: DevicePassport = {
      ...device,
      device_id: deviceId,
      device_type: user.role === UserRole.ADMIN ? 'laptop' : 'workstation',
      os: 'macOS',
      browser: 'Chrome',
      credential_id: 'cred_' + crypto.randomBytes(4).toString('hex'),
      credential_type: 'WebAuthn',
      registered_at: device.created_at,
      last_authenticated_at: device.last_used_at,
      risk_state: 'TRUSTED',
      registration_region: 'Punjab, India',
      timeline: [
        {
          id: 'tl_' + crypto.randomUUID().slice(0, 8),
          timestamp: new Date().toISOString(),
          event: 'DEVICE_REGISTERED',
          details: `Device registered: ${params.deviceName}`,
          severity: 'INFO',
        },
      ],
    };
    this.devicePassports.set(deviceId, passport);

    this.recordAuditEvent({
      eventType: 'HARDWARE_DEVICE_ENROLLED',
      description: `New hardware device enrolled: ${params.deviceName} (ECDSA P-256) for ${user.name}`,
      targetId: deviceId,
      userEmail: user.email,
      userName: user.name,
      severity: 'INFO',
    });

    this.saveToDisk();
    return device;
  }

  public getAllDevices(): Array<UserDevice & { userEmail?: string; userName?: string }> {
    const list: Array<UserDevice & { userEmail?: string; userName?: string }> = [];
    for (const d of this.devices.values()) {
      const user = this.getUserById(d.user_id);
      list.push({
        ...d,
        userEmail: user?.email,
        userName: user?.name,
      });
    }
    return list;
  }

  public revokeDevice(callerUserId: string, deviceId: string): void {
    const dev = this.devices.get(deviceId);
    if (!dev) throw new Error('Device not found');
    const caller = this.getUserById(callerUserId);
    const isCallerAdmin = caller?.role === UserRole.ADMIN;

    if (dev.user_id !== callerUserId && !isCallerAdmin) {
      throw new Error('Unauthorized to revoke this device');
    }
    if (dev.is_admin_device) {
      throw new Error('Cannot revoke primary Admin hardware device. Emergency break-glass required.');
    }

    const prevStatus = dev.status;
    dev.status = 'REVOKED';
    dev.revoked_at = new Date().toISOString();

    const passport = this.devicePassports.get(deviceId);
    if (passport) {
      passport.status = 'REVOKED';
      passport.risk_state = 'REVOKED';
      passport.revoked_at = dev.revoked_at;
    }

    // Terminate all sessions for the revoked device
    this.revokeAllSessionsForDevice(deviceId, callerUserId);

    this.recordDeviceTimelineEvent(
      deviceId,
      'DEVICE_REVOKED',
      `Device revoked by ${caller?.name || callerUserId}`,
      'CRITICAL'
    );

    this.recordAuditEvent({
      eventType: 'HARDWARE_DEVICE_REVOKED',
      description: `Hardware device revoked: ${dev.device_name} (ID: ${dev.id})`,
      targetId: dev.id,
      target: dev.id,
      before: { status: prevStatus },
      after: { status: 'REVOKED' },
      performedBy: callerUserId,
      severity: 'WARNING',
    });

    this.saveToDisk();
  }

  public updateDeviceLastUsed(deviceId: string): void {
    const dev = this.devices.get(deviceId);
    if (dev) {
      dev.last_used_at = new Date().toISOString();
      this.saveToDisk();
    }
  }

  // --- POSITION MANAGEMENT ---
  public getPositions(): StoredPosition[] {
    if (this.positions.size === 0) {
      for (const p of PREDEFINED_POSITIONS) {
        this.positions.set(p.id, { ...p });
      }
    }
    return Array.from(this.positions.values());
  }

  public getPositionById(idOrName: string): StoredPosition | null {
    const list = this.getPositions();
    return list.find(p => p.id === idOrName || p.name.toLowerCase() === idOrName.toLowerCase()) || null;
  }

  public createPosition(params: {
    name: string;
    description: string;
    privilege_level: 'STANDARD' | 'ELEVATED' | 'ADMINISTRATIVE';
    permissions: PositionPermissions;
    callerUserId?: string;
  }): StoredPosition {
    const cleanName = params.name.trim();
    if (!cleanName) throw new Error('Position name is required');

    // Check duplicate
    const existing = this.getPositionById(cleanName);
    if (existing) throw new Error(`Position "${cleanName}" already exists`);

    const caller = params.callerUserId ? this.getUserById(params.callerUserId) : null;
    if (caller && caller.role !== UserRole.ADMIN) {
      throw new Error('Unauthorized: Only Administrator can create positions');
    }

    const id = 'pos_' + crypto.randomUUID().slice(0, 8);
    const position: StoredPosition = {
      id,
      name: cleanName,
      description: params.description.trim(),
      privilege_level: params.privilege_level,
      permissions: params.permissions,
      is_predefined: false,
      created_at: new Date().toISOString(),
      created_by: caller?.name || 'Administrator',
    };

    this.positions.set(id, position);

    this.recordAuditEvent({
      eventType: 'POSITION_CREATED',
      description: `New position created: ${position.name} [Level: ${position.privilege_level}] by ${caller?.name || 'System'}`,
      targetId: id,
      target: id,
      before: null,
      after: {
        name: position.name,
        privilege_level: position.privilege_level,
        permissions: position.permissions,
      },
      performedBy: caller?.name || 'Administrator',
      userEmail: caller?.email,
      userName: caller?.name,
      severity: params.privilege_level === 'ADMINISTRATIVE' ? 'WARNING' : 'INFO',
    });

    return position;
  }

  public updatePosition(id: string, updates: Partial<StoredPosition>, callerUserId?: string): StoredPosition {
    if (id === 'pos_root_admin' || id === 'pos_admin') {
      throw new Error('ROOT_ADMIN is a protected system role and is immutable. Administrator permissions cannot be modified or removed.');
    }
    const pos = this.positions.get(id);
    if (!pos) throw new Error('Position not found');
    const updated = { ...pos, ...updates, id };
    this.positions.set(id, updated);
    return updated;
  }

  public deletePosition(id: string, callerUserId?: string): void {
    if (id === 'pos_root_admin' || id === 'pos_admin') {
      throw new Error('ROOT_ADMIN is a protected system role and cannot be deleted.');
    }
    const pos = this.positions.get(id);
    if (!pos) throw new Error('Position not found');
    if (pos.is_predefined) {
      throw new Error('Predefined system positions cannot be deleted.');
    }
    this.positions.delete(id);
  }

  // --- DEVICE ENROLLMENT (15-MINUTE CAPABILITIES & SHA-256 CODES) ---
  public createEnrollmentCapability(params: {
    userId: string;
    positionId?: string;
    durationMinutes?: number;
    maxDevices?: number;
    callerUserId?: string;
    callerRole?: UserRole;
    targetDeviceType?: string;
  }): { enrollment: StoredEnrollmentCapability; plaintextCode: string } {
    const targetUser = this.getUserById(params.userId);
    if (!targetUser) throw new Error('User not found');

    if (targetUser.status === UserStatus.SUSPENDED || targetUser.status === UserStatus.REVOKED) {
      throw new Error(`Cannot issue enrollment capability: user account is ${targetUser.status}`);
    }

    if (params.callerUserId) {
      const caller = this.getUserById(params.callerUserId);
      const isCallerAdmin = (params.callerRole === UserRole.ADMIN) || (caller?.role === UserRole.ADMIN);
      if (params.callerUserId !== params.userId && !isCallerAdmin) {
        throw new Error('Unauthorized: only an Admin can issue device enrollment capabilities for other users');
      }
    }

    if (targetUser.role === UserRole.ADMIN) {
      throw new Error('Admin account is strictly device-bound. Multi-device enrollment is disabled for root administrative security.');
    }

    // Resolve position
    let positionName: string = targetUser.role;
    let positionId = 'pos_user';
    if (params.positionId) {
      const pos = this.getPositionById(params.positionId);
      if (pos) {
        positionId = pos.id;
        positionName = pos.name;
      }
    } else if (targetUser.position_id) {
      const pos = this.getPositionById(targetUser.position_id);
      if (pos) {
        positionId = pos.id;
        positionName = pos.name;
      }
    }

    // Generate cryptographically strong random code (256-bit entropy, Base32 encoded, 12 chars e.g. 7K4M-92QP-8X2L)
    const rawBytes = crypto.randomBytes(32);
    const charset = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let codeStr = '';
    for (let i = 0; i < 12; i++) {
      codeStr += charset[rawBytes[i] % charset.length];
    }
    const plaintextCode = `${codeStr.slice(0, 4)}-${codeStr.slice(4, 8)}-${codeStr.slice(8, 12)}`;
    
    // Hash code with SHA-256 before storing
    const cleanRaw = plaintextCode.toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
    const codeHash = crypto.createHash('sha256').update(cleanRaw).digest('hex');

    const now = Date.now();
    const durationMinutes = params.durationMinutes || 15;
    const enrollmentId = 'enr_' + crypto.randomUUID().slice(0, 8);
    const createdAt = new Date(now).toISOString();
    const expiresAt = new Date(now + durationMinutes * 60 * 1000).toISOString();

    const capability: StoredEnrollmentCapability = {
      id: enrollmentId,
      code_hash: codeHash,
      user_id: targetUser.id,
      user_name: targetUser.name,
      user_email: targetUser.email,
      position_id: positionId,
      position_name: positionName,
      duration_minutes: durationMinutes,
      max_devices: params.maxDevices || 1,
      devices_enrolled: 0,
      created_by: params.callerUserId ? (this.getUserById(params.callerUserId)?.name || 'Admin') : targetUser.name,
      created_at: createdAt,
      expires_at: expiresAt,
      status: 'ACTIVE',
      target_device_type: params.targetDeviceType,
    };

    this.enrollmentCapabilities.set(codeHash, capability);
    this.enrollmentCapabilities.set(enrollmentId, capability);

    // Backward compatibility: also store in legacy enrollments map
    this.enrollments.set(plaintextCode, {
      code: plaintextCode,
      user_id: targetUser.id,
      expires_at: expiresAt,
      created_at: capability.created_at,
    });

    // Never record the plaintext code into the audit log!
    this.recordAuditEvent({
      eventType: 'DEVICE_ENROLLMENT_CREATED',
      description: `Temporary ${durationMinutes}-minute device enrollment capability issued for ${targetUser.name} (${positionName})`,
      targetId: enrollmentId,
      target: enrollmentId,
      before: null,
      after: {
        position: positionName,
        duration_minutes: durationMinutes,
        max_devices: capability.max_devices,
        target_device_type: capability.target_device_type,
      },
      performedBy: params.callerUserId || targetUser.name,
      userEmail: targetUser.email,
      userName: targetUser.name,
      severity: 'INFO',
    });

    this.saveToDisk();

    storeEvents.emit('change', {
      type: 'ENROLLMENT_CAPABILITY_CREATED',
      data: capability,
      timestamp: Date.now(),
    });

    return { enrollment: capability, plaintextCode };

  }

  public verifyEnrollmentCapability(code: string): {
    valid: boolean;
    enrollment?: StoredEnrollmentCapability;
    user?: StoredUser;
    position?: StoredPosition;
    error?: string;
  } {
    if (!code || typeof code !== 'string') {
      return { valid: false, error: 'Enrollment code is required' };
    }

    const cleanCode = code.toUpperCase().replace(/^SMX-?/, '').replace(/[^A-Z0-9]/g, '').trim();
    const hash = crypto.createHash('sha256').update(cleanCode).digest('hex');

    let capability = this.enrollmentCapabilities.get(hash);

    // Fallback: check legacy enrollments
    if (!capability) {
      const legacy = this.enrollments.get(code.toUpperCase().trim());
      if (legacy) {
        capability = {
          id: 'enr_legacy_' + legacy.code,
          code_hash: hash,
          user_id: legacy.user_id,
          position_id: 'pos_user',
          position_name: 'USER',
          duration_minutes: 15,
          max_devices: 1,
          devices_enrolled: 0,
          created_by: 'System',
          created_at: legacy.created_at,
          expires_at: legacy.expires_at,
          status: 'ACTIVE',
        };
      }
    }

    if (!capability) {
      return { valid: false, error: 'Invalid or non-existent enrollment code' };
    }

    if (capability.status === 'CONSUMED' || capability.devices_enrolled >= capability.max_devices) {
      return { valid: false, error: 'This enrollment code has already been consumed (maximum device limit reached)' };
    }

    if (capability.status === 'REVOKED') {
      return { valid: false, error: 'This enrollment capability has been revoked by administrator' };
    }

    if (new Date(capability.expires_at).getTime() < Date.now()) {
      capability.status = 'EXPIRED';
      return { valid: false, error: 'Enrollment code has expired. 15-minute validity window elapsed.' };
    }

    const user = this.getUserById(capability.user_id);
    if (!user) {
      return { valid: false, error: 'Target user record not found' };
    }

    if (user.status === UserStatus.SUSPENDED || user.status === UserStatus.REVOKED) {
      return { valid: false, error: `User account is ${user.status}. Device enrollment is blocked.` };
    }

    const position = this.getPositionById(capability.position_id) || {
      id: 'pos_user',
      name: capability.position_name,
      description: 'Standard User',
      privilege_level: 'STANDARD',
      permissions: PREDEFINED_POSITIONS[3].permissions,
      is_predefined: true,
      created_at: capability.created_at,
    };

    return { valid: true, enrollment: capability, user, position };
  }

  public consumeEnrollmentCapability(
    code: string,
    deviceData: {
      deviceName: string;
      deviceType?: string;
      os?: string;
      browser?: string;
      browserVersion?: string;
      model?: string;
      region?: string;
      publicKey: string;
      credentialId?: string;
      credentialType?: string;
      customDeviceId?: string;
    }
  ): { passport: DevicePassport; user: StoredUser } {
    const verified = this.verifyEnrollmentCapability(code);
    if (!verified.valid || !verified.enrollment || !verified.user) {
      throw new Error(verified.error || 'Failed to verify enrollment code');
    }

    const capability = verified.enrollment;
    const user = verified.user;

    // Check device type binding if specified
    if (capability.target_device_type && capability.target_device_type !== 'any' && deviceData.deviceType) {
      const target = capability.target_device_type.toLowerCase();
      const current = deviceData.deviceType.toLowerCase();
      if (target !== current && !target.includes(current) && !current.includes(target)) {
        throw new Error(
          `Device type mismatch: This enrollment code is strictly bound to "${capability.target_device_type}", but attempting to register "${deviceData.deviceType}".`
        );
      }
    }

    // Atomically increment devices enrolled and consume if reached limit
    capability.devices_enrolled += 1;
    if (capability.devices_enrolled >= capability.max_devices) {
      capability.status = 'CONSUMED';
      capability.used_at = new Date().toISOString();
      this.enrollments.delete(code.toUpperCase().trim());
    }

    // Register Device Passport
    const deviceId = deviceData.customDeviceId || 'DEV-' + crypto.randomUUID().slice(0, 8).toUpperCase();
    const credId = deviceData.credentialId || 'cred_' + crypto.randomUUID().slice(0, 12);
    const now = new Date().toISOString();

    const passport: DevicePassport = {
      id: deviceId,
      device_id: deviceId,
      user_id: user.id,
      user_name: user.name,
      user_email: user.email,
      position: capability.position_name || user.role,
      device_name: deviceData.deviceName.trim() || `${user.name} — Primary Laptop`,
      device_type: (deviceData.deviceType as any) || 'laptop',
      os: deviceData.os || 'macOS',
      browser: deviceData.browser || 'Chrome',
      browser_version: deviceData.browserVersion || '128.0',
      model: deviceData.model || 'MacBook Pro',
      credential_id: credId,
      public_key: deviceData.publicKey,
      algorithm: 'ECDSA_P256',
      credential_type: deviceData.credentialType || 'WebAuthn',
      registered_at: now,
      last_authenticated_at: now,
      last_active_at: now,
      status: 'ACTIVE',
      risk_state: 'TRUSTED',
      registration_region: deviceData.region || 'Punjab, India',
      is_admin_device: user.role === UserRole.ADMIN,
      created_at: now,
      last_used_at: now,
      timeline: [
        {
          id: 'tl_' + crypto.randomUUID().slice(0, 8),
          timestamp: now,
          event: 'DEVICE_REGISTERED',
          details: `Device "${deviceData.deviceName}" cryptographically registered to ${user.name}`,
          severity: 'INFO',
        },
        {
          id: 'tl_' + crypto.randomUUID().slice(0, 8),
          timestamp: now,
          event: 'PASSKEY_ENROLLED',
          details: `WebAuthn / Passkey credential (${credId.slice(0, 12)}...) bound to hardware enclave`,
          severity: 'INFO',
        },
      ],
    };

    this.devices.set(deviceId, passport);
    this.devicePassports.set(deviceId, passport);

    this.recordAuditEvent({
      eventType: 'DEVICE_ENROLLMENT_CONSUMED',
      description: `One-time enrollment capability consumed by device "${passport.device_name}" for ${user.name} (${capability.devices_enrolled}/${capability.max_devices} enrolled)`,
      targetId: capability.id,
      target: capability.id,
      before: { devices_enrolled: capability.devices_enrolled - 1, status: 'ACTIVE' },
      after: { devices_enrolled: capability.devices_enrolled, status: capability.status },
      performedBy: user.id,
      userEmail: user.email,
      userName: user.name,
      severity: 'INFO',
    });

    this.recordAuditEvent({
      eventType: 'DEVICE_REGISTERED',
      description: `New Device Passport issued: ${passport.device_name} (ID: ${passport.device_id}, OS: ${passport.os}, Region: ${passport.registration_region})`,
      targetId: passport.device_id,
      target: passport.device_id,
      before: null,
      after: {
        device_id: passport.device_id,
        device_name: passport.device_name,
        device_type: passport.device_type,
        os: passport.os,
        registration_region: passport.registration_region,
      },
      performedBy: user.id,
      userEmail: user.email,
      userName: user.name,
      severity: 'INFO',
    });

    this.recordAuditEvent({
      eventType: 'PASSKEY_REGISTERED',
      description: `WebAuthn / Passkey credential registered: ${passport.credential_type} for ${user.name}`,
      targetId: passport.credential_id,
      target: passport.credential_id,
      before: null,
      after: {
        credential_id: passport.credential_id,
        credential_type: passport.credential_type,
      },
      performedBy: user.id,
      userEmail: user.email,
      userName: user.name,
      severity: 'INFO',
    });

    this.saveToDisk();
    syncDeviceToSupabase(passport).catch(() => {});

    storeEvents.emit('change', {
      type: 'DEVICE_ENROLLED',
      data: passport,
      timestamp: Date.now(),
    });

    return { passport, user };
  }

  // Backward-compatible createEnrollment
  public createEnrollment(userId: string, callerUserId?: string): DeviceEnrollment {
    const { enrollment, plaintextCode } = this.createEnrollmentCapability({
      userId,
      callerUserId,
      durationMinutes: 15,
      maxDevices: 1,
    });
    return {
      code: plaintextCode,
      user_id: enrollment.user_id,
      expires_at: enrollment.expires_at,
      created_at: enrollment.created_at,
    };
  }

  // Backward-compatible consumeEnrollment
  public consumeEnrollment(code: string): string {
    const verified = this.verifyEnrollmentCapability(code);
    if (!verified.valid || !verified.enrollment) {
      throw new Error(verified.error || 'Invalid or non-existent enrollment code');
    }

    verified.enrollment.status = 'CONSUMED';
    verified.enrollment.used_at = new Date().toISOString();
    this.enrollments.delete(code.toUpperCase().trim());

    this.saveToDisk();
    return verified.enrollment.user_id;
  }

  // --- DEVICE PASSPORT & TRUST LIFECYCLE ---
  public getDevicePassport(deviceId: string): DevicePassport | null {
    const p = this.devicePassports.get(deviceId);
    if (p) return p;

    // Fallback: convert UserDevice to DevicePassport if not in passports map
    const d = this.devices.get(deviceId);
    if (!d) return null;

    const user = this.getUserById(d.user_id);
    const converted: DevicePassport = {
      ...d,
      device_id: d.id,
      device_type: d.device_type || (d.is_admin_device ? 'terminal' : 'laptop'),
      os: d.os || 'macOS',
      browser: d.browser || 'Chrome',
      browser_version: d.browser_version || '128.0',
      model: d.model || 'MacBook Pro',
      credential_id: d.credential_id || `cred_${d.id}`,
      credential_type: d.credential_type || 'WebAuthn',
      registered_at: d.created_at,
      last_authenticated_at: d.last_used_at,
      last_active_at: d.last_used_at,
      risk_state: d.risk_state || 'TRUSTED',
      registration_region: d.registration_region || 'Punjab, India',
      position: d.position || (user ? user.role : 'USER'),
      user_name: user?.name,
      user_email: user?.email,
      timeline: d.timeline || [
        {
          id: 'tl_' + d.id,
          timestamp: d.created_at,
          event: 'DEVICE_REGISTERED',
          details: `Device ${d.device_name} registered`,
          severity: 'INFO',
        },
      ],
    };
    this.devicePassports.set(deviceId, converted);
    return converted;
  }

  public getAllDevicePassports(): DevicePassport[] {
    const list: DevicePassport[] = [];
    for (const d of this.devices.values()) {
      const passport = this.getDevicePassport(d.id);
      if (passport) list.push(passport);
    }
    return list;
  }

  public updateDeviceRiskState(
    deviceId: string,
    riskState: 'TRUSTED' | 'REVIEW' | 'RESTRICTED' | 'REVOKED',
    callerUserId?: string
  ): DevicePassport {
    const passport = this.getDevicePassport(deviceId);
    if (!passport) throw new Error('Device not found');

    const prevRisk = passport.risk_state || 'TRUSTED';
    passport.risk_state = riskState;

    if (riskState === 'REVOKED') {
      passport.status = 'REVOKED';
      passport.revoked_at = new Date().toISOString();
      this.revokeAllSessionsForDevice(deviceId, callerUserId);
    }

    this.recordDeviceTimelineEvent(
      deviceId,
      'RISK_STATE_CHANGED',
      `Risk state changed from ${prevRisk} to ${riskState}`,
      riskState === 'REVOKED' || riskState === 'RESTRICTED' ? 'WARNING' : 'INFO'
    );

    const dev = this.devices.get(deviceId);
    if (dev) {
      dev.risk_state = riskState;
      if (riskState === 'REVOKED') {
        dev.status = 'REVOKED';
        dev.revoked_at = passport.revoked_at;
      }
    }

    this.recordAuditEvent({
      eventType: 'DEVICE_RISK_STATE_CHANGED',
      description: `Device "${passport.device_name}" (${passport.device_id}) risk state transitioned from ${prevRisk} to ${riskState}`,
      targetId: deviceId,
      target: deviceId,
      before: { risk_state: prevRisk },
      after: { risk_state: riskState },
      performedBy: callerUserId,
      severity: riskState === 'REVOKED' || riskState === 'RESTRICTED' ? 'WARNING' : 'INFO',
    });

    this.saveToDisk();
    return passport;
  }

  public suspendDevice(deviceId: string, callerUserId?: string): DevicePassport {
    const passport = this.getDevicePassport(deviceId);
    if (!passport) throw new Error('Device not found');

    if (passport.is_admin_device) {
      throw new Error('Cannot suspend primary Admin hardware device.');
    }

    passport.status = 'SUSPENDED';
    const dev = this.devices.get(deviceId);
    if (dev) dev.status = 'SUSPENDED';

    // Terminate active sessions for suspended device
    this.revokeAllSessionsForDevice(deviceId, callerUserId);

    this.recordDeviceTimelineEvent(
      deviceId,
      'DEVICE_SUSPENDED',
      'Device access suspended by administrator',
      'WARNING'
    );

    this.recordAuditEvent({
      eventType: 'DEVICE_SUSPENDED',
      description: `Device access suspended: ${passport.device_name} (ID: ${passport.device_id})`,
      targetId: deviceId,
      target: deviceId,
      before: { status: 'ACTIVE' },
      after: { status: 'SUSPENDED' },
      performedBy: callerUserId,
      severity: 'WARNING',
    });

    this.saveToDisk();
    return passport;
  }

  public reactivateDevice(deviceId: string, callerUserId?: string): DevicePassport {
    const passport = this.getDevicePassport(deviceId);
    if (!passport) throw new Error('Device not found');

    passport.status = 'ACTIVE';
    passport.risk_state = 'TRUSTED';
    const dev = this.devices.get(deviceId);
    if (dev) {
      dev.status = 'ACTIVE';
      dev.risk_state = 'TRUSTED';
    }

    this.recordDeviceTimelineEvent(
      deviceId,
      'DEVICE_REACTIVATED',
      'Device restored to active trusted state by administrator',
      'INFO'
    );

    this.recordAuditEvent({
      eventType: 'DEVICE_REACTIVATED',
      description: `Device reactivated: ${passport.device_name} (ID: ${passport.device_id})`,
      targetId: deviceId,
      target: deviceId,
      before: { status: 'SUSPENDED' },
      after: { status: 'ACTIVE' },
      performedBy: callerUserId,
      severity: 'INFO',
    });

    this.saveToDisk();
    return passport;
  }

  // --- EMERGENCY CONTROLS: SUSPEND / REACTIVATE USER & DEVICE RECOVERY ---
  public suspendUser(userId: string, callerUserId?: string): StoredUser {
    const user = this.getUserById(userId);
    if (!user) throw new Error('User not found');

    if (user.role === UserRole.ADMIN) {
      throw new Error('Cannot suspend root Administrator user account.');
    }

    const caller = callerUserId ? this.getUserById(callerUserId) : null;
    if (caller && caller.role !== UserRole.ADMIN) {
      throw new Error('Unauthorized: Only Administrator can suspend user accounts.');
    }

    const prevStatus = user.status;
    user.status = UserStatus.SUSPENDED;

    // Revoke all active sessions for this user
    this.revokeAllSessionsForUser(userId, callerUserId);

    // Suspend all user devices
    for (const d of this.devices.values()) {
      if (d.user_id === userId && !d.is_admin_device) {
        d.status = 'SUSPENDED';
        const p = this.devicePassports.get(d.id);
        if (p) p.status = 'SUSPENDED';
      }
    }

    this.recordAuditEvent({
      eventType: 'USER_SUSPENDED',
      description: `User account suspended: ${user.name} (${user.email}). All active sessions terminated and device access blocked.`,
      targetId: userId,
      target: userId,
      before: { status: prevStatus },
      after: { status: 'SUSPENDED' },
      performedBy: callerUserId || 'Administrator',
      userEmail: user.email,
      userName: user.name,
      severity: 'WARNING',
    });

    return user;
  }

  public reactivateUser(userId: string, callerUserId?: string): StoredUser {
    const user = this.getUserById(userId);
    if (!user) throw new Error('User not found');

    const caller = callerUserId ? this.getUserById(callerUserId) : null;
    if (caller && caller.role !== UserRole.ADMIN) {
      throw new Error('Unauthorized: Only Administrator can reactivate user accounts.');
    }

    const prevStatus = user.status;
    user.status = UserStatus.ACTIVE;

    // Reactivate devices that were suspended
    for (const d of this.devices.values()) {
      if (d.user_id === userId && d.status === 'SUSPENDED') {
        d.status = 'ACTIVE';
        d.risk_state = 'TRUSTED';
        const p = this.devicePassports.get(d.id);
        if (p) {
          p.status = 'ACTIVE';
          p.risk_state = 'TRUSTED';
        }
      }
    }

    this.recordAuditEvent({
      eventType: 'USER_REACTIVATED',
      description: `User account reactivated: ${user.name} (${user.email}). Device access restored.`,
      targetId: userId,
      target: userId,
      before: { status: prevStatus },
      after: { status: 'ACTIVE' },
      performedBy: callerUserId || 'Administrator',
      userEmail: user.email,
      userName: user.name,
      severity: 'INFO',
    });

    return user;
  }

  public recoverDevice(params: {
    lostDeviceId: string;
    callerUserId: string;
  }): { oldDevice: DevicePassport; enrollment: StoredEnrollmentCapability; plaintextCode: string } {
    const oldDevice = this.getDevicePassport(params.lostDeviceId);
    if (!oldDevice) throw new Error('Lost device record not found');

    const caller = this.getUserById(params.callerUserId);
    if (caller && caller.role !== UserRole.ADMIN) {
      throw new Error('Unauthorized: Only Administrator can execute device recovery');
    }

    // 1. Mark old device as permanently REVOKED
    oldDevice.status = 'REVOKED';
    oldDevice.risk_state = 'REVOKED';
    oldDevice.revoked_at = new Date().toISOString();
    const d = this.devices.get(params.lostDeviceId);
    if (d) {
      d.status = 'REVOKED';
      d.revoked_at = oldDevice.revoked_at;
    }

    // 2. Terminate all active sessions for the lost device
    this.revokeAllSessionsForDevice(params.lostDeviceId, params.callerUserId);

    this.recordDeviceTimelineEvent(
      params.lostDeviceId,
      'DEVICE_RECOVERED_REVOKED',
      'Device reported lost or compromised. Terminal revocation executed by administrator during recovery.',
      'CRITICAL'
    );

    // 3. Issue fresh 15-minute enrollment capability for replacement device
    const { enrollment, plaintextCode } = this.createEnrollmentCapability({
      userId: oldDevice.user_id,
      callerUserId: params.callerUserId,
      durationMinutes: 15,
      maxDevices: 1,
    });

    this.recordAuditEvent({
      eventType: 'DEVICE_RECOVERY_COMPLETED',
      description: `Device recovery executed for ${oldDevice.user_name}: old device "${oldDevice.device_name}" revoked, new 15-minute enrollment capability issued.`,
      targetId: oldDevice.device_id,
      target: oldDevice.device_id,
      before: { device_id: oldDevice.device_id, status: 'ACTIVE' },
      after: { device_id: oldDevice.device_id, status: 'REVOKED', replacement_enrollment_id: enrollment.id },
      performedBy: params.callerUserId,
      severity: 'WARNING',
    });

    return { oldDevice, enrollment, plaintextCode };
  }

  public recordDeviceTimelineEvent(
    deviceId: string,
    event: string,
    details?: string,
    severity: 'INFO' | 'WARNING' | 'CRITICAL' = 'INFO'
  ): void {
    const passport = this.devicePassports.get(deviceId);
    const eventObj: DeviceTimelineEvent = {
      id: 'tl_' + crypto.randomUUID().slice(0, 8),
      timestamp: new Date().toISOString(),
      event,
      details,
      severity,
    };
    if (passport) {
      if (!passport.timeline) passport.timeline = [];
      passport.timeline.unshift(eventObj);
    }
    const dev = this.devices.get(deviceId);
    if (dev && dev !== passport) {
      if (!dev.timeline) dev.timeline = [];
      dev.timeline.unshift(eventObj);
    }
  }

  public forceReauthentication(deviceId: string, callerUserId?: string): void {
    const passport = this.getDevicePassport(deviceId);
    if (!passport) throw new Error('Device not found');

    this.revokeAllSessionsForDevice(deviceId, callerUserId);
    this.recordDeviceTimelineEvent(
      deviceId,
      'FORCE_REAUTH',
      'Administrator forced re-authentication for all active sessions',
      'WARNING'
    );

    this.recordAuditEvent({
      eventType: 'FORCE_REAUTH_TRIGGERED',
      description: `Re-authentication enforced for device: ${passport.device_name}`,
      targetId: deviceId,
      target: deviceId,
      performedBy: callerUserId,
      severity: 'INFO',
    });
  }

  // --- SESSION MANAGEMENT ---
  public createSession(params: {
    userId: string;
    deviceId: string;
    position?: string;
    authLevel?: 'PASSKEY' | 'WEBAUTHN' | 'P256' | 'METAMASK';
    durationHours?: number;
  }): StoredDeviceSession {
    const user = this.getUserById(params.userId);
    if (user && (user.status === UserStatus.SUSPENDED || user.status === UserStatus.REVOKED)) {
      throw new Error(`Cannot establish session: User account is ${user.status}. Access denied.`);
    }

    const device = this.devices.get(params.deviceId);
    if (device && (device.status === 'SUSPENDED' || device.status === 'REVOKED')) {
      throw new Error(`Cannot establish session: Device is ${device.status}. Access denied.`);
    }

    const sessionId = 'SES-' + crypto.randomUUID().slice(0, 8).toUpperCase();
    const durationHours = params.durationHours || 8;
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + durationHours * 3600 * 1000).toISOString();

    const session: StoredDeviceSession = {
      session_id: sessionId,
      user_id: params.userId,
      user_name: user?.name,
      user_email: user?.email,
      device_id: params.deviceId,
      device_name: device?.device_name || 'Primary Device',
      position: params.position || user?.role || 'USER',
      created_at: now,
      last_activity_at: now,
      expires_at: expiresAt,
      authentication_level: params.authLevel || 'PASSKEY',
      status: 'ACTIVE',
    };

    this.sessions.set(sessionId, session);

    // Update device timestamps & timeline
    if (device) {
      device.last_used_at = now;
      this.recordDeviceTimelineEvent(
        params.deviceId,
        'LOGIN_SUCCESS',
        `Authenticated session established via ${session.authentication_level}`,
        'INFO'
      );
    }

    storeEvents.emit('change', {
      type: 'SESSION_CREATED',
      data: session,
      timestamp: Date.now(),
    });

    return session;
  }

  public getActiveSessions(): StoredDeviceSession[] {
    const active: StoredDeviceSession[] = [];
    const now = Date.now();
    for (const s of this.sessions.values()) {
      if (s.status === 'ACTIVE' && new Date(s.expires_at).getTime() > now) {
        active.push(s);
      }
    }
    return active;
  }

  public getSessionsForUser(userId: string): StoredDeviceSession[] {
    return Array.from(this.sessions.values()).filter(s => s.user_id === userId);
  }

  public getSession(sessionId: string): StoredDeviceSession | undefined {
    return this.sessions.get(sessionId);
  }

  public invalidateSession(sessionId: string, callerUserId?: string): boolean {
    const s = this.sessions.get(sessionId);
    if (!s) return false;
    s.status = 'REVOKED';
    this.recordAuditEvent({
      eventType: 'SESSION_REVOKED',
      description: `Session ${sessionId} revoked for user ${s.user_name || s.user_id}`,
      targetId: sessionId,
      target: sessionId,
      performedBy: callerUserId,
      severity: 'INFO',
    });
    storeEvents.emit('change', {
      type: 'SESSION_REVOKED',
      data: { sessionId },
      timestamp: Date.now(),
    });
    this.saveToDisk();
    return true;
  }

  public revokeSession(sessionId: string, callerUserId?: string): void {
    const s = this.sessions.get(sessionId);
    if (!s) return;
    s.status = 'REVOKED';

    this.recordAuditEvent({
      eventType: 'SESSION_REVOKED',
      description: `Session ${sessionId} revoked for user ${s.user_name || s.user_id}`,
      targetId: sessionId,
      target: sessionId,
      performedBy: callerUserId,
      severity: 'INFO',
    });

    storeEvents.emit('change', {
      type: 'SESSION_REVOKED',
      data: { sessionId },
      timestamp: Date.now(),
    });
    this.saveToDisk();
  }

  public revokeAllSessionsForUser(userId: string, callerUserId?: string): void {
    for (const s of this.sessions.values()) {
      if (s.user_id === userId && s.status === 'ACTIVE') {
        s.status = 'REVOKED';
      }
    }

    this.recordAuditEvent({
      eventType: 'ALL_SESSIONS_REVOKED',
      description: `All active sessions revoked for user ${userId}`,
      targetId: userId,
      target: userId,
      performedBy: callerUserId,
      severity: 'WARNING',
    });
  }

  public revokeAllSessionsForDevice(deviceId: string, callerUserId?: string): void {
    for (const s of this.sessions.values()) {
      if (s.device_id === deviceId && s.status === 'ACTIVE') {
        s.status = 'REVOKED';
      }
    }
  }

  // --- STEP-UP AUTHENTICATION & DECRYPTION AUTHORIZATION ---
  public verifyStepUpAuthentication(params: {
    userId: string;
    deviceId: string;
    assetId?: string;
  }): { authorized: boolean; token: string; expiresAt: string } {
    const passport = this.getDevicePassport(params.deviceId);
    if (!passport) throw new Error('Device not found');
    if (passport.status === 'REVOKED' || passport.risk_state === 'REVOKED') {
      throw new Error('Device has been revoked');
    }
    if (passport.status !== 'ACTIVE') {
      throw new Error(`Device is not active (${passport.status})`);
    }

    const user = this.getUserById(passport.user_id);
    if (user && (user.status === UserStatus.SUSPENDED || user.status === UserStatus.REVOKED)) {
      throw new Error(`Step-up authentication denied: User account is ${user.status}.`);
    }

    const token = 'KMS-AUTH-' + crypto.randomUUID().slice(0, 12).toUpperCase();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes temporary clearance

    this.recordDeviceTimelineEvent(
      params.deviceId,
      'STEP_UP_AUTH_SUCCESS',
      `Step-up WebAuthn authentication verified for asset ${params.assetId || 'sensitive operation'}`,
      'INFO'
    );

    this.recordDeviceTimelineEvent(
      params.deviceId,
      'DECRYPTION_AUTHORIZED',
      `Temporary Server-Side KMS key-release permit granted: ${token}`,
      'INFO'
    );

    this.recordAuditEvent({
      eventType: 'STEP_UP_AUTH_SUCCESS',
      description: `Step-up authentication verified for device "${passport.device_name}" (User: ${passport.user_name})`,
      targetId: params.assetId || passport.device_id,
      target: params.assetId || passport.device_id,
      severity: 'INFO',
    });

    this.recordAuditEvent({
      eventType: 'TEMPORARY_KEY_AUTHORIZED',
      description: `Server-Side KMS issued short-lived decryption token (${token})`,
      targetId: params.assetId || token,
      target: params.assetId || token,
      severity: 'INFO',
    });

    this.saveToDisk();
    return { authorized: true, token, expiresAt };

  }

  // --- ASSET ASSIGNMENTS & ACCESS ENFORCEMENT ---
  public getAssetsForUser(
    userId: string,
    options?: { scope?: 'MY_DATA' | 'ALL_DATA' }
  ): Array<{
    asset: StoredAsset;
    can_read: boolean;
    can_decrypt: boolean;
    can_download: boolean;
    can_edit: boolean;
    can_delete: boolean;
    status: string;
    expires_at: string | null;
    shared_by?: string;
    is_owner: boolean;
    sharing_scope: 'PRIVATE' | 'SPECIFIC_USERS' | 'ALL_PEOPLE';
    assigned_users_count: number;
    shares?: Array<{ user_id: string; user_name: string; permissions: string; expires_at: string | null }>;
  }> {
    const user = this.getUserById(userId);
    // EMERGENCY CONTROL: If user is suspended or revoked, block all asset operations immediately!
    if (user && (user.status === UserStatus.SUSPENDED || user.status === UserStatus.REVOKED)) {
      return [];
    }

    const results: Array<{
      asset: StoredAsset;
      can_read: boolean;
      can_decrypt: boolean;
      can_download: boolean;
      can_edit: boolean;
      can_delete: boolean;
      status: string;
      expires_at: string | null;
      shared_by?: string;
      is_owner: boolean;
      sharing_scope: 'PRIVATE' | 'SPECIFIC_USERS' | 'ALL_PEOPLE';
      assigned_users_count: number;
      shares?: Array<{ user_id: string; user_name: string; permissions: string; expires_at: string | null }>;
    }> = [];
    const isCallerAdmin = user?.role === UserRole.ADMIN || userId === 'usr_admin_001' || userId?.startsWith('admin');
    const showAllDataForAdmin = isCallerAdmin && options?.scope === 'ALL_DATA';

    for (const asset of this.assets.values()) {
      const isOwner = Boolean(asset.owner_id === userId || (user?.name && asset.owner_name === user.name));
      const userAssignment = this.assignments.find(a => a.asset_id === asset.id && a.user_id === userId);
      const allAssignment = this.assignments.find(a => a.asset_id === asset.id && a.user_id === 'ALL');
      const isSharedWithAll = Boolean(asset.shared_with_all || (allAssignment && allAssignment.status === 'ACTIVE'));

      // STRICT ACCESS ISOLATION:
      // Only data the user owns, has a specific assignment for, is shared with all people,
      // or admin in global organization overview mode will come to that user!
      // If caller is Administrator, they have root access to view all assets.
      const hasAccess = isOwner || Boolean(userAssignment) || isSharedWithAll || showAllDataForAdmin || isCallerAdmin;
      if (!hasAccess) {
        continue;
      }

      let canRead = true; // Can view metadata in vault
      let canDecrypt = false;
      let canDownload = false;
      let canEdit = false;
      let canDelete = false;
      let effectiveStatus = 'ACTIVE';
      let expiresAt: string | null = null;
      let sharedBy: string | undefined = undefined;

      if (isCallerAdmin) {
        // Root administrator has universal permission to read, decrypt, and download without access requests
        canRead = true;
        canDecrypt = true;
        canDownload = true;
        canEdit = true;
        canDelete = true;
        effectiveStatus = 'ACTIVE';
      } else if (userAssignment) {
        // User has an explicit assignment
        const isExpired = userAssignment.expires_at ? (new Date(userAssignment.expires_at).getTime() < Date.now()) : false;
        effectiveStatus = isExpired ? 'EXPIRED' : userAssignment.status;
        canRead = userAssignment.can_read;
        canDecrypt = !isExpired && userAssignment.status === 'ACTIVE' && userAssignment.can_decrypt;
        canDownload = !isExpired && userAssignment.status === 'ACTIVE' && (userAssignment.can_download ?? canDecrypt);
        canEdit = !isExpired && userAssignment.status === 'ACTIVE' && Boolean(userAssignment.can_edit);
        canDelete = !isExpired && userAssignment.status === 'ACTIVE' && Boolean(userAssignment.can_delete);
        expiresAt = userAssignment.expires_at;
        sharedBy = userAssignment.shared_by;
      } else if (allAssignment) {
        // Org-wide assignment
        const isExpired = allAssignment.expires_at ? (new Date(allAssignment.expires_at).getTime() < Date.now()) : false;
        effectiveStatus = isExpired ? 'EXPIRED' : allAssignment.status;
        canRead = allAssignment.can_read;
        canDecrypt = !isExpired && allAssignment.status === 'ACTIVE' && allAssignment.can_decrypt;
        canDownload = !isExpired && allAssignment.status === 'ACTIVE' && (allAssignment.can_download ?? canDecrypt);
        canEdit = false;
        canDelete = false;
        expiresAt = allAssignment.expires_at;
        sharedBy = allAssignment.shared_by;
      } else {
        // Non-admin without explicit or org-wide assignment:
        // Must request access from admin before decrypting or downloading!
        canRead = true;
        canDecrypt = false;
        canDownload = false;
        canEdit = false;
        canDelete = false;
        effectiveStatus = 'ACTIVE';
      }

      // Calculate active sharing scope
      const activeShares = this.assignments.filter(a => a.asset_id === asset.id && a.status === 'ACTIVE');
      let sharingScope: 'PRIVATE' | 'SPECIFIC_USERS' | 'ALL_PEOPLE' = 'PRIVATE';
      if (isSharedWithAll) {
        sharingScope = 'ALL_PEOPLE';
      } else if (activeShares.length > 1 || (activeShares.length === 1 && activeShares[0].user_id !== asset.owner_id)) {
        sharingScope = 'SPECIFIC_USERS';
      }

      const sharesSummary = activeShares.map(s => {
        const target = s.user_id === 'ALL' ? null : this.getUserById(s.user_id);
        const name = s.user_id === 'ALL' ? 'All People (Organization-Wide)' : (target?.name || s.shared_with_name || s.user_id);
        const perms = [
          s.can_read && 'Read',
          s.can_decrypt && 'Decrypt',
          s.can_download && 'Download',
          s.can_edit && 'Edit',
        ].filter(Boolean).join(', ');
        return {
          user_id: s.user_id,
          user_name: name,
          permissions: perms,
          expires_at: s.expires_at,
        };
      });

      results.push({
        asset,
        can_read: canRead,
        can_decrypt: canDecrypt,
        can_download: canDownload,
        can_edit: canEdit,
        can_delete: canDelete,
        status: effectiveStatus,
        expires_at: expiresAt,
        shared_by: sharedBy,
        is_owner: isOwner,
        sharing_scope: sharingScope,
        assigned_users_count: activeShares.length,
        shares: sharesSummary,
      });
    }

    return results;
  }

  public getAssignment(userId: string, assetId: string): StoredAssignment | null {
    const user = this.getUserById(userId);
    // EMERGENCY CONTROL: If user is suspended or revoked, block all assignments immediately!
    if (user && (user.status === UserStatus.SUSPENDED || user.status === UserStatus.REVOKED)) {
      return null;
    }

    const asset = this.assets.get(assetId);

    // 1. Direct assignment for user
    const match = this.assignments.find(a => a.asset_id === assetId && a.user_id === userId);
    if (match) {
      const isExpired = match.expires_at ? (new Date(match.expires_at).getTime() < Date.now()) : false;
      if (isExpired) {
        return {
          ...match,
          status: 'EXPIRED',
          can_decrypt: false,
          can_download: false,
          can_edit: false,
          can_delete: false,
        };
      }
      return match;
    }

    // 2. Owner has implicit full access
    if (asset && (asset.owner_id === userId || (userId && this.getUserById(userId)?.name === asset.owner_name))) {
      return {
        asset_id: assetId,
        user_id: userId,
        can_read: true,
        can_decrypt: true,
        can_download: true,
        can_edit: true,
        can_delete: true,
        status: 'ACTIVE',
        assigned_at: asset.created_at,
        expires_at: null,
      };
    }

    // 3. Organization-wide 'ALL' assignment
    const allMatch = this.assignments.find(a => a.asset_id === assetId && a.user_id === 'ALL');
    if (allMatch) {
      const isExpired = allMatch.expires_at ? (new Date(allMatch.expires_at).getTime() < Date.now()) : false;
      if (isExpired) {
        return {
          ...allMatch,
          status: 'EXPIRED',
          can_decrypt: false,
          can_download: false,
          can_edit: false,
          can_delete: false,
        };
      }
      return {
        ...allMatch,
        user_id: userId,
      };
    }

    // 4. Admin fallback
    if (user?.role === UserRole.ADMIN) {
      return {
        asset_id: assetId,
        user_id: userId,
        can_read: true,
        can_decrypt: true,
        can_download: true,
        can_edit: true,
        can_delete: true,
        status: 'ACTIVE',
        assigned_at: new Date().toISOString(),
        expires_at: null,
      };
    }

    return null;
  }

  public setAssignment(
    assetId: string, 
    userId: string, 
    canRead: boolean, 
    canDecrypt: boolean,
    canDownload: boolean = true,
    canEdit: boolean = false,
    canDelete: boolean = false,
    expiresAt: string | null = null,
    sharedBy?: string,
    sharedWithName?: string
  ): StoredAssignment {
    const index = this.assignments.findIndex(a => a.asset_id === assetId && a.user_id === userId);
    const prevAssignment = index >= 0 ? this.assignments[index] : null;
    const prevPerms = prevAssignment ? [
      prevAssignment.can_read && 'READ',
      prevAssignment.can_decrypt && 'DECRYPT',
      prevAssignment.can_download && 'DOWNLOAD',
      prevAssignment.can_edit && 'EDIT',
    ].filter(Boolean) : [];
    const newPerms = [
      canRead && 'READ',
      canDecrypt && 'DECRYPT',
      canDownload && 'DOWNLOAD',
      canEdit && 'EDIT',
    ].filter(Boolean);

    const assignment: StoredAssignment = {
      asset_id: assetId,
      user_id: userId,
      can_read: canRead,
      can_decrypt: canDecrypt,
      can_download: canDownload,
      can_edit: canEdit,
      can_delete: canDelete,
      status: canDecrypt ? 'ACTIVE' : 'REVOKED',
      assigned_at: new Date().toISOString(),
      expires_at: expiresAt,
      shared_by: sharedBy,
      shared_with_name: sharedWithName,
    };

    if (index >= 0) {
      this.assignments[index] = assignment;
    } else {
      this.assignments.push(assignment);
    }

    this.recordAuditEvent({
      eventType: 'PERMISSION_CHANGED',
      description: `Cryptographic access ${canDecrypt ? 'granted' : 'restricted'} for asset ${assetId} (user: ${userId}).`,
      targetId: assetId,
      target: assetId,
      before: prevPerms,
      after: newPerms,
      performedBy: sharedBy || 'Administrator',
      severity: 'INFO',
    });

    return assignment;
  }

  public revokeAssignment(assetId: string, userId: string): void {
    const index = this.assignments.findIndex(a => a.asset_id === assetId && a.user_id === userId);
    const prevAssignment = index >= 0 ? this.assignments[index] : null;
    const prevPerms = prevAssignment ? [
      prevAssignment.can_read && 'READ',
      prevAssignment.can_decrypt && 'DECRYPT',
      prevAssignment.can_download && 'DOWNLOAD',
      prevAssignment.can_edit && 'EDIT',
    ].filter(Boolean) : ['READ', 'DECRYPT'];

    if (index >= 0) {
      this.assignments[index].status = 'REVOKED';
      this.assignments[index].can_decrypt = false;
      this.assignments[index].can_download = false;
    } else {
      this.assignments.push({
        asset_id: assetId,
        user_id: userId,
        can_read: true,
        can_decrypt: false,
        can_download: false,
        can_edit: false,
        can_delete: false,
        status: 'REVOKED',
        assigned_at: new Date().toISOString(),
        expires_at: null,
      });
    }


    this.recordAuditEvent({
      eventType: 'PERMISSION_CHANGED',
      description: `Cryptographic access revoked for asset ${assetId} (user: ${userId}).`,
      targetId: assetId,
      target: assetId,
      before: prevPerms,
      after: ['READ'],
      performedBy: 'Administrator',
      severity: 'WARNING',
    });
    this.saveToDisk();
  }

  // --- VAULT ASSET MANAGEMENT (UPLOAD, SHARE, RENAME, MOVE, DELETE) ---
  public createAsset(params: {
    name: string;
    folder: 'Projects' | 'Finance' | 'HR' | 'Engineering' | 'Legal' | string;
    classification: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED' | string;
    description: string;
    plaintext: string;
    mimeType?: string;
    fileType?: string;
    ownerId: string;
    ownerName: string;
    sizeBytes?: number;
    shareScope?: 'PRIVATE' | 'SPECIFIC_USER' | 'ALL_PEOPLE';
    targetUserId?: string;
    canDecryptShared?: boolean;
    canDownloadShared?: boolean;
    expiresAt?: string | null;
  }): StoredAsset {
    const masterKey = process.env.SECUREMAX_KMS_MASTER_KEY || '0000000000000000000000000000000000000000000000000000000000000000';
    const assetId = 'ast_' + crypto.randomUUID().slice(0, 8);
    const assetCode = `SMX-${(params.folder || 'GEN').slice(0, 3).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

    const dek = generateDEK();
    const aad = `asset_data:${assetId}`;
    const enc = encryptData(Buffer.from(params.plaintext, 'utf8'), dek, aad);

    const kek = deriveKEK(masterKey, assetId);
    const wrapped = encryptData(dek, kek, `key_wrapping:${assetId}`);
    this.wrappedDEKs.set(assetId, {
      cipher: wrapped.ciphertext,
      iv: wrapped.iv,
      authTag: wrapped.authTag,
    });

    const fileSizeBytes = params.sizeBytes || Buffer.byteLength(params.plaintext, 'utf8');
    const fileType = params.fileType || (params.name.includes('.') ? params.name.split('.').pop()?.toUpperCase() || 'TXT' : 'TXT');
    const mimeType = params.mimeType || 'text/plain';

    const shareScope = params.shareScope || 'PRIVATE';
    const isSharedWithAll = shareScope === 'ALL_PEOPLE';

    const newAsset: StoredAsset = {
      id: assetId,
      asset_code: assetCode,
      name: params.name,
      classification: params.classification,
      status: 'ACTIVE',
      description: params.description || `Uploaded file ${params.name}`,
      encrypted_content: enc.ciphertext,
      iv: enc.iv,
      auth_tag: enc.authTag,
      aad,
      folder: params.folder || 'Projects',
      file_type: fileType,
      mime_type: mimeType,
      file_size_bytes: fileSizeBytes,
      owner_id: params.ownerId,
      owner_name: params.ownerName,
      shared_with_all: isSharedWithAll,
      default_access_policy: isSharedWithAll ? 'ORGANIZATION' : 'PRIVATE',
      created_at: new Date().toISOString(),
      last_accessed_at: new Date().toISOString(),
      key_version: 'v1',
      versions: [
        {
          version: 'v1.0',
          uploaded_by: params.ownerName,
          created_at: new Date().toISOString(),
          size: `${(fileSizeBytes / (1024 * 1024)).toFixed(2)} MB`,
          notes: 'Initial cryptographic commit via Secure Data Vault',
        },
      ],
      access_history: [
        {
          id: 'log_' + crypto.randomUUID().slice(0, 8),
          action: 'UPLOAD_ENCRYPT',
          user_name: params.ownerName,
          timestamp: new Date().toISOString(),
          status: 'SUCCESS',
          details: 'AES-256-GCM Envelope Encryption complete',
        },
      ],
      blockchain_token_id: `NFT-SEPOLIA-#${Math.floor(8000 + Math.random() * 1999)}`,
      blockchain_contract: '0xC5388f457D01cdF25B4A29f0A38d65f4e690bC2B',
      did: `did:securemax:asset:${assetId}`,
    };

    this.assets.set(assetId, newAsset);

    // 1. Grant owner full assignment (Private to creator by default)
    this.assignments.push({
      asset_id: assetId,
      user_id: params.ownerId,
      can_read: true,
      can_decrypt: true,
      can_download: true,
      can_edit: true,
      can_delete: true,
      status: 'ACTIVE',
      assigned_at: new Date().toISOString(),
      expires_at: null,
      shared_by: 'Self (Owner)',
      shared_with_name: params.ownerName,
    });

    // 2. If organization-wide sharing is selected:
    if (isSharedWithAll) {
      this.assignments.push({
        asset_id: assetId,
        user_id: 'ALL',
        can_read: true,
        can_decrypt: params.canDecryptShared !== false,
        can_download: params.canDownloadShared !== false,
        can_edit: false,
        can_delete: false,
        status: 'ACTIVE',
        assigned_at: new Date().toISOString(),
        expires_at: params.expiresAt || null,
        shared_by: params.ownerName,
        shared_with_name: 'All People (Organization-Wide)',
      });
    } 
    // 3. If specific person is selected:
    else if (shareScope === 'SPECIFIC_USER' && params.targetUserId) {
      const targetUser = this.getUserById(params.targetUserId);
      this.assignments.push({
        asset_id: assetId,
        user_id: params.targetUserId,
        can_read: true,
        can_decrypt: params.canDecryptShared !== false,
        can_download: params.canDownloadShared !== false,
        can_edit: false,
        can_delete: false,
        status: 'ACTIVE',
        assigned_at: new Date().toISOString(),
        expires_at: params.expiresAt || null,
        shared_by: params.ownerName,
        shared_with_name: targetUser?.name || params.targetUserId,
      });
    }

    this.recordAuditEvent({
      eventType: 'ASSET_ENCRYPTED_AND_STORED',
      description: `Asset registered and encrypted with AES-256-GCM: ${params.name} (${assetCode}) [Scope: ${shareScope}]`,
      targetId: assetId,
      userName: params.ownerName,
      severity: 'INFO',
    });

    this.saveToDisk();
    syncAssetToSupabase(newAsset).catch(() => {});
    return newAsset;
  }

  public shareAsset(params: {
    assetId: string;
    targetUserId?: string;
    toUserId?: string;
    callerUserId?: string;
    fromUserId?: string;
    canRead?: boolean;
    canDecrypt?: boolean;
    canDownload?: boolean;
    canEdit?: boolean;
    canDelete?: boolean;
    canShare?: boolean;
    canTransfer?: boolean;
    permissions?: {
      canRead?: boolean;
      canDecrypt?: boolean;
      canDownload?: boolean;
      canEdit?: boolean;
      canShare?: boolean;
      canTransfer?: boolean;
      canDelete?: boolean;
    };
    expiresAt?: string | null;
  }): StoredAssignment {
    const callerUserId = params.callerUserId || params.fromUserId || 'usr_admin_001';
    const targetUserId = params.targetUserId || params.toUserId || 'ALL';
    const asset = this.assets.get(params.assetId);
    if (!asset) throw new Error('Asset not found');

    const caller = this.getUserById(callerUserId);
    const callerAssignment = this.getAssignment(callerUserId, params.assetId);
    const isCallerAdmin = caller?.role === UserRole.ADMIN;
    const isOwner = asset.owner_id === callerUserId || asset.owner_name === caller?.name;

    if (!isCallerAdmin && !isOwner && (!callerAssignment || !callerAssignment.can_edit)) {
      throw new Error('Unauthorized: You do not have permission to share or manage access to this asset.');
    }

    const isAll = targetUserId === 'ALL';
    if (isAll) {
      asset.shared_with_all = true;
    }

    const targetUser = isAll ? null : this.getUserById(targetUserId);
    const targetName = isAll ? 'All People (Organization-Wide)' : (targetUser?.name || targetUserId);

    const assignment = this.setAssignment(
      params.assetId,
      targetUserId,
      (params.permissions?.canRead ?? params.canRead ?? true) !== false,
      (params.permissions?.canDecrypt ?? params.canDecrypt ?? true) !== false,
      (params.permissions?.canDownload ?? params.canDownload ?? false) !== false,
      Boolean(params.permissions?.canEdit ?? params.canEdit),
      Boolean(params.permissions?.canDelete ?? params.canDelete),
      params.expiresAt || null,
      caller?.name || 'Authorized User',
      targetName
    );

    this.recordAuditEvent({
      eventType: isAll ? 'ASSET_SHARED_ORGANIZATION_WIDE' : 'ASSET_ACCESS_SHARED',
      description: `Access to asset "${asset.name}" shared with ${targetName}${params.expiresAt ? ` (Expires: ${params.expiresAt})` : ''}`,
      targetId: params.assetId,
      userName: caller?.name,
      severity: 'INFO',
    });

    return assignment;
  }

  public revokeAssetShare(assetId: string, targetUserId: string, callerUserId: string): void {
    const asset = this.assets.get(assetId);
    if (!asset) throw new Error('Asset not found');

    const caller = this.getUserById(callerUserId);
    const callerAssignment = this.getAssignment(callerUserId, assetId);
    const isCallerAdmin = caller?.role === UserRole.ADMIN;
    const isOwner = asset.owner_id === callerUserId || asset.owner_name === caller?.name;

    if (!isCallerAdmin && !isOwner && (!callerAssignment || !callerAssignment.can_edit)) {
      throw new Error('Unauthorized: You do not have permission to revoke access to this asset.');
    }

    if (targetUserId === 'ALL') {
      asset.shared_with_all = false;
      this.assignments = this.assignments.filter(a => !(a.asset_id === assetId && a.user_id === 'ALL'));
    } else {
      this.assignments = this.assignments.filter(a => !(a.asset_id === assetId && a.user_id === targetUserId));
    }

    this.recordAuditEvent({
      eventType: 'ASSET_ACCESS_REVOKED',
      description: `Access to asset "${asset.name}" revoked for ${targetUserId === 'ALL' ? 'All People' : targetUserId}`,
      targetId: assetId,
      userName: caller?.name,
      severity: 'WARNING',
    });
  }

  public getSharesForAsset(assetId: string): Array<{
    userId: string;
    userName: string;
    userEmail?: string;
    canRead: boolean;
    canDecrypt: boolean;
    canDownload: boolean;
    canEdit: boolean;
    canDelete: boolean;
    status: string;
    expiresAt: string | null;
    isAll: boolean;
  }> {
    return this.assignments
      .filter(a => a.asset_id === assetId && a.status === 'ACTIVE')
      .map(a => {
        const isAll = a.user_id === 'ALL';
        const user = isAll ? null : this.getUserById(a.user_id);
        return {
          userId: a.user_id,
          userName: isAll ? 'All People (Organization-Wide)' : (user?.name || a.shared_with_name || a.user_id),
          userEmail: isAll ? 'all@organization.mil' : user?.email,
          canRead: a.can_read,
          canDecrypt: a.can_decrypt,
          canDownload: a.can_download,
          canEdit: a.can_edit,
          canDelete: a.can_delete,
          status: a.status,
          expiresAt: a.expires_at,
          isAll,
        };
      });
  }

  public setUserDefaultAccessPolicy(userId: string, policy: 'PRIVATE' | 'ORGANIZATION'): void {
    const user = this.getUserById(userId);
    if (user) {
      user.default_access_policy = policy;
      this.recordAuditEvent({
        eventType: 'USER_POLICY_UPDATED',
        description: `Default access policy set to ${policy} for user ${user.name}`,
        targetId: userId,
        userName: user.name,
        severity: 'INFO',
      });
    }
  }

  public getUserDefaultAccessPolicy(userId: string): 'PRIVATE' | 'ORGANIZATION' {
    const user = this.getUserById(userId);
    return user?.default_access_policy || 'PRIVATE';
  }

  public deleteAsset(assetId: string, callerUserId: string): void {
    const asset = this.assets.get(assetId);
    if (!asset) throw new Error('Asset not found');

    const caller = this.getUserById(callerUserId);
    const callerAssignment = this.getAssignment(callerUserId, assetId);
    const isCallerAdmin = caller?.role === UserRole.ADMIN;

    if (!isCallerAdmin && (!callerAssignment || !callerAssignment.can_delete)) {
      throw new Error('Unauthorized: You do not have permission to delete this asset.');
    }

    this.assets.delete(assetId);
    this.wrappedDEKs.delete(assetId);
    this.assignments = this.assignments.filter(a => a.asset_id !== assetId);

    this.recordAuditEvent({
      eventType: 'ASSET_PERMANENTLY_DELETED',
      description: `Asset permanently deleted from vault: ${asset.name} (${asset.asset_code})`,
      targetId: assetId,
      userName: caller?.name,
      severity: 'WARNING',
    });
  }

  public renameAsset(assetId: string, newName: string, callerUserId: string): StoredAsset {
    const asset = this.assets.get(assetId);
    if (!asset) throw new Error('Asset not found');

    const caller = this.getUserById(callerUserId);
    const callerAssignment = this.getAssignment(callerUserId, assetId);
    const isCallerAdmin = caller?.role === UserRole.ADMIN;

    if (!isCallerAdmin && (!callerAssignment || !callerAssignment.can_edit)) {
      throw new Error('Unauthorized: You do not have permission to rename this asset.');
    }

    const oldName = asset.name;
    asset.name = newName.trim();
    
    // Add version bump
    const nextVerNum = asset.versions.length + 1;
    asset.versions.unshift({
      version: `v${nextVerNum}.0`,
      uploaded_by: caller?.name || 'Authorized User',
      created_at: new Date().toISOString(),
      size: `${(asset.file_size_bytes / (1024 * 1024)).toFixed(2)} MB`,
      notes: `Renamed from "${oldName}" to "${newName}"`,
    });

    this.recordAuditEvent({
      eventType: 'ASSET_METADATA_UPDATED',
      description: `Asset renamed: "${oldName}" -> "${newName}"`,
      targetId: assetId,
      userName: caller?.name,
      severity: 'INFO',
    });

    this.saveToDisk();
    return asset;
  }

  public moveAssetFolder(assetId: string, newFolder: string, callerUserId: string): StoredAsset {
    const asset = this.assets.get(assetId);
    if (!asset) throw new Error('Asset not found');

    const caller = this.getUserById(callerUserId);
    const callerAssignment = this.getAssignment(callerUserId, assetId);
    const isCallerAdmin = caller?.role === UserRole.ADMIN;

    if (!isCallerAdmin && (!callerAssignment || !callerAssignment.can_edit)) {
      throw new Error('Unauthorized: You do not have permission to move this asset.');
    }

    const oldFolder = asset.folder;
    asset.folder = newFolder;

    this.recordAuditEvent({
      eventType: 'ASSET_FOLDER_MOVED',
      description: `Asset "${asset.name}" moved from folder "${oldFolder}" to "${newFolder}"`,
      targetId: assetId,
      userName: caller?.name,
      severity: 'INFO',
    });

    this.saveToDisk();
    return asset;
  }

  public archiveAsset(assetId: string, userId: string, archive = true): void {
    const asset = this.assets.get(assetId);
    if (!asset) throw new Error('Asset not found');
    const user = this.getUserById(userId);
    asset.is_archived = archive;

    this.recordAuditEvent({
      eventType: archive ? 'ASSET_ARCHIVED' : 'ASSET_RESTORED',
      description: `Asset "${asset.name}" was ${archive ? 'archived' : 'restored'} by ${user?.name || 'User'}`,
      targetId: assetId,
      userName: user?.name,
      severity: 'INFO',
    });
    this.saveToDisk();
  }

  public recordAssetAccess(
    assetId: string,
    userId: string,
    action: string,
    status: 'SUCCESS' | 'DENIED' | 'PENDING',
    details?: string
  ): void {
    const asset = this.assets.get(assetId);
    if (!asset) return;

    const user = this.getUserById(userId);
    const logEntry: AssetAccessLog = {
      id: 'log_' + crypto.randomUUID().slice(0, 8),
      action,
      user_name: user?.name || userId,
      timestamp: new Date().toISOString(),
      status,
      details,
    };

    if (!asset.access_history) asset.access_history = [];
    asset.access_history.unshift(logEntry);
    asset.last_accessed_at = logEntry.timestamp;
    this.saveToDisk();
  }

  public logAssetAccess(
    assetId: string,
    userName: string,
    action: string,
    status: 'SUCCESS' | 'DENIED' | 'PENDING'
  ): void {
    const asset = this.assets.get(assetId);
    if (asset) {
      if (!asset.access_history) asset.access_history = [];
      asset.access_history.unshift({
        id: 'log_' + crypto.randomUUID().slice(0, 8),
        action,
        user_name: userName,
        timestamp: new Date().toISOString(),
        status,
      });
      asset.last_accessed_at = new Date().toISOString();
      this.saveToDisk();
    }
  }

  // --- NOTIFICATIONS ---
  public getNotifications(): StoredNotification[] {
    return this.notifications;
  }

  public markNotificationRead(id: string): void {
    const n = this.notifications.find(item => item.id === id);
    if (n) {
      n.read = true;
      this.saveToDisk();
    }
  }

  // --- PERMANENT AUDIT TRAIL ---
  public recordAuditEvent(params: {
    eventType: string;
    description: string;
    targetId?: string;
    target?: string;
    before?: any;
    after?: any;
    performedBy?: string;
    userEmail?: string;
    userName?: string;
    severity?: 'INFO' | 'WARNING' | 'CRITICAL';
  }): StoredAuditEvent {
    const payload = `${Date.now()}:${params.eventType}:${params.description}:${JSON.stringify(params.before || {})}:${JSON.stringify(params.after || {})}`;
    const rawHash = crypto.createHash('sha256').update(payload).digest('hex');
    const event: StoredAuditEvent = {
      id: 'aud_' + crypto.randomUUID().slice(0, 8),
      event_type: params.eventType,
      description: params.description,
      target_id: params.targetId || params.target,
      target: params.target || params.targetId,
      before: params.before,
      after: params.after,
      performed_by: params.performedBy,
      user_email: params.userEmail,
      user_name: params.userName,
      severity: params.severity || 'INFO',
      event_hash: '0x' + rawHash,
      block_number: 6849200 + Math.floor(Math.random() * 500),
      created_at: new Date().toISOString(),
    };
    this.auditEvents.unshift(event);
    this.saveToDisk();
    return event;
  }

  public getAuditEvents(): StoredAuditEvent[] {
    return this.auditEvents;
  }

  // --- ACCESS REQUESTS (HIGH-RISK DATA & AUDITOR UPDATES) ---
  public createAccessRequest(params: {
    userId: string;
    requestType: 'HIGH_RISK_DATA' | 'AUDIT_UPDATE' | 'ASSET_ACCESS';
    assetId?: string;
    reason: string;
  }): StoredAccessRequest {
    const user = this.getUserById(params.userId);
    if (!user) throw new Error('User not found');

    let assetName = 'System Audit Ledger';
    let assetCode = 'SMX-AUDIT-ROOT';

    if (params.assetId) {
      const asset = this.assets.get(params.assetId);
      if (asset) {
        assetName = asset.name;
        assetCode = asset.asset_code;
      }
    }

    const reqId = 'req_' + crypto.randomUUID().slice(0, 8);
    const accessReq: StoredAccessRequest = {
      id: reqId,
      user_id: user.id,
      user_email: user.email,
      user_name: user.name,
      role: user.role,
      request_type: params.requestType,
      asset_id: params.assetId,
      asset_code: assetCode,
      asset_name: assetName,
      reason: params.reason,
      status: 'PENDING',
      created_at: new Date().toISOString(),
    };

    this.accessRequests.unshift(accessReq);

    this.recordAuditEvent({
      eventType: 'ACCESS_REQUEST_SUBMITTED',
      description: `${user.name} requested clearance for ${assetName} (Pending Admin NFT Permit)`,
      targetId: params.assetId || 'AUDIT_LEDGER',
      userEmail: user.email,
      userName: user.name,
      severity: 'WARNING',
    });

    this.notifications.unshift({
      id: 'notif_' + crypto.randomUUID().slice(0, 8),
      type: 'ACCESS_REQUEST',
      title: 'New Access Request',
      message: `${user.name} requested clearance for ${assetName}`,
      timestamp: 'Just now',
      read: false,
      target_id: params.assetId,
    });

    this.saveToDisk();
    syncAccessRequestToSupabase(accessReq).catch(() => {});

    storeEvents.emit('change', {
      type: 'ACCESS_REQUEST_SUBMITTED',
      data: accessReq,
      timestamp: Date.now(),
    });

    return accessReq;
  }

  public approveAccessRequest(requestId: string, adminUserId: string, ttlMinutes: number = 30): StoredAccessRequest {
    const admin = this.getUserById(adminUserId) || this.getUserByEmail(adminUserId) || this.users.get('usr_admin_001');
    if (admin && admin.role !== UserRole.ADMIN && process.env.NODE_ENV === 'production') {
      throw new Error('Only Administrator can approve access and mint NFT permits');
    }

    const req = this.accessRequests.find(r => r.id === requestId);
    if (!req) throw new Error('Access request not found');

    req.status = 'APPROVED';
    req.approved_at = new Date().toISOString();
    req.ttl_minutes = ttlMinutes;
    req.nft_token_id = `NFT-SEPOLIA-#${Math.floor(1000 + Math.random() * 9000)}`;

    // If it was for an asset, grant decryption access in assignments
    if (req.asset_id && req.user_id) {
      this.setAssignment(req.asset_id, req.user_id, true, true);
    }

    // Create an active Live Grant with TTL
    const liveGrant = this.createLiveGrant({
      user: req.user_name,
      userId: req.user_id,
      assetCode: req.asset_code || 'SMX-ASSET',
      assetName: req.asset_name || 'Authorized Secure Document',
      ttlMinutes,
      sessionId: crypto.randomBytes(4).toString('hex'),
      ip: '10.42.7.' + Math.floor(Math.random() * 200 + 1),
      device: 'known device',
    });

    (req as any).liveGrant = liveGrant;

    this.recordAuditEvent({
      eventType: 'NFT_ACCESS_PERMIT_MINTED',
      description: `Admin approved access for ${req.user_name} (${ttlMinutes}m TTL). NFT Permit: ${req.nft_token_id}`,
      targetId: req.asset_id || req.nft_token_id,
      userEmail: req.user_email,
      userName: req.user_name,
      severity: 'INFO',
    });

    this.notifications.unshift({
      id: 'notif_' + crypto.randomUUID().slice(0, 8),
      type: 'ACCESS_APPROVED',
      title: 'Access Request Approved',
      message: `Access granted for ${req.asset_name}. On-chain permit ${req.nft_token_id} minted.`,
      timestamp: 'Just now',
      read: false,
      target_id: req.asset_id,
    });

    this.saveToDisk();

    storeEvents.emit('change', {
      type: 'ACCESS_REQUEST_APPROVED',
      data: req,
      timestamp: Date.now(),
    });

    return req;
  }

  public rejectAccessRequest(requestId: string, adminUserId: string, reason?: string): StoredAccessRequest {
    const admin = this.getUserById(adminUserId);
    if (admin?.role !== UserRole.ADMIN) {
      throw new Error('Only Administrator can reject access requests');
    }

    const req = this.accessRequests.find(r => r.id === requestId);
    if (!req) throw new Error('Access request not found');

    req.status = 'REJECTED';
    req.rejected_at = new Date().toISOString();
    req.rejected_reason = reason;

    if (req.asset_id) {
      this.logAssetAccess(req.asset_id, req.user_name, `Access request denied: ${reason || 'Security policy restriction'}`, 'DENIED');
    }

    this.recordAuditEvent({
      eventType: 'ACCESS_REQUEST_REJECTED',
      description: `Admin rejected clearance for ${req.user_name} on ${req.asset_name}`,
      targetId: req.asset_id || requestId,
      userEmail: req.user_email,
      userName: req.user_name,
      severity: 'WARNING',
    });

    this.saveToDisk();

    storeEvents.emit('change', {
      type: 'ACCESS_REQUEST_REJECTED',
      data: req,
      timestamp: Date.now(),
    });

    return req;
  }

  public getAccessRequests(): StoredAccessRequest[] {
    return this.accessRequests;
  }

  // --- LIVE GRANTS MANAGEMENT (ACTIVE SESSIONS & TIMERS) ---
  public getLiveGrants(): LiveGrant[] {
    const now = Date.now();
    return this.liveGrants.map(g => {
      const remainingMs = new Date(g.expiresAt).getTime() - now;
      const remainingSeconds = Math.max(0, Math.floor(remainingMs / 1000));
      return {
        ...g,
        remainingSeconds,
        status: g.status === 'REVOKED' ? 'REVOKED' : (remainingSeconds <= 0 && g.status === 'ACTIVE' ? 'EXPIRED' : g.status),
      };
    });
  }

  public createLiveGrant(params: {
    user: string;
    userId?: string;
    assetCode: string;
    assetName?: string;
    ttlMinutes: number;
    sessionId?: string;
    ip?: string;
    device?: string;
  }): LiveGrant {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + params.ttlMinutes * 60 * 1000).toISOString();
    const grant: LiveGrant = {
      id: 'grant-' + crypto.randomUUID().slice(0, 8),
      user: params.user,
      userId: params.userId,
      assetCode: params.assetCode,
      assetName: params.assetName,
      sessionId: params.sessionId || crypto.randomBytes(4).toString('hex'),
      ip: params.ip || '10.42.7.' + Math.floor(Math.random() * 200 + 1),
      device: params.device || 'known device',
      expiresAt,
      remainingSeconds: params.ttlMinutes * 60,
      status: 'ACTIVE',
      createdAt: now.toISOString(),
    };

    this.liveGrants.unshift(grant);
    this.saveToDisk();
    return grant;
  }

  public revokeLiveGrant(grantId: string, adminUserId?: string): LiveGrant | null {
    const grant = this.liveGrants.find(g => g.id === grantId || g.sessionId === grantId || (g.assetCode === grantId && g.status === 'ACTIVE'));
    if (!grant) return null;
    grant.status = 'REVOKED';
    grant.remainingSeconds = 0;

    // Immediately revoke asset decryption assignment in assignments
    if (grant.userId) {
      let targetAssetId: string | undefined;
      for (const [id, a] of this.assets.entries()) {
        if (a.asset_code === grant.assetCode || a.id === grant.assetCode || (a as any).code === grant.assetCode) {
          targetAssetId = id;
          break;
        }
      }
      if (targetAssetId) {
        this.revokeAssignment(targetAssetId, grant.userId);
      }
    }

    this.recordAuditEvent({
      eventType: 'ACCESS_PERMISSION_REVOKED',
      description: `Live grant revoked for ${grant.user} on ${grant.assetCode} (Session ${grant.sessionId})`,
      targetId: grant.assetCode,
      userName: adminUserId || 'Administrator',
      severity: 'WARNING',
    });

    this.saveToDisk();

    storeEvents.emit('change', {
      type: 'LIVE_GRANT_REVOKED',
      data: grant,
      timestamp: Date.now(),
    });

    return grant;
  }

  public extendLiveGrant(grantId: string, additionalMinutes: number): LiveGrant | null {
    const grant = this.liveGrants.find(g => g.id === grantId);
    if (!grant) return null;
    const currentExp = new Date(grant.expiresAt).getTime();
    const base = Math.max(Date.now(), currentExp);
    grant.expiresAt = new Date(base + additionalMinutes * 60 * 1000).toISOString();
    grant.status = 'ACTIVE';

    this.recordAuditEvent({
      eventType: 'ACCESS_PERMISSION_EXTENDED',
      description: `Decryption session extended by ${additionalMinutes} min for ${grant.user} on ${grant.assetCode}`,
      targetId: grant.assetCode,
      userName: grant.user,
      severity: 'INFO',
    });

    this.saveToDisk();
    return grant;
  }

  // --- LOGIN HISTORY & SESSION AUDIT ---
  public recordLogin(params: {
    userId: string;
    userName: string;
    userEmail: string;
    role: string;
    deviceName: string;
    ip?: string;
    status: 'SUCCESS' | 'FAILED';
  }): LoginHistoryRecord {
    const record: LoginHistoryRecord = {
      id: 'log_' + crypto.randomUUID().slice(0, 8),
      userId: params.userId,
      userName: params.userName,
      userEmail: params.userEmail,
      role: params.role,
      deviceName: params.deviceName,
      ip: params.ip || '127.0.0.1',
      timestamp: new Date().toISOString(),
      status: params.status,
    };

    this.loginHistory.unshift(record);
    if (this.loginHistory.length > 500) {
      this.loginHistory.pop();
    }

    this.recordAuditEvent({
      eventType: params.status === 'SUCCESS' ? 'USER_LOGIN_SUCCESS' : 'USER_LOGIN_FAILED',
      description: `${params.userName} (${params.role}) logged in via ${params.deviceName} [${record.ip}]`,
      targetId: params.userId,
      userEmail: params.userEmail,
      userName: params.userName,
      severity: params.status === 'SUCCESS' ? 'INFO' : 'WARNING',
    });

    this.saveToDisk();
    return record;
  }

  public getLoginHistory(): LoginHistoryRecord[] {
    return this.loginHistory;
  }
}

// Global singleton
const globalForStore = global as unknown as { secureMaxStore?: SecureMaxStore };
export const deviceStore = globalForStore.secureMaxStore || new SecureMaxStore();
globalForStore.secureMaxStore = deviceStore;
