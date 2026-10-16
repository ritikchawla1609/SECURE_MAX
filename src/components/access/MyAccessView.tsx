'use client';

import * as React from 'react';
import Link from 'next/link';
import { 
  Lock, 
  Unlock, 
  ShieldCheck, 
  Clock, 
  FileText, 
  Key, 
  Laptop, 
  Smartphone, 
  QrCode, 
  AlertTriangle, 
  CheckCircle2, 
  ExternalLink, 
  Eye, 
  X, 
  Copy, 
  Check, 
  LogOut, 
  Hexagon, 
  ChevronRight,
  Shield,
  Layers,
  Sparkles,
  Send,
  Loader2,
  Activity,
  FolderLock,
  RefreshCw,
  FileCode2,
  HardDrive,
  Users,
  Folder,
  Download,
  UserX
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  submitAccessRequestAction, 
  extendLiveGrantAction, 
  revokeLiveGrantAction,
  fetchAllAccessRequestsAction
} from '@/app/actions/accessRequests';
import { useSecureMaxRealtime } from '@/hooks/useSecureMaxRealtime';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  position: string;
  did: string;
  admin_wallet?: string;
  status: string;
}

interface UserSession {
  userId: string;
  email?: string;
  name?: string;
  role: string;
  did?: string;
  deviceId?: string;
  deviceName?: string;
  sessionId: string;
  assuranceLevel?: string;
}

interface VaultAsset {
  id: string;
  code: string;
  name: string;
  classification: string;
  status: string;
  description: string;
  canRead: boolean;
  canDecrypt: boolean;
  canDownload: boolean;
  canEdit: boolean;
  canDelete: boolean;
  folder: string;
  fileType: string;
  mimeType: string;
  fileSizeBytes: number;
  ownerName: string;
  blockchainTokenId?: string;
  blockchainContract?: string;
  did?: string;
  isOwner?: boolean;
  shares?: Array<{ user_id: string; user_name: string; permissions: string; expires_at: string | null }>;
}

interface UserDevice {
  id: string;
  deviceId: string;
  deviceName: string;
  deviceType: string;
  os: string;
  browser: string;
  riskState: string;
  status: string;
  lastUsedAt?: string;
  lastAuthenticatedAt?: string;
}

interface DecryptedContent {
  assetId: string;
  assetName: string;
  classification: string;
  folder: string;
  fileType: string;
  mimeType: string;
  fileSizeBytes: number;
  decryptedData: string;
  decryptedAt: string;
  keyVersion?: string;
  encryptionStandard?: string;
  authorizedBy?: string;
}

