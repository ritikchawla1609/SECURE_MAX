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
  HardDrive
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

  // Check if any device is suspicious/untrusted
  const untrustedDevices = devices.filter(d => d.riskState && d.riskState !== 'TRUSTED');
  const showUntrustedBanner = untrustedDevices.length > 0;

  // Latest user request for the timeline widget
  const latestRequest = requests.length > 0 ? requests[0] : null;

  return (
    <div className="flex min-h-screen bg-[#070709] text-zinc-100 font-sans selection:bg-emerald-500/30">
      
      {/* ---------------------------------------------------- */}
      {/* LEFT SIDEBAR (DYNAMIC)                               */}
      {/* ---------------------------------------------------- */}
      <aside className="w-64 shrink-0 border-r border-zinc-800/80 bg-[#0a0a0d] flex flex-col justify-between hidden lg:flex">
        <div className="p-5 space-y-6">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <Hexagon className="w-6 h-6 text-emerald-400" />
            <span className="text-sm font-bold tracking-widest uppercase text-white">SECUREMAX</span>
          </div>

          {/* Nav Items */}
          <nav className="space-y-1 font-mono text-xs">
            <Link 
              href="/access"
              className="flex items-center justify-between px-3 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 font-semibold border-l-2 border-emerald-400"
            >
              <span>My Access</span>
            </Link>

            <Link 
              href="/assets"
              className="flex items-center justify-between px-3 py-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 transition-colors"
            >
              <span>Asset Registry</span>
            </Link>

            <div 
              className="flex items-center justify-between px-3 py-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 transition-colors cursor-pointer" 
              onClick={() => handleOpenRequestModal()}
            >
              <span>My Requests</span>
              {pendingRequestsCount > 0 && (
                <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded-full border border-amber-500/40 font-bold">
                  {pendingRequestsCount}
                </span>
              )}
            </div>

            <Link 
              href="/devices"
              className="flex items-center justify-between px-3 py-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 transition-colors"
            >
              <span>My Devices</span>
            </Link>

            <Link 
              href="/audit"
              className="flex items-center justify-between px-3 py-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 transition-colors"
            >
              <span>My Activity</span>
            </Link>

            <div 
              className="flex items-center justify-between px-3 py-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 transition-colors cursor-pointer" 
              onClick={() => setShowQrModal(true)}
            >
              <span>My Identity</span>
            </div>
          </nav>
        </div>

        {/* Bottom User Card (DYNAMIC) */}
        <div className="p-4 border-t border-zinc-800/80 bg-black/40 font-mono text-xs space-y-2">
          <div>
            <div className="font-bold text-zinc-200 truncate">{displayUser.name}</div>
            <div className="text-[10px] text-cyan-400 font-bold uppercase truncate">
              {displayUser.position} · {displayUser.role}
            </div>
            <div className="text-[10px] text-zinc-500 truncate mt-0.5" title={displayUser.did}>
              {truncatedDid}
            </div>
          </div>
          <Button 
            size="sm"
            variant="outline"
            onClick={handleLogoutEverywhere}
            className="w-full border-zinc-800 text-[11px] text-zinc-400 hover:text-red-400 hover:bg-red-950/20 h-7"
          >
            <LogOut className="w-3 h-3 mr-1.5" /> Log out everywhere
          </Button>
        </div>
      </aside>

      {/* ---------------------------------------------------- */}
      {/* MAIN VIEWPORT                                        */}
      {/* ---------------------------------------------------- */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 pb-24 lg:pb-8">
        
        {/* Mobile Header (DYNAMIC) */}
        <div className="flex lg:hidden items-center justify-between border-b border-zinc-800/80 pb-3 font-mono text-xs">
          <div className="flex items-center gap-2">
            <Hexagon className="w-5 h-5 text-emerald-400" />
            <span className="font-bold tracking-widest text-white">SECUREMAX</span>
          </div>
          <div className="text-zinc-400 text-[11px] bg-zinc-900/80 px-2 py-0.5 rounded border border-zinc-800 truncate max-w-[140px]">
            {truncatedDid}
          </div>
        </div>

        {/* Top Header Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">My Access</h1>
            <p className="text-xs text-zinc-400 font-sans mt-0.5">
              Assets you currently hold cryptographic clearance for
            </p>
          </div>

          <div className="flex items-center gap-3 font-mono text-xs">
            <div className="flex items-center gap-1.5 text-zinc-300 bg-zinc-900/60 border border-zinc-800 px-3 py-1.5 rounded-lg text-[11px]">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>
                {currentSession?.assuranceLevel === 'LEVEL_3' 
                  ? 'Assurance Level 3 · MetaMask Admin Validated' 
                  : 'Assurance Level 2 · Hardware P-256 Key Bound'}
              </span>
            </div>

            <Button
              size="sm"
              onClick={() => handleOpenRequestModal()}
              className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs h-8 px-4"
            >
              Request access
            </Button>
          </div>
        </div>

        {/* ---------------------------------------------------- */}
        {/* NOTICE: UNTRUSTED / NEW DEVICE DETECTED (DYNAMIC)    */}
        {/* ---------------------------------------------------- */}
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
                Revoke this device
              </Button>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* TWO-COLUMN LAYOUT                                    */}
        {/* ---------------------------------------------------- */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          
          {/* ================================================= */}
          {/* LEFT 2 COLUMNS: Active Decrypted Viewer & Assets   */}
          {/* ================================================= */}
          <div className="xl:col-span-2 space-y-6">
            
            {/* ACTIVE DECRYPTED CARD (DYNAMIC) */}
            <div className="rounded-2xl border border-emerald-500/40 bg-[#0a0a0d] overflow-hidden shadow-2xl space-y-4">
              
              {/* Top Banner */}
              <div className="p-3 sm:p-4 bg-emerald-950/20 border-b border-emerald-500/20 flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
                <div className="flex items-center gap-2 text-zinc-300 text-[11px]">
                  <Eye className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    {activeGrant 
                      ? 'This live view is decrypted in memory and verified against the audit ledger'
                      : 'Zero-Trust Session Active · Controlled Decryption Engine'}
                  </span>
                </div>
                {activeGrant && (
                  <div className="flex items-center gap-3">
                    <span className="text-emerald-400 font-bold text-xs">
                      {isLocked ? 'LOCKED' : `re-locks in ${formatCountdown(secondsRemaining)}`}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={actionInProgress !== null}
                      onClick={() => isLocked ? handleExtendGrant() : handleLockGrant()}
                      className="border-zinc-700 hover:bg-zinc-800 text-zinc-300 text-[11px] h-6 px-2.5"
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
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 font-bold uppercase">
                        ACTIVE PERMIT
                      </span>
                    </div>
                    <div className="text-xs text-zinc-400 font-sans mt-0.5">
                      {activeGrant.assetName || 'Cryptographically Bound Document'}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs">
                    <div>
                      <div className="text-[10px] text-zinc-500 uppercase">PURPOSE ON RECORD</div>
                      <div className="text-zinc-300 text-[11px]">
                        {activeGrant.note || 'Authorized duty requirement'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-zinc-500 uppercase">SESSION IDENTIFIER</div>
                      <div className="text-emerald-400 text-[11px] truncate max-w-[140px]">
                        Session #{activeGrant.sessionId}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={actionInProgress !== null}
                      onClick={handleExtendGrant}
                      className="border-zinc-800 hover:bg-zinc-800 text-[11px] text-zinc-300 h-7"
                    >
                      Extend by 15 min
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="px-5 pt-2 pb-1 flex items-center justify-between font-mono text-xs">
                  <div>
                    <div className="font-bold text-zinc-200">No Active Live Grant In Progress</div>
                    <p className="text-zinc-400 text-[11px] font-sans mt-0.5">
                      Select an authorized asset below to decrypt, or submit an access request to obtain an on-chain permit.
                    </p>
                  </div>
                  {clearedAssets.length > 0 && (
                    <Button
                      size="sm"
                      onClick={() => handleOpenDecryptModal(clearedAssets[0])}
                      className="bg-emerald-600 hover:bg-emerald-500 text-black font-bold text-xs h-7"
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
                    <div className="p-8 rounded-xl bg-black/60 border border-zinc-800 text-center text-zinc-500 font-mono text-xs space-y-2">
                      <Lock className="w-6 h-6 text-zinc-500 mx-auto" />
                      <div>Session clearance expired or manually locked.</div>
                      <Button 
                        size="sm" 
                        onClick={handleExtendGrant} 
                        className="bg-emerald-600 hover:bg-emerald-500 text-black font-bold text-xs mt-2"
                      >
                        Unlock clearance
                      </Button>
                    </div>
                  ) : loadingActiveGrantDecrypt ? (
                    <div className="p-8 rounded-xl bg-black border border-zinc-800 text-center font-mono text-xs text-zinc-400 flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                      <span>Deriving session AES-256-GCM key and decrypting...</span>
                    </div>
                  ) : activeGrantDecrypted ? (
                    <div className="p-4 rounded-xl bg-black border border-zinc-800 font-mono text-xs text-emerald-300/90 leading-relaxed overflow-x-auto shadow-inner">
                      <div className="text-zinc-400 text-[11px] pb-2 mb-2 border-b border-zinc-800 flex justify-between items-center">
                        <span>LIVE DECRYPTED VIEW // {activeGrant.assetCode}</span>
                        <Badge className="bg-emerald-500/20 text-emerald-400 text-[9px]">
                          AES-256-GCM
                        </Badge>
                      </div>
                      <pre className="whitespace-pre-wrap font-mono text-xs text-emerald-200">
                        {activeGrantDecrypted}
                      </pre>
                    </div>
                  ) : (
                    <div className="p-6 rounded-xl bg-black border border-zinc-800 font-mono text-xs text-zinc-400 space-y-2">
                      <div className="text-zinc-300 font-bold">Clearance active for {activeGrant.assetCode}</div>
                      <p className="text-[11px] text-zinc-500">
                        Click Decrypt below or select the asset from the list to view its contents.
                      </p>
                    </div>
                  )
                ) : (
                  <div className="p-6 rounded-xl bg-black/40 border border-zinc-800/80 font-mono text-xs text-zinc-400 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FolderLock className="w-5 h-5 text-emerald-400 shrink-0" />
                      <div>
                        <span className="text-zinc-200 font-bold">Vault Status: </span>
                        <span>{clearedAssets.length} assets cleared for instant decryption · {requestableAssets.length} requestable</span>
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => handleOpenRequestModal()} 
                      className="border-zinc-700 text-zinc-300 text-xs h-7"
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
                <h2 className="text-sm font-bold text-white tracking-wider uppercase font-mono">
                  My assets
                </h2>
                <span className="text-xs text-zinc-400 font-mono">
                  {clearedAssets.length} with clearance · {requestableAssets.length} you could request
                </span>
              </div>

              {loadingAssets && assets.length === 0 ? (
                <div className="p-8 rounded-xl border border-zinc-800 bg-[#0a0a0d] text-center font-mono text-xs text-zinc-500 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                  <span>Loading vault assets...</span>
                </div>
              ) : assets.length === 0 ? (
                <div className="p-8 rounded-xl border border-zinc-800 bg-[#0a0a0d] text-center font-mono text-xs text-zinc-500">
                  No assets currently found in the vault ledger.
                </div>
              ) : (
                <div className="space-y-3">
                  {assets.map(asset => {
                    const isPending = pendingAssetIds.includes(asset.id) || 
                      (realtimeData?.pendingRequests && realtimeData.pendingRequests.some((r: any) => r.assetCode === asset.code));
                    
                    return (
                      <div 
                        key={asset.id} 
                        className="p-4 rounded-xl border border-zinc-800 bg-[#0a0a0d] hover:border-zinc-700/80 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono text-xs"
                      >
                        <div className="space-y-1">
                          <div className="font-bold text-zinc-100 flex items-center gap-2">
                            <span>{asset.code}</span>
                            <span>·</span>
                            <span className="text-zinc-300">{asset.name}</span>
                          </div>
                          <div className="text-[11px] text-zinc-500 flex items-center gap-2">
                            <span className="uppercase text-amber-400/90 font-bold">{asset.classification}</span>
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
                              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px]">
                                {isAdmin ? 'admin' : 'cleared'}
                              </Badge>
                              <Button
                                size="sm"
                                onClick={() => handleOpenDecryptModal(asset)}
                                className="bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40 text-xs font-bold h-8 px-3"
                              >
                                Decrypt
                              </Button>
                            </>
                          ) : isPending ? (
                            <>
                              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px] animate-pulse">
                                Awaiting Approval
                              </Badge>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenRequestModal(asset)}
                                className="border-zinc-800 text-zinc-400 text-xs h-8 px-3"
                              >
                                View Request
                              </Button>
                            </>
                          ) : (
                            <>
                              <span className="text-[10px] text-zinc-500 font-mono">restricted</span>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenRequestModal(asset)}
                                className="border-zinc-800 hover:bg-zinc-800 text-zinc-300 text-xs h-8 px-3"
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
                  Request timeline
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

      </main>

      {/* ---------------------------------------------------- */}
      {/* MOBILE STICKY BOTTOM NAV                             */}
      {/* ---------------------------------------------------- */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 h-14 bg-[#0a0a0d] border-t border-zinc-800 px-6 flex items-center justify-around font-mono text-xs z-40">
        <Link href="/access" className="flex flex-col items-center gap-1 text-emerald-400 font-bold">
          <Key className="w-4 h-4" />
          <span className="text-[10px]">Access</span>
        </Link>
        <button onClick={() => handleOpenRequestModal()} className="flex flex-col items-center gap-1 text-zinc-400 hover:text-zinc-200">
          <Send className="w-4 h-4" />
          <span className="text-[10px]">Requests</span>
        </button>
        <Link href="/audit" className="flex flex-col items-center gap-1 text-zinc-400 hover:text-zinc-200">
          <Activity className="w-4 h-4" />
          <span className="text-[10px]">Activity</span>
        </Link>
        <button onClick={() => setShowQrModal(true)} className="flex flex-col items-center gap-1 text-zinc-400 hover:text-zinc-200">
          <QrCode className="w-4 h-4" />
          <span className="text-[10px]">Identity</span>
        </button>
      </div>

      {/* ---------------------------------------------------- */}
      {/* REQUEST ACCESS MODAL (DYNAMIC)                       */}
      {/* ---------------------------------------------------- */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0a0a0d] border border-zinc-800 rounded-2xl p-6 font-mono text-xs space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-white uppercase">Request access</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowRequestModal(false)} className="text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </Button>
            </div>

            {requestSubmitted ? (
              <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-center space-y-1">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
                <div className="font-bold">Access Request Submitted!</div>
                <div className="text-[10px] text-zinc-400 font-sans">
                  Sent to Organization Administrator for on-chain NFT clearance permit.
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitAccessRequest} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-400 uppercase">Select Asset</label>
                  <select
                    value={requestAssetId}
                    onChange={e => setRequestAssetId(e.target.value)}
                    className="w-full bg-black/60 border border-zinc-800 rounded-md text-zinc-200 text-xs font-mono h-9 px-3 focus:outline-none focus:border-emerald-500"
                  >
                    {assets.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.code} — {a.name} ({a.classification})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-400 uppercase">Purpose (recorded on audit chain)</label>
                  <Input 
                    value={requestPurpose} 
                    onChange={e => setRequestPurpose(e.target.value)} 
                    className="bg-black/60 border-zinc-800 text-zinc-200 text-xs font-mono h-9"
                    placeholder="Enter business justification..."
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-400 uppercase">Requested Duration (TTL)</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[15, 30, 60].map(mins => (
                      <Button
                        key={mins}
                        type="button"
                        variant={requestTtl === mins ? 'default' : 'outline'}
                        onClick={() => setRequestTtl(mins)}
                        className={`text-xs h-8 ${
                          requestTtl === mins 
                            ? 'bg-emerald-600 text-black font-bold' 
                            : 'border-zinc-800 text-zinc-400'
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
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs h-9 mt-3"
                >
                  {submittingRequest ? 'Submitting to Blockchain...' : 'Submit request'}
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
          <div className="w-full max-w-xl bg-[#0a0a0d] border border-emerald-500/40 rounded-2xl p-6 font-mono text-xs space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white uppercase">
                  {decryptModalAsset.code} · {decryptModalAsset.name}
                </h3>
                <p className="text-[10px] text-emerald-400 font-sans">
                  {decryptModalAsset.classification} · In-Memory AES-256-GCM Decryption
                </p>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => { setDecryptModalAsset(null); setDecryptModalData(null); }} 
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {decryptModalLoading ? (
              <div className="p-8 text-center text-zinc-400 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
                <span>Authorizing access against blockchain IdentityRegistry and decrypting...</span>
              </div>
            ) : decryptModalError ? (
              <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 space-y-2">
                <div className="font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <span>Access Authorization Denied</span>
                </div>
                <p className="text-[11px] font-sans text-zinc-300">
                  {decryptModalError}
                </p>
                <Button
                  size="sm"
                  onClick={() => {
                    const a = decryptModalAsset;
                    setDecryptModalAsset(null);
                    handleOpenRequestModal(a);
                  }}
                  className="bg-amber-600 hover:bg-amber-500 text-black font-bold text-xs h-7 mt-2"
                >
                  Request Clearance for {decryptModalAsset.code}
                </Button>
              </div>
            ) : decryptModalData ? (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-500/30 flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>CRYPTOGRAPHIC CLEARANCE VERIFIED</span>
                  </div>
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[9px]">
                    {decryptModalData.encryptionStandard || 'AES-256-GCM'}
                  </Badge>
                </div>

                <div className="p-4 rounded-xl bg-black border border-zinc-800 text-zinc-200 text-xs leading-relaxed max-h-64 overflow-y-auto font-mono whitespace-pre-wrap shadow-inner">
                  {decryptModalData.decryptedData}
                </div>

                <div className="text-[10px] text-zinc-500 space-y-0.5">
                  <div>Decrypted At: {new Date(decryptModalData.decryptedAt).toLocaleString()}</div>
                  <div>Authorized By: {decryptModalData.authorizedBy || 'SecureMAX KMS'}</div>
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
                    className="border-zinc-800 text-zinc-300 hover:text-white text-xs h-7"
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
                    className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs h-7 px-4"
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
          <div className="w-full max-w-sm bg-[#0a0a0d] border border-zinc-800 rounded-2xl p-6 text-center space-y-4 font-mono text-xs shadow-2xl">
            <div className="font-bold text-white uppercase">Cryptographic Credential</div>
            <div className="p-6 rounded-xl bg-white text-black inline-block mx-auto shadow-lg">
              <QrCode className="w-32 h-32" />
            </div>
            <div className="space-y-1">
              <div className="text-zinc-200 font-bold">{displayUser.name}</div>
              <div className="text-[10px] text-cyan-400 uppercase">{displayUser.position} · {displayUser.role}</div>
              <div className="text-[10px] text-zinc-400 break-all p-2 rounded bg-black border border-zinc-800 mt-2">
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
                className="border-zinc-800 text-zinc-300 text-xs flex-1"
              >
                {copiedDid ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                {copiedDid ? 'Copied' : 'Copy DID'}
              </Button>
              <Button 
                size="sm" 
                onClick={() => setShowQrModal(false)} 
                className="bg-zinc-800 text-zinc-200 text-xs flex-1"
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
          <div className="w-full max-w-md bg-[#0a0a0d] border border-zinc-800 rounded-2xl p-6 space-y-4 font-mono text-xs shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-white uppercase">
                Social Recovery Guardians
              </h3>
              <Button variant="ghost" size="sm" onClick={() => setShowGuardiansModal(false)} className="text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="space-y-2">
              {personnel.filter(p => p.role === 'ADMIN' || p.role === 'SECURITY_OFFICER').length > 0 ? (
                personnel.filter(p => p.role === 'ADMIN' || p.role === 'SECURITY_OFFICER').map((admin, idx) => (
                  <div key={admin.id || idx} className="p-3 rounded-lg bg-black border border-zinc-800 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-zinc-200">{admin.name}</div>
                      <div className="text-[10px] text-zinc-500">{admin.position || admin.role}</div>
                    </div>
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-[10px]">
                      {admin.status || 'ACTIVE'}
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="p-3 rounded-lg bg-black border border-zinc-800 flex justify-between items-center">
                  <div>
                    <div className="font-bold text-zinc-200">Organization Security Root</div>
                    <div className="text-[10px] text-zinc-500">ADMINISTRATOR · SENTINEL</div>
                  </div>
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-[10px]">
                    ACTIVE
                  </Badge>
                </div>
              )}
            </div>

            <div className="text-[10px] text-zinc-500 font-sans">
              Cryptographic quorum of guardian signatures is required to execute lost device recovery and re-enroll a new workstation.
            </div>

            <div className="flex justify-end pt-2">
              <Button size="sm" onClick={() => setShowGuardiansModal(false)} className="bg-zinc-800 text-zinc-200 text-xs">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