export function MyAccessView() {
  const { data: realtimeData, broadcastUpdate, refetch: refetchRealtime } = useSecureMaxRealtime(true);

  // User & Session state
  const [currentUser, setCurrentUser] = React.useState<UserProfile | null>(null);
  const [currentSession, setCurrentSession] = React.useState<UserSession | null>(null);

  // Data collections
  const [assets, setAssets] = React.useState<VaultAsset[]>([]);
  const [pendingAssetIds, setPendingAssetIds] = React.useState<string[]>([]);
  const [devices, setDevices] = React.useState<UserDevice[]>([]);
  const [personnel, setPersonnel] = React.useState<any[]>([]);
  const [requests, setRequests] = React.useState<any[]>([]);

  // Loading states
  const [loadingAssets, setLoadingAssets] = React.useState(true);
  const [loadingDevices, setLoadingDevices] = React.useState(true);
  const [actionInProgress, setActionInProgress] = React.useState<string | null>(null);

  // Active Clearance Grant state
  const [activeGrant, setActiveGrant] = React.useState<any | null>(null);
  const [activeGrantDecrypted, setActiveGrantDecrypted] = React.useState<string | null>(null);
  const [loadingActiveGrantDecrypt, setLoadingActiveGrantDecrypt] = React.useState(false);
  const [secondsRemaining, setSecondsRemaining] = React.useState<number>(0);
  const [isLocked, setIsLocked] = React.useState(false);

  // Decryption Modal state
  const [decryptModalAsset, setDecryptModalAsset] = React.useState<VaultAsset | null>(null);
  const [decryptModalData, setDecryptModalData] = React.useState<DecryptedContent | null>(null);
  const [decryptModalLoading, setDecryptModalLoading] = React.useState(false);
  const [decryptModalError, setDecryptModalError] = React.useState<string | null>(null);

  // Request Access Modal state
  const [showRequestModal, setShowRequestModal] = React.useState(false);
  const [requestAssetId, setRequestAssetId] = React.useState<string>('');
  const [requestPurpose, setRequestPurpose] = React.useState('Security review and operational maintenance');
  const [requestTtl, setRequestTtl] = React.useState<number>(30);
  const [requestSubmitted, setRequestSubmitted] = React.useState(false);
  const [submittingRequest, setSubmittingRequest] = React.useState(false);

  // Tab State
  const [activeTab, setActiveTab] = React.useState<'permissions' | 'requests'>('permissions');

  // Revoke Access Modal state
  const [revokeTarget, setRevokeTarget] = React.useState<{
    assetId: string;
    assetName: string;
    userId: string;
    userName: string;
  } | null>(null);
  const [revoking, setRevoking] = React.useState(false);
  const [revokeNotice, setRevokeNotice] = React.useState<string | null>(null);

  // Other Modals
  const [showQrModal, setShowQrModal] = React.useState(false);
  const [showGuardiansModal, setShowGuardiansModal] = React.useState(false);
  const [copiedDid, setCopiedDid] = React.useState(false);
  const [copiedDecrypted, setCopiedDecrypted] = React.useState(false);

  // ----------------------------------------------------
  // DATA FETCHING FUNCTIONS
  // ----------------------------------------------------

  const fetchSessionData = React.useCallback(async () => {
    try {
      const res = await fetch('/api/auth/session', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json.session) setCurrentSession(json.session);
        if (json.user) setCurrentUser(json.user);
      }
    } catch (err) {
      console.error('Failed to load session:', err);
    }
  }, []);

  const fetchAssetsData = React.useCallback(async (isBackground = false) => {
    if (!isBackground) setLoadingAssets(true);
    try {
      const res = await fetch('/api/assets/list', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json.assets) {
          setAssets(prev => (JSON.stringify(prev) === JSON.stringify(json.assets) ? prev : json.assets));
        }
        if (json.pendingAssetIds) {
          setPendingAssetIds(prev => (JSON.stringify(prev) === JSON.stringify(json.pendingAssetIds) ? prev : json.pendingAssetIds));
        }
        if (!currentUser && json.userName) {
          setCurrentUser(prev => prev || ({
            id: json.userId,
            name: json.userName,
            email: '',
            role: json.role,
            position: json.role,
            did: `did:securemax:${json.userId}`,
            status: 'ACTIVE'
          } as UserProfile));
        }
      }
    } catch (err) {
      console.error('Failed to load assets:', err);
    } finally {
      if (!isBackground) setLoadingAssets(false);
    }
  }, [currentUser]);

  const fetchDevicesData = React.useCallback(async (isBackground = false) => {
    if (!isBackground && devices.length === 0) setLoadingDevices(true);
    try {
      const res = await fetch('/api/devices', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json.devices) setDevices(prev => (JSON.stringify(prev) === JSON.stringify(json.devices) ? prev : json.devices));
        if (json.personnel) setPersonnel(prev => (JSON.stringify(prev) === JSON.stringify(json.personnel) ? prev : json.personnel));
      }
    } catch (err) {
      console.error('Failed to load devices:', err);
    } finally {
      if (!isBackground) setLoadingDevices(false);
    }
  }, [devices.length]);

  const fetchRequestsData = React.useCallback(async () => {
    try {
      const res = await fetchAllAccessRequestsAction();
      if (res.success && res.requests) {
        setRequests(res.requests);
      }
    } catch (err) {
      console.error('Failed to load access requests:', err);
    }
  }, []);

  // Initial load
  React.useEffect(() => {
    fetchSessionData();
  }, [fetchSessionData]);

  React.useEffect(() => {
    fetchAssetsData();
  }, [fetchAssetsData]);

  React.useEffect(() => {
    fetchDevicesData();
  }, [fetchDevicesData]);

  React.useEffect(() => {
    fetchRequestsData();
  }, [fetchRequestsData]);

  // ----------------------------------------------------
  // REAL-TIME SYNC & LIVE GRANTS
  // ----------------------------------------------------

  React.useEffect(() => {
    if (!realtimeData?.liveGrants) return;

    // Find the active grant for current user
    const userIdentifier = currentUser?.id || currentSession?.userId;
    const userName = currentUser?.name || currentSession?.name;

    const myActiveGrant = realtimeData.liveGrants.find((g: any) => {
      const matchesUser = (userIdentifier && g.userId === userIdentifier) || 
                          (userName && g.user === userName) ||
                          (!userIdentifier && !userName);
      return matchesUser && g.status === 'ACTIVE';
    });

    if (myActiveGrant) {
      setActiveGrant(myActiveGrant);
      setIsLocked(false);
      if (typeof myActiveGrant.remainingSeconds === 'number') {
        setSecondsRemaining(myActiveGrant.remainingSeconds);
      }
    } else {
      // Check if previous grant was revoked/expired
      if (activeGrant) {
        const matchingGrant = realtimeData.liveGrants.find((g: any) => g.id === activeGrant.id);
        if (matchingGrant && (matchingGrant.status === 'REVOKED' || matchingGrant.status === 'EXPIRED')) {
          setIsLocked(true);
          setSecondsRemaining(0);
        }
      }
    }

    // Update pending requests from realtime data
    if (realtimeData.pendingRequests) {
      const myPending = realtimeData.pendingRequests.filter((r: any) => 
        !userIdentifier || r.actor === userName || r.userId === userIdentifier
      );
      if (myPending.length > 0 || realtimeData.liveGrants.length > 0) {
        fetchRequestsData();
        fetchAssetsData(true);
      }
    } else {
      fetchAssetsData(true); // Fallback in background
    }
  }, [realtimeData, currentUser, currentSession, activeGrant, fetchRequestsData, fetchAssetsData]);

  // Decrypt content for active grant automatically
  React.useEffect(() => {
    if (!activeGrant?.assetCode || isLocked) {
      setActiveGrantDecrypted(null);
      return;
    }

    // Find matching asset ID in loaded assets
    const matchedAsset = assets.find(a => a.code === activeGrant.assetCode);
    if (!matchedAsset) return;

    let isMounted = true;
    setLoadingActiveGrantDecrypt(true);

    fetch('/api/assets/decrypt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetId: matchedAsset.id })
    })
      .then(res => res.json())
      .then(data => {
        if (isMounted) {
          if (data.success && data.decryptedData) {
            setActiveGrantDecrypted(data.decryptedData);
          } else {
            setActiveGrantDecrypted(null);
          }
        }
      })
      .catch(err => {
        if (isMounted) console.error('Active grant decrypt failed:', err);
      })
      .finally(() => {
        if (isMounted) setLoadingActiveGrantDecrypt(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeGrant, isLocked, assets]);

  // Live countdown timer
  React.useEffect(() => {
    if (isLocked || secondsRemaining <= 0) return;
    const timer = setInterval(() => {
      setSecondsRemaining(prev => {
        if (prev <= 1) {
          setIsLocked(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isLocked, secondsRemaining]);

  const formatCountdown = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // ----------------------------------------------------
  // ACTIONS
  // ----------------------------------------------------

  const handleExtendGrant = async () => {
    if (!activeGrant) return;
    setActionInProgress('extend');
    try {
      await extendLiveGrantAction({ grantId: activeGrant.id, additionalMinutes: 15 });
      broadcastUpdate('GRANT_EXTENDED', { grantId: activeGrant.id, assetCode: activeGrant.assetCode });
      setSecondsRemaining(prev => prev + 15 * 60);
      setIsLocked(false);
    } catch (err) {
      console.error(err);
      refetchRealtime();
    } finally {
      setActionInProgress(null);
    }
  };

  const handleLockGrant = async () => {
    if (!activeGrant) return;
    setActionInProgress('lock');
    try {
      await revokeLiveGrantAction({ grantId: activeGrant.id });
      broadcastUpdate('GRANT_REVOKED', { grantId: activeGrant.id, assetCode: activeGrant.assetCode });
      setIsLocked(true);
      setSecondsRemaining(0);
      setActiveGrantDecrypted(null);
    } catch (err) {
      console.error(err);
      refetchRealtime();
    } finally {
      setActionInProgress(null);
    }
  };

  const handleOpenDecryptModal = async (asset: VaultAsset) => {
    setDecryptModalAsset(asset);
    setDecryptModalData(null);
    setDecryptModalError(null);
    setDecryptModalLoading(true);

    try {
      const res = await fetch('/api/assets/decrypt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId: asset.id }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDecryptModalData(data);
      } else {
        setDecryptModalError(data.error || 'Failed to decrypt asset.');
      }
    } catch (err: any) {
      setDecryptModalError(err.message || 'Decryption service unreachable.');
    } finally {
      setDecryptModalLoading(false);
    }
  };

  const handleOpenRequestModal = (asset?: VaultAsset) => {
    if (asset) {
      setRequestAssetId(asset.id);
    } else {
      const firstRequestable = assets.find(a => !a.canDecrypt);
      setRequestAssetId(firstRequestable?.id || (assets[0]?.id || ''));
    }
    setRequestSubmitted(false);
    setShowRequestModal(true);
  };

  const handleSubmitAccessRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestAssetId) return;

    setSubmittingRequest(true);
    const targetAsset = assets.find(a => a.id === requestAssetId);

    try {
      const result = await submitAccessRequestAction({
        assetId: requestAssetId,
        assetCode: targetAsset?.code,
        reason: requestPurpose,
        requestType: 'ASSET_ACCESS',
        ttlMinutes: requestTtl,
      });

      if (result.success) {
        setRequestSubmitted(true);
        broadcastUpdate('REQUEST_SUBMITTED', { 
          assetId: requestAssetId, 
          assetCode: targetAsset?.code, 
          reason: requestPurpose 
        });
        fetchRequestsData();
        fetchAssetsData();
        setTimeout(() => {
          setShowRequestModal(false);
          setRequestSubmitted(false);
        }, 2000);
      } else {
        alert(result.error || 'Failed to submit request');
      }
    } catch (err: any) {
      console.error('Request submission error:', err);
      alert(err.message || 'Submission error');
    } finally {
      setSubmittingRequest(false);
    }
  };

  const handleRevokeDevice = async (deviceId: string) => {
    if (!confirm('Are you sure you want to revoke and de-authorize this device?')) return;
    try {
      const res = await fetch('/api/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revoke', deviceId }),
      });
      if (res.ok) {
        fetchDevicesData();
        broadcastUpdate('DEVICE_REVOKED', { deviceId });
      }
    } catch (err) {
      console.error('Device revocation error:', err);
    }
  };

  const handleLogoutEverywhere = async () => {
    if (!confirm('Log out of all active sessions across all devices?')) return;
    try {
      await fetch('/api/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revoke_all_sessions' }),
      });
      window.location.href = '/login';
    } catch (err) {
      window.location.href = '/login';
    }
  };

  // Helper values
  const isAdmin = currentUser?.role === 'ADMIN' || currentSession?.role === 'ADMIN' || currentUser?.id === 'usr_admin_001';
  const clearedAssets = assets.filter(a => a.canDecrypt || isAdmin);
  const requestableAssets = assets.filter(a => !a.canDecrypt && !isAdmin);
  const pendingRequestsCount = requests.filter(r => r.status === 'PENDING').length;

  const displayUser = currentUser || {
    id: currentSession?.userId || 'usr_unknown',
    name: currentSession?.name || currentSession?.email || 'Authorized Operator',
    email: currentSession?.email || '',
    role: currentSession?.role || 'USER',
    position: currentSession?.role || 'OPERATOR',
    did: currentSession?.did || `did:securemax:${currentSession?.userId || '0x0000'}`,
    status: 'ACTIVE'
  };

  const truncatedDid = displayUser.did
    ? `${displayUser.did.slice(0, 14)}…${displayUser.did.slice(-6)}`
    : 'did:securemax:unknown';

  const userWalletDisplay = displayUser.admin_wallet
    ? `${displayUser.admin_wallet.slice(0, 8)}…${displayUser.admin_wallet.slice(-6)}`
    : 'Hardware P-256 Key Bound (W3C WebAuthn Enclave)';

  const handleConfirmRevoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      const res = await fetch('/api/assets/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'revoke',
          assetId: revokeTarget.assetId,
          targetUserId: revokeTarget.userId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to revoke access');
      setRevokeNotice(`Access successfully revoked for ${revokeTarget.userName}.`);
      setTimeout(() => setRevokeNotice(null), 4000);
      setRevokeTarget(null);
      await fetchAssetsData(true);
    } catch (err: any) {
      alert(err.message || 'Failed to revoke access');
    } finally {
      setRevoking(false);
    }
  };

  const ownedAssetsWithShares = React.useMemo(() => {
    const owned = assets.filter(a => a.isOwner !== false);
    const rows: Array<{
      assetId: string;
      assetCode: string;
      assetName: string;
      classification: string;
      folder: string;
      recipientId: string;
      recipientName: string;
      permissions: string;
      expiresAt: string | null;
    }> = [];

    owned.forEach(asset => {
      if (asset.shares && asset.shares.length > 0) {
        asset.shares.forEach(share => {
          if (share.user_id !== (currentUser?.id || currentSession?.userId)) {
            rows.push({
              assetId: asset.id,
              assetCode: asset.code,
              assetName: asset.name,
              classification: asset.classification,
              folder: asset.folder,
              recipientId: share.user_id,
              recipientName: share.user_name || (share.user_id === 'ALL' ? 'All Organization Members' : share.user_id),
              permissions: share.permissions || 'Read, Decrypt',
              expiresAt: share.expires_at,
            });
          }
        });
      }
    });

    return rows;
  }, [assets, currentUser, currentSession]);

  // Check if any device is suspicious/untrusted
  const untrustedDevices = devices.filter(d => d.riskState && d.riskState !== 'TRUSTED');
  const showUntrustedBanner = untrustedDevices.length > 0;

  // Latest user request for the timeline widget
  const latestRequest = requests.length > 0 ? requests[0] : null;

  return (
    <div className="space-y-6 font-sans pb-16">
      
      {/* 1. Top Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Key className="w-6 h-6 text-blue-400" />
            Access Management
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Understand and control who can access your documents, manage permissions, and review cryptographic access requests.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-slate-300 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-xs font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>
              {currentSession?.assuranceLevel === 'LEVEL_3' 
                ? 'Assurance Level 3 · MetaMask Admin Validated' 
                : 'Assurance Level 2 · Hardware P-256 Key Bound'}
            </span>
          </div>

          <Button
            size="sm"
            onClick={() => handleOpenRequestModal()}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs h-9 px-4 shadow-sm flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Request Access</span>
          </Button>
        </div>
      </div>

      {/* 2. Educational Banner: Authorization ≠ Decryption */}
      <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-950/20 text-xs flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-semibold text-white">
            Authorization ≠ Decryption
          </div>
          <div className="text-slate-300 leading-relaxed font-light">
            Viewing a permission record in the interface confirms identity authorization, but cryptographic decryption is separately enforced by server-side KMS and enclave verification. Revoking access immediately invalidates decryption clearance.
          </div>
        </div>
      </div>

      {/* Revocation Success Notice Banner */}
      {revokeNotice && (
        <div className="bg-emerald-950/40 border border-emerald-500/50 text-emerald-300 px-4 py-3 rounded-xl text-xs font-mono flex items-center gap-2 shadow-sm animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{revokeNotice}</span>
        </div>
      )}

      {/* Untrusted Device Warning Banner */}
      {showUntrustedBanner && (
        <div className="p-4 rounded-xl border border-amber-500/50 bg-[#161208] space-y-2.5 font-mono text-xs animate-in fade-in">
          <div className="flex items-center justify-between text-amber-400 font-bold">
            <span className="text-xs uppercase">Unverified Device Detected</span>
            <span className="text-[10px] text-amber-500 font-normal">
              {untrustedDevices[0]?.deviceName || 'Unknown Device'} · {untrustedDevices[0]?.browser} · {untrustedDevices[0]?.os}
            </span>
          </div>
          <p className="text-[11px] text-zinc-300 font-sans">
            A workstation registered to your account requires risk elevation or re-authentication.
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => handleRevokeDevice(untrustedDevices[0].deviceId)}
              className="bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 font-bold text-xs h-8"
            >
              Revoke Device
            </Button>
          </div>
        </div>
      )}

      {/* 3. Tab Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('permissions')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono font-medium transition-colors ${
            activeTab === 'permissions'
              ? 'bg-blue-600/20 text-blue-300 border border-blue-500/40 font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
          }`}
        >
          <Users className="w-4 h-4 text-blue-400" />
          <span>Document Permissions</span>
          <Badge variant="outline" className="ml-1 px-1.5 py-0 text-[10px] border-slate-700 text-slate-400 bg-slate-900/60 font-mono">
            {ownedAssetsWithShares.length}
          </Badge>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('requests')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono font-medium transition-colors ${
            activeTab === 'requests'
              ? 'bg-blue-600/20 text-blue-300 border border-blue-500/40 font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
          }`}
        >
          <Key className="w-4 h-4 text-blue-400" />
          <span>Access Requests &amp; Active Clearance</span>
          {pendingRequestsCount > 0 && (
            <Badge variant="outline" className="ml-1 px-1.5 py-0 text-[10px] border-amber-500/40 text-amber-300 bg-amber-950/40 font-mono">
              {pendingRequestsCount}
            </Badge>
          )}
        </button>
      </div>

      {/* 4. Tab 1: Document Permissions */}
      {activeTab === 'permissions' && (
        <div className="space-y-5">
          {/* Summary Strip */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-[#0F172A] border border-slate-800">
              <div className="text-xs text-slate-400 font-mono">Owned Documents</div>
              <div className="text-2xl font-bold text-white mt-1">
                {assets.filter(a => a.isOwner !== false).length}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Files in your encrypted compartment</div>
            </div>
            <div className="p-4 rounded-xl bg-[#0F172A] border border-slate-800">
              <div className="text-xs text-slate-400 font-mono">Delegated Access Grants</div>
              <div className="text-2xl font-bold text-blue-400 mt-1">
                {ownedAssetsWithShares.length}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Active recipients with cryptographic keys</div>
            </div>
            <div className="p-4 rounded-xl bg-[#0F172A] border border-slate-800">
              <div className="text-xs text-slate-400 font-mono">Revocation Guarantee</div>
              <div className="text-sm font-semibold text-emerald-400 mt-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>Instant Invalidation</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Keys destroyed across KMS &amp; memory cache</div>
            </div>
          </div>

          {/* Table of active permissions */}
          <div className="rounded-xl border border-slate-800 bg-[#0F172A] overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">Who Can Access Your Documents</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Manage active recipient clearance. Removing access immediately revokes their cryptographic keys.
                </p>
              </div>
            </div>

            {ownedAssetsWithShares.length === 0 ? (
              <div className="p-12 text-center space-y-3 font-mono">
                <Users className="w-10 h-10 text-slate-600 mx-auto" />
                <div className="text-sm text-slate-300">No active recipient grants on your documents.</div>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  When you share documents from My Files, recipients will appear here with granted permissions and one-click revocation.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-[#0B0F19] text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="px-5 py-3.5 font-bold">Document</th>
                      <th className="px-4 py-3.5 font-bold">Classification</th>
                      <th className="px-5 py-3.5 font-bold">Recipient</th>
                      <th className="px-4 py-3.5 font-bold">Permissions</th>
                      <th className="px-4 py-3.5 font-bold">Status</th>
                      <th className="px-5 py-3.5 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {ownedAssetsWithShares.map((row, idx) => (
                      <tr key={`${row.assetId}-${row.recipientId}-${idx}`} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-5 py-4">
                          <div className="font-semibold text-white">{row.assetName}</div>
                          <div className="text-[11px] text-slate-500">{row.assetCode} • {row.folder}</div>
                        </td>
                        <td className="px-4 py-4">
                          <Badge className="border-amber-500/30 text-amber-400 bg-amber-950/20 text-[10px]">
                            {row.classification}
                          </Badge>
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-blue-400" />
                            <span>{row.recipientName}</span>
                          </div>
                          <div className="text-[10px] text-slate-500">{row.recipientId}</div>
                        </td>
                        <td className="px-4 py-4">
                          <span className="px-2 py-0.5 rounded border border-blue-500/30 text-blue-300 bg-blue-950/20 text-[10px]">
                            {row.permissions}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-emerald-500/30 text-emerald-400 bg-emerald-950/20 text-[10px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            Active
                          </span>
                          {row.expiresAt && (
                            <div className="text-[9px] text-slate-500 mt-0.5">
                              Exp: {new Date(row.expiresAt).toLocaleDateString()}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setRevokeTarget({
                              assetId: row.assetId,
                              assetName: row.assetName,
                              userId: row.recipientId,
                              userName: row.recipientName,
                            })}
                            className="border-red-500/40 text-red-400 hover:bg-red-950/30 text-xs font-mono h-7 px-2.5"
                          >
                            <UserX className="w-3 h-3 mr-1" />
                            Remove Access
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. Tab 2: Access Requests & Active Clearance */}
      {activeTab === 'requests' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          
          {/* ================================================= */}
          {/* LEFT 2 COLUMNS: Active Decrypted Viewer & Assets   */}
          {/* ================================================= */}
          <div className="xl:col-span-2 space-y-6">
            
            {/* ACTIVE DECRYPTED CARD (DYNAMIC) */}
            <div className="rounded-xl border border-slate-800 bg-[#0F172A] overflow-hidden shadow-sm space-y-4">
              
              {/* Top Banner */}
              <div className="p-3 sm:p-4 bg-slate-900/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 text-slate-300 text-[11px]">
                  <Eye className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>
                    {activeGrant 
                      ? 'Live decrypted session in memory with verified audit record'
                      : 'Zero-Trust Session Active · Controlled Decryption'}
                  </span>
                </div>
                {activeGrant && (
                  <div className="flex items-center gap-3">
                    <span className="text-blue-400 font-mono font-medium text-xs">
                      {isLocked ? 'LOCKED' : `re-locks in ${formatCountdown(secondsRemaining)}`}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={actionInProgress !== null}
                      onClick={() => isLocked ? handleExtendGrant() : handleLockGrant()}
                      className="border-slate-700 hover:bg-slate-800 text-slate-300 text-[11px] h-6 px-2.5"
                    >
                      {actionInProgress === 'extend' || actionInProgress === 'lock' ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        isLocked ? 'Unlock now' : 'Lock now'
                      )}
                    </Button>
                  </div>
                )}
              </div>

              {/* Asset Metadata Row */}
              {activeGrant ? (
                <div className="px-5 pt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-white">{activeGrant.assetCode}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-blue-950/60 border border-blue-500/40 text-blue-300 font-semibold uppercase">
                        ACTIVE PERMIT
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 font-sans mt-0.5">
                      {activeGrant.assetName || 'Cryptographically Bound Document'}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs">
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase">PURPOSE ON RECORD</div>
                      <div className="text-slate-300 text-[11px]">
                        {activeGrant.note || 'Authorized duty requirement'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase">SESSION IDENTIFIER</div>
                      <div className="text-blue-400 text-[11px] truncate max-w-[140px]">
                        Session #{activeGrant.sessionId}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={actionInProgress !== null}
                      onClick={handleExtendGrant}
                      className="border-slate-700 hover:bg-slate-800 text-[11px] text-slate-300 h-7"
                    >
                      Extend by 15 min
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="px-5 pt-2 pb-1 flex items-center justify-between font-sans text-xs">
                  <div>
                    <div className="font-semibold text-slate-200">No Active Live Grant In Progress</div>
                    <p className="text-slate-400 text-[11px] mt-0.5">
                      Select an authorized document below to decrypt, or submit an access request to obtain an on-chain permit.
                    </p>
                  </div>
                  {clearedAssets.length > 0 && (
                    <Button
                      size="sm"
                      onClick={() => handleOpenDecryptModal(clearedAssets[0])}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs h-7 shadow-sm"
                    >
                      Decrypt {clearedAssets[0].code}
                    </Button>
                  )}
                </div>
              )}

              {/* Decrypted Code Block */}
              <div className="px-5 pb-5">
                {activeGrant ? (
                  isLocked ? (
                    <div className="p-8 rounded-xl bg-slate-900/60 border border-slate-800 text-center text-slate-400 text-xs space-y-2">
                      <Lock className="w-6 h-6 text-slate-400 mx-auto" />
                      <div>Session clearance expired or manually locked.</div>
                      <Button 
                        size="sm" 
                        onClick={handleExtendGrant} 
                        className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs mt-2"
                      >
                        Unlock Clearance
                      </Button>
                    </div>
                  ) : loadingActiveGrantDecrypt ? (
                    <div className="p-8 rounded-xl bg-[#0B0F19] border border-slate-800 text-center font-mono text-xs text-slate-400 flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                      <span>Deriving session AES-256-GCM key and decrypting...</span>
                    </div>
                  ) : activeGrantDecrypted ? (
                    <div className="p-4 rounded-xl bg-[#0B0F19] border border-slate-800 font-mono text-xs text-slate-200 leading-relaxed overflow-x-auto shadow-inner">
                      <div className="text-slate-400 text-[11px] pb-2 mb-2 border-b border-slate-800 flex justify-between items-center">
                        <span>LIVE DECRYPTED VIEW // {activeGrant.assetCode}</span>
                        <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/40 text-[9px]">
                          AES-256-GCM
                        </Badge>
                      </div>
                      <pre className="whitespace-pre-wrap font-mono text-xs text-slate-200">
                        {activeGrantDecrypted}
                      </pre>
                    </div>
                  ) : (
                    <div className="p-6 rounded-xl bg-[#0B0F19] border border-slate-800 font-mono text-xs text-slate-400 space-y-2">
                      <div className="text-slate-300 font-bold">Clearance active for {activeGrant.assetCode}</div>
                      <p className="text-[11px] text-slate-400">
                        Click Decrypt below or select the asset from the list to view its contents.
                      </p>
                    </div>
                  )
                ) : (
                  <div className="p-6 rounded-xl bg-slate-900/40 border border-slate-800 text-xs text-slate-400 flex items-center justify-between font-sans">
                    <div className="flex items-center gap-3">
                      <FolderLock className="w-5 h-5 text-blue-400 shrink-0" />
                      <div>
                        <span className="text-slate-200 font-semibold">Vault Status: </span>
                        <span>{clearedAssets.length} documents cleared for instant decryption · {requestableAssets.length} requestable</span>
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => handleOpenRequestModal()} 
                      className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs h-7"
                    >
                      Request New Clearance
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* MY ASSETS LIST (DYNAMIC) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white tracking-wider uppercase font-mono">
                  My Files
                </h2>
                <span className="text-xs text-slate-400 font-mono">
                  {clearedAssets.length} with clearance · {requestableAssets.length} requestable
                </span>
              </div>

              {loadingAssets && assets.length === 0 ? (
                <div className="p-8 rounded-xl border border-slate-800 bg-[#0F172A] text-center font-mono text-xs text-slate-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                  <span>Loading vault documents...</span>
                </div>
              ) : assets.length === 0 ? (
                <div className="p-8 rounded-xl border border-slate-800 bg-[#0F172A] text-center font-mono text-xs text-slate-400">
                  No documents currently found in the vault ledger.
                </div>
              ) : (
                <div className="space-y-3">
                  {assets.map(asset => {
                    const isPending = pendingAssetIds.includes(asset.id) || 
                      (realtimeData?.pendingRequests && realtimeData.pendingRequests.some((r: any) => r.assetCode === asset.code));
                    
                    return (
                      <div 
                        key={asset.id} 
                        className="p-4 rounded-xl border border-slate-800 bg-[#0F172A] hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1">
                          <div className="font-semibold text-white flex items-center gap-2">
                            <span>{asset.code}</span>
                            <span>·</span>
                            <span>{asset.name}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-2 font-mono">
                            <span className="uppercase text-amber-400 font-semibold">{asset.classification}</span>
                            <span>·</span>
                            <span>{asset.fileType || 'DATA'}</span>
                            <span>·</span>
                            <span>{asset.folder}</span>
                            <span>·</span>
                            <span>Owner: {asset.ownerName}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {asset.canDecrypt || isAdmin ? (
                            <>
                              <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/40 text-[10px] font-mono">
                                {isAdmin ? 'ADMIN' : 'CLEARED'}
                              </Badge>
                              <Button
                                size="sm"
                                onClick={() => handleOpenDecryptModal(asset)}
                                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium h-8 px-3 shadow-sm"
                              >
                                Decrypt
                              </Button>
                            </>
                          ) : isPending ? (
                            <>
                              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px] font-mono animate-pulse">
                                Awaiting Approval
                              </Badge>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenRequestModal(asset)}
                                className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs h-8 px-3"
                              >
                                View Request
                              </Button>
                            </>
                          ) : (
                            <>
                              <span className="text-[10px] text-slate-400 font-mono">restricted</span>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenRequestModal(asset)}
                                className="border-slate-700 hover:bg-slate-800 text-slate-300 text-xs h-8 px-3"
                              >
                                Request Access
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

          {/* ================================================= */}
          {/* RIGHT COLUMN: Widgets                              */}
          {/* ================================================= */}
          <div className="space-y-6 font-mono text-xs">
            
            {/* Widget 1: Request Timeline (DYNAMIC) */}
            <div className="p-5 rounded-2xl border border-zinc-800 bg-[#0a0a0d] space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                  Request Timeline
                </h3>
                {latestRequest && (
                  <span className="text-[10px] text-zinc-500">
                    {latestRequest.asset_code || 'ASSET'}
                  </span>
                )}
              </div>

              {latestRequest ? (
                <div className="space-y-3 relative pl-4 border-l border-zinc-800">
                  {/* Step 1: Submission */}
                  <div className="space-y-0.5 relative">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 absolute -left-[21px] top-1"></span>
                    <div className="font-bold text-zinc-200">Request submitted</div>
                    <div className="text-[10px] text-zinc-500">
                      {new Date(latestRequest.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {latestRequest.reason}
                    </div>
                  </div>

                  {/* Step 2: Policy & Sentinel */}
                  <div className="space-y-0.5 relative">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 absolute -left-[21px] top-1"></span>
                    <div className="font-bold text-zinc-200">Cryptographic Policy Check</div>
                    <div className="text-[10px] text-zinc-500">
                      Evaluated by Sentinel zero-trust policy engine
                    </div>
                  </div>

                  {/* Step 3: Approval / Status */}
                  <div className="space-y-0.5 relative">
                    <span className={`w-2 h-2 rounded-full absolute -left-[21px] top-1 ${
                      latestRequest.status === 'APPROVED' ? 'bg-emerald-400' :
                      latestRequest.status === 'REJECTED' ? 'bg-red-400' : 'bg-amber-400 animate-pulse'
                    }`}></span>
                    <div className="font-bold text-zinc-200">
                      {latestRequest.status === 'APPROVED' ? 'Approved on Chain-1' :
                       latestRequest.status === 'REJECTED' ? 'Request Rejected' : 'Awaiting Admin Approval'}
                    </div>
                    <div className="text-[10px] text-zinc-500">
                      {latestRequest.status === 'APPROVED' ? (
                        <>Permit: {latestRequest.nft_token_id || 'Sepolia NFT'} · {latestRequest.approved_at ? new Date(latestRequest.approved_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Verified'}</>
                      ) : latestRequest.status === 'REJECTED' ? (
                        <>{latestRequest.rejected_reason || 'Rejected by policy administrator'}</>
                      ) : (
                        'Multi-sig clearance in review'
                      )}
                    </div>
                  </div>

                  {/* Step 4: Clearance TTL */}
                  <div className="space-y-0.5 relative">
                    <span className="w-2 h-2 rounded-full border border-zinc-600 bg-[#0a0a0d] absolute -left-[21px] top-1"></span>
                    <div className="font-bold text-zinc-400">Clearance Expiration</div>
                    <div className="text-[10px] text-zinc-500">
                      TTL: {latestRequest.ttl_minutes || 30} min · auto re-lock upon expiry
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-black/40 border border-zinc-800 text-center text-zinc-500 text-[11px]">
                  No recent access requests on record. Requests submitted for restricted assets will appear here in real time.
                </div>
              )}
            </div>

            {/* Widget 2: My Devices (DYNAMIC) */}
            <div className="p-5 rounded-2xl border border-zinc-800 bg-[#0a0a0d] space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                  My devices
                </h3>
                <span className="text-[10px] text-zinc-500">{devices.length} registered</span>
              </div>

              {loadingDevices ? (
                <div className="p-4 text-center text-zinc-500 text-[11px] flex items-center justify-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Loading devices...</span>
                </div>
              ) : devices.length === 0 ? (
                <div className="p-3 rounded-xl border border-zinc-800/80 bg-zinc-900/30 text-center text-zinc-500 text-[11px]">
                  No enrolled hardware devices found.
                </div>
              ) : (
                <div className="space-y-2">
                  {devices.map(device => {
                    const isCurrent = currentSession?.deviceId === device.deviceId || currentSession?.deviceId === device.id;
                    const isSuspended = device.status === 'REVOKED' || device.riskState === 'SUSPENDED';

                    return (
                      <div 
                        key={device.id} 
                        className="p-3 rounded-xl border border-zinc-800/80 bg-zinc-900/30 flex items-center justify-between"
                      >
                        <div className="space-y-0.5 truncate max-w-[170px]">
                          <div className="font-bold text-zinc-200 text-xs truncate">
                            {device.deviceName} · {device.browser} · {device.os}
                          </div>
                          <div className="text-[10px] text-zinc-500">
                            {isCurrent ? 'this device · active session' : 'enrolled workstation'}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {isSuspended ? (
                            <Badge className="bg-red-500/20 text-red-400 border-red-500/40 text-[10px]">
                              suspended
                            </Badge>
                          ) : (
                            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-[10px]">
                              {device.riskState ? device.riskState.toLowerCase() : 'trusted'}
                            </Badge>
                          )}
                          {!isCurrent && !isSuspended && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRevokeDevice(device.deviceId || device.id)}
                              className="border-zinc-800 text-[10px] text-zinc-400 hover:text-red-400 h-6 px-2"
                            >
                              Revoke
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Widget 3: My Identity (DYNAMIC) */}
            <div className="p-5 rounded-2xl border border-zinc-800 bg-[#0a0a0d] space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                My identity
              </h3>

              <div className="space-y-1.5 text-[11px]">
                <div className="text-zinc-400 truncate" title={displayUser.did}>
                  {truncatedDid}
                </div>
                <div className="text-zinc-500 truncate" title={userWalletDisplay}>
                  {userWalletDisplay}
                </div>
                <div className="text-zinc-400">
                  role <strong className="text-zinc-200 uppercase">{displayUser.role}</strong>, anchored Chain-1
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowQrModal(true)}
                  className="border-zinc-800 hover:bg-zinc-800 text-zinc-300 text-[11px] h-7"
                >
                  <QrCode className="w-3 h-3 mr-1" /> Show credential QR
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowGuardiansModal(true)}
                  className="border-zinc-800 hover:bg-zinc-800 text-zinc-300 text-[11px] h-7"
                >
                  <Shield className="w-3 h-3 mr-1" /> Guardians ({personnel.filter(p => p.role === 'ADMIN' || p.role === 'SECURITY_OFFICER').length || 1})
                </Button>
              </div>
            </div>

            {/* Widget 4: Report Suspicious Activity */}
            <div className="p-4 rounded-xl border border-zinc-800/80 bg-black/40 space-y-2">
              <div className="text-zinc-400 text-[11px] font-sans">
                Something look wrong on your account?
              </div>
              <Button
                variant="outline"
                onClick={() => alert('Security Incident reported directly to SOC Team & Sentinel.')}
                className="w-full border-zinc-800 hover:bg-red-950/20 text-zinc-300 hover:text-red-400 text-xs h-8"
              >
                Report suspicious activity
              </Button>
            </div>

          </div>

        </div>
      )}

      {/* 6. Confirmation Modal for Removing Access */}
      {revokeTarget && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0F172A] border border-slate-800 rounded-2xl p-6 text-xs space-y-4 shadow-2xl animate-in zoom-in-95 font-mono">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                Remove Access
              </h3>
              <Button variant="ghost" size="sm" onClick={() => setRevokeTarget(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-3">
              <p className="text-slate-300 text-xs leading-relaxed font-sans">
                Are you sure you want to remove access for <strong className="text-white">{revokeTarget.userName}</strong> to <strong className="text-white">{revokeTarget.assetName}</strong>?
              </p>
              <p className="text-slate-400 text-[11px] leading-relaxed p-3 rounded-lg bg-red-950/20 border border-red-500/30 text-red-300 font-sans">
                This will immediately revoke their cryptographic clearance and prevent further decryption or downloads.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRevokeTarget(null)}
                className="border-slate-800 text-slate-300 hover:bg-slate-800 text-xs font-mono"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={revoking}
                onClick={handleConfirmRevoke}
                className="bg-red-600 hover:bg-red-700 text-white font-medium text-xs font-mono flex items-center gap-1.5"
              >
                {revoking ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                Remove access
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* REQUEST ACCESS MODAL (DYNAMIC)                       */}
      {/* ---------------------------------------------------- */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0F172A] border border-slate-800 rounded-2xl p-6 font-sans text-xs space-y-4 shadow-xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-semibold text-white">Request Access</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowRequestModal(false)} className="text-slate-400 hover:text-white hover:bg-slate-800">
                <X className="w-4 h-4" />
              </Button>
            </div>

            {requestSubmitted ? (
              <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-emerald-300 text-center space-y-1">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
                <div className="font-semibold text-sm">Access Request Submitted</div>
                <div className="text-[11px] text-slate-400 font-sans">
                  Sent to Organization Administrator for identity clearance verification.
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitAccessRequest} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 font-medium">Select File / Asset</label>
                  <select
                    value={requestAssetId}
                    onChange={e => setRequestAssetId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg text-slate-200 text-xs h-9 px-3 focus:outline-none focus:border-blue-500"
                  >
                    {assets.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.code} — {a.name} ({a.classification})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 font-medium">Business Justification</label>
                  <Input 
                    value={requestPurpose} 
                    onChange={e => setRequestPurpose(e.target.value)} 
                    className="bg-slate-900 border-slate-800 text-slate-200 text-xs h-9 focus:border-blue-500"
                    placeholder="Enter business purpose for clearance..."
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 font-medium">Clearance Duration</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[15, 30, 60].map(mins => (
                      <Button
                        key={mins}
                        type="button"
                        variant={requestTtl === mins ? 'default' : 'outline'}
                        onClick={() => setRequestTtl(mins)}
                        className={`text-xs h-8 ${
                          requestTtl === mins 
                            ? 'bg-blue-600 hover:bg-blue-700 text-white font-medium' 
                            : 'border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                        }`}
                      >
                        {mins} Minutes
                      </Button>
                    ))}
                  </div>
                </div>

                <Button 
                  type="submit" 
                  disabled={submittingRequest || !requestAssetId}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs h-9 mt-3 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {submittingRequest ? 'Submitting request...' : 'Submit Request'}
                </Button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* UNIFIED DECRYPTED ASSET MODAL (DYNAMIC)              */}
      {/* ---------------------------------------------------- */}
      {decryptModalAsset && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-[#0F172A] border border-slate-800 rounded-2xl p-6 font-sans text-xs space-y-4 shadow-xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-white">
                  {decryptModalAsset.code} · {decryptModalAsset.name}
                </h3>
                <p className="text-[11px] text-blue-400 font-sans mt-0.5">
                  {decryptModalAsset.classification} · Cryptographic Decryption
                </p>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => { setDecryptModalAsset(null); setDecryptModalData(null); }} 
                className="text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {decryptModalLoading ? (
              <div className="p-8 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                <span>Verifying identity clearance and decrypting payload...</span>
              </div>
            ) : decryptModalError ? (
              <div className="p-4 rounded-xl bg-red-950/30 border border-red-500/30 text-red-300 space-y-2">
                <div className="font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <span>Access Authorization Denied</span>
                </div>
                <p className="text-[11px] font-sans text-slate-300">
                  {decryptModalError}
                </p>
                <Button
                  size="sm"
                  onClick={() => {
                    const a = decryptModalAsset;
                    setDecryptModalAsset(null);
                    handleOpenRequestModal(a);
                  }}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs h-7 mt-2"
                >
                  Request Clearance for {decryptModalAsset.code}
                </Button>
              </div>
            ) : decryptModalData ? (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-500/30 flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-2 text-emerald-400 font-medium">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Cryptographic Clearance Verified</span>
                  </div>
                  <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] font-mono">
                    {decryptModalData.encryptionStandard || 'AES-256-GCM'}
                  </Badge>
                </div>

                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs leading-relaxed max-h-64 overflow-y-auto font-mono whitespace-pre-wrap shadow-inner">
                  {decryptModalData.decryptedData}
                </div>

                <div className="text-[11px] text-slate-400 space-y-0.5 font-sans">
                  <div>Decrypted at: {new Date(decryptModalData.decryptedAt).toLocaleString()}</div>
                  <div>Authorized by: {decryptModalData.authorizedBy || 'SecureMAX KMS'}</div>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(decryptModalData.decryptedData);
                      setCopiedDecrypted(true);
                      setTimeout(() => setCopiedDecrypted(false), 2000);
                    }}
                    className="border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 text-xs h-8"
                  >
                    {copiedDecrypted ? (
                      <><Check className="w-3.5 h-3.5 mr-1 text-emerald-400" /> Copied</>
                    ) : (
                      <><Copy className="w-3.5 h-3.5 mr-1" /> Copy Content</>
                    )}
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={() => { setDecryptModalAsset(null); setDecryptModalData(null); }} 
                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs h-8 px-4"
                  >
                    Close Viewer
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* QR CREDENTIAL MODAL (DYNAMIC)                        */}
      {/* ---------------------------------------------------- */}
      {showQrModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#0F172A] border border-slate-800 rounded-2xl p-6 text-center space-y-4 font-sans text-xs shadow-xl">
            <div className="font-semibold text-white text-sm">Cryptographic Credential</div>
            <div className="p-4 rounded-xl bg-white text-black inline-block mx-auto shadow-md">
              <QrCode className="w-32 h-32" />
            </div>
            <div className="space-y-1">
              <div className="text-white font-semibold text-sm">{displayUser.name}</div>
              <div className="text-[11px] text-blue-400 font-medium">{displayUser.position} · {displayUser.role}</div>
              <div className="text-[10px] text-slate-400 font-mono break-all p-2 rounded-lg bg-slate-900 border border-slate-800 mt-2">
                {displayUser.did}
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(displayUser.did);
                  setCopiedDid(true);
                  setTimeout(() => setCopiedDid(false), 2000);
                }}
                className="border-slate-800 text-slate-300 hover:bg-slate-800 text-xs flex-1 h-8"
              >
                {copiedDid ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                {copiedDid ? 'Copied' : 'Copy DID'}
              </Button>
              <Button 
                size="sm" 
                onClick={() => setShowQrModal(false)} 
                className="bg-slate-800 hover:bg-slate-700 text-white text-xs flex-1 h-8"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* SOCIAL RECOVERY GUARDIANS MODAL (DYNAMIC)            */}
      {/* ---------------------------------------------------- */}
      {showGuardiansModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0F172A] border border-slate-800 rounded-2xl p-6 space-y-4 font-sans text-xs shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-semibold text-white">
                Social Recovery Guardians
              </h3>
              <Button variant="ghost" size="sm" onClick={() => setShowGuardiansModal(false)} className="text-slate-400 hover:text-white hover:bg-slate-800">
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="space-y-2">
              {personnel.filter(p => p.role === 'ADMIN' || p.role === 'SECURITY_OFFICER').length > 0 ? (
                personnel.filter(p => p.role === 'ADMIN' || p.role === 'SECURITY_OFFICER').map((admin, idx) => (
                  <div key={admin.id || idx} className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 flex justify-between items-center">
                    <div>
                      <div className="font-semibold text-slate-200">{admin.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{admin.position || admin.role}</div>
                    </div>
                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]">
                      {admin.status || 'ACTIVE'}
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 flex justify-between items-center">
                  <div>
                    <div className="font-semibold text-slate-200">Organization Security Root</div>
                    <div className="text-[10px] text-slate-400 font-mono">ADMINISTRATOR · SENTINEL</div>
                  </div>
                  <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]">
                    ACTIVE
                  </Badge>
                </div>
              )}
            </div>

            <div className="text-[11px] text-slate-400 font-sans">
              Cryptographic quorum of guardian signatures is required to execute lost device recovery and re-enroll a new workstation.
            </div>

            <div className="flex justify-end pt-2">
              <Button size="sm" onClick={() => setShowGuardiansModal(false)} className="bg-slate-800 hover:bg-slate-700 text-white text-xs h-8">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
