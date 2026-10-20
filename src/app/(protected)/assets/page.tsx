'use client';

import * as React from 'react';
import { 
  HardDrive, 
  Lock, 
  Unlock, 
  FileText, 
  Search, 
  ShieldCheck, 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Key, 
  AlertTriangle,
  FileCode,
  Sparkles,
  Clock,
  Share2,
  Eye,
  MoreVertical,
  LayoutGrid,
  List,
  Download,
  Folder,
  Globe,
  Users,
  User,
  Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { submitAccessRequestAction } from '@/app/actions/accessRequests';
import { VaultOverviewCard } from '@/components/vault/VaultOverviewCard';
import { VaultFolderNavigation } from '@/components/vault/VaultFolderNavigation';
import { VaultUploadModal } from '@/components/vault/VaultUploadModal';
import { VaultShareModal } from '@/components/vault/VaultShareModal';
import { VaultAssetDetailsDrawer } from '@/components/vault/VaultAssetDetailsDrawer';
import { VaultSecurePreviewModal } from '@/components/vault/VaultSecurePreviewModal';
import { useRealtimeSync } from '@/lib/hooks/useRealtimeSync';

export interface AssetRecord {
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
  expiresAt: string | null;
  sharedBy?: string;
  folder: string;
  fileType: string;
  mimeType: string;
  fileSizeBytes: number;
  ownerId?: string;
  ownerName: string;
  createdAt: string;
  lastAccessedAt?: string;
  keyVersion: string;
  versions: Array<{
    version: string;
    uploaded_by: string;
    created_at: string;
    size: string;
    notes?: string;
  }>;
  accessHistory: Array<{
    id: string;
    action: string;
    user_name: string;
    timestamp: string;
    status: 'SUCCESS' | 'DENIED' | 'PENDING';
    details?: string;
  }>;
  blockchainTokenId: string;
  blockchainContract: string;
  did: string;
  isOwner?: boolean;
  sharingScope?: 'PRIVATE' | 'SPECIFIC_USERS' | 'ALL_PEOPLE';
  assignedUsersCount?: number;
  shares?: any[];
}

export default function AssetsPage() {
  const [assets, setAssets] = React.useState<AssetRecord[]>([]);
  const [users, setUsers] = React.useState<Array<{ id: string; name: string; email: string; role: string }>>([]);
  const [storage, setStorage] = React.useState<{ usedBytes: number; maxBytes: number }>({
    usedBytes: 0,
    maxBytes: 524288000,
  });
  const [currentUserId, setCurrentUserId] = React.useState<string>('');
  const [userRole, setUserRole] = React.useState<string>('USER');
  const [userName, setUserName] = React.useState<string>('');
  const [vaultScope, setVaultScope] = React.useState<'MY_DATA' | 'ALL_DATA'>('MY_DATA');
  const [defaultAccessPolicy, setDefaultAccessPolicy] = React.useState<'PRIVATE' | 'ORGANIZATION'>('PRIVATE');
  const [loading, setLoading] = React.useState(true);
  
  // Navigation & Filtering
  const [activeFolder, setActiveFolder] = React.useState<string>('ALL');
  const [activeFilter, setActiveFilter] = React.useState<'ALL' | 'AUTHORIZED' | 'PENDING' | 'RESTRICTED'>('ALL');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [viewMode, setViewMode] = React.useState<'table' | 'grid'>('table');
  const [requestedAssetIds, setRequestedAssetIds] = React.useState<string[]>([]);
  const [serverPendingAssetIds, setServerPendingAssetIds] = React.useState<string[]>([]);
  const [serverRejectedAssetIds, setServerRejectedAssetIds] = React.useState<string[]>([]);
  const [requestNotice, setRequestNotice] = React.useState<string | null>(null);

  // Modal / Drawer States
  const [isUploadModalOpen, setIsUploadModalOpen] = React.useState(false);
  const [shareModalAsset, setShareModalAsset] = React.useState<{ id: string; name: string } | null>(null);
  const [detailsAsset, setDetailsAsset] = React.useState<AssetRecord | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = React.useState(false);
  const hasLoadedOnceRef = React.useRef(false);

  // Decryption Preview State
  const [previewState, setPreviewState] = React.useState<{
    isOpen: boolean;
    loading: boolean;
    error: string | null;
    result: any | null;
    canDownload: boolean;
  }>({
    isOpen: false,
    loading: false,
    error: null,
    result: null,
    canDownload: true,
  });

  const fetchAssets = React.useCallback(async (isBackground = false) => {
    try {
      if (!isBackground && !hasLoadedOnceRef.current) {
        setLoading(true);
      }
      const res = await fetch(`/api/assets/list?scope=${vaultScope}`);
      const data = await res.json();
      if (data.success) {
        setAssets(prev => (JSON.stringify(prev) === JSON.stringify(data.assets) ? prev : (data.assets || [])));
        setUserRole(prev => (prev === (data.role || 'USER') ? prev : (data.role || 'USER')));
        if (data.userId) setCurrentUserId(prev => (prev === data.userId ? prev : data.userId));
        if (data.userName) setUserName(prev => (prev === data.userName ? prev : data.userName));
        if (data.storage) setStorage(prev => (JSON.stringify(prev) === JSON.stringify(data.storage) ? prev : data.storage));
        if (data.users) setUsers(prev => (JSON.stringify(prev) === JSON.stringify(data.users) ? prev : data.users));
        if (data.defaultAccessPolicy) setDefaultAccessPolicy(prev => (prev === data.defaultAccessPolicy ? prev : data.defaultAccessPolicy));
        if (Array.isArray(data.pendingAssetIds)) setServerPendingAssetIds(prev => (JSON.stringify(prev) === JSON.stringify(data.pendingAssetIds) ? prev : data.pendingAssetIds));
        if (Array.isArray(data.rejectedAssetIds)) setServerRejectedAssetIds(prev => (JSON.stringify(prev) === JSON.stringify(data.rejectedAssetIds) ? prev : data.rejectedAssetIds));
      }
    } catch (err) {
      console.error('Failed to load assets:', err);
    } finally {
      hasLoadedOnceRef.current = true;
      setLoading(false);
    }
  }, [vaultScope]);

  React.useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  // Real-time SSE (<100ms) + 2.5s polling fallback
  useRealtimeSync(() => fetchAssets(true), 2500);

  const handleToggleDefaultPolicy = async () => {
    const newPolicy = defaultAccessPolicy === 'PRIVATE' ? 'ORGANIZATION' : 'PRIVATE';
    try {
      const res = await fetch('/api/assets/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_default_policy',
          policy: newPolicy,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDefaultAccessPolicy(newPolicy);
    } catch (err: any) {
      alert(err.message || 'Failed to update default access policy');
    }
  };

  // Decrypt Action
  const handleDecryptAsset = async (asset: AssetRecord) => {
    if (userRole !== 'ADMIN' && !asset.canDecrypt) {
      setRequestNotice(`Access Denied: You must request access from an administrator and receive approval before opening or downloading ${asset.name}.`);
      return;
    }

    const isDownloadAllowed = userRole === 'ADMIN' ? true : Boolean(asset.canDownload && asset.canDecrypt);

    setPreviewState({
      isOpen: true,
      loading: true,
      error: null,
      result: null,
      canDownload: isDownloadAllowed,
    });

    try {
      const res = await fetch('/api/assets/decrypt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId: asset.id }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Decryption authorization rejected');
      }

      setPreviewState({
        isOpen: true,
        loading: false,
        error: null,
        result: data,
        canDownload: isDownloadAllowed,
      });

      // Refresh list to update access logs in the background without blinking
      fetchAssets(true);
    } catch (err: any) {
      setPreviewState({
        isOpen: true,
        loading: false,
        error: err.message || 'Decryption Failed',
        result: null,
        canDownload: false,
      });
    }
  };

  // Admin Toggle Revoke / Grant
  const handleAdminToggleRevoke = async (assetId: string, currentCanDecrypt: boolean) => {
    const action = currentCanDecrypt ? 'revoke' : 'assign';
    try {
      const res = await fetch('/api/assets/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          assetId,
          targetUserId: currentUserId,
          canRead: true,
          canDecrypt: !currentCanDecrypt,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await fetchAssets();
    } catch (err: any) {
      alert(err.message || 'Failed to update assignment');
    }
  };

  // Request NFT Access
  const handleRequestNftAccess = async (assetId: string) => {
    setRequestNotice('Submitting access request for Admin NFT approval...');
    try {
      const res = await submitAccessRequestAction({
        assetId,
        requestType: 'HIGH_RISK_DATA',
        reason: 'Zero-Trust tactical mission review',
      });
      if (res.success) {
        setRequestedAssetIds(prev => [...prev, assetId]);
        setRequestNotice('Request submitted! Awaiting Administrator NFT permit approval.');
        setTimeout(() => setRequestNotice(null), 4000);
        fetchAssets();
      } else {
        alert(res.error || 'Failed to submit request');
        setRequestNotice(null);
      }
    } catch (err: any) {
      alert(err.message || 'Request failed');
      setRequestNotice(null);
    }
  };

  // Asset Actions (Rename, Move, Delete)
  const handleRename = async (assetId: string, currentName: string) => {
    const newName = prompt('Enter new asset name:', currentName);
    if (!newName || newName.trim() === currentName) return;

    try {
      const res = await fetch('/api/assets/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rename', assetId, newName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await fetchAssets();
      setIsDetailsOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to rename asset');
    }
  };

  const handleMove = async (assetId: string, currentFolder: string) => {
    const validFolders = ['Projects', 'Finance', 'HR', 'Engineering', 'Legal'];
    const newFolder = prompt(`Enter destination folder (${validFolders.join(', ')}):`, currentFolder);
    if (!newFolder || !validFolders.includes(newFolder) || newFolder === currentFolder) return;

    try {
      const res = await fetch('/api/assets/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'move', assetId, newFolder }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await fetchAssets();
      setIsDetailsOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to move asset');
    }
  };

  const handleDelete = async (assetId: string) => {
    if (!confirm('Are you sure you want to permanently delete this encrypted asset from the vault? This cannot be undone.')) {
      return;
    }

    try {
      const res = await fetch('/api/assets/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', assetId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await fetchAssets();
      setIsDetailsOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to delete asset');
    }
  };

  // Folder Counts Calculation
  const folderCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    assets.forEach(a => {
      counts[a.folder] = (counts[a.folder] || 0) + 1;
    });
    return counts;
  }, [assets]);

  // Filtered Assets
  const filteredAssets = React.useMemo(() => {
    return assets.filter((asset) => {
      // 1. Folder match
      if (activeFolder !== 'ALL' && asset.folder !== activeFolder) {
        return false;
      }

      // 2. Status / Access filter
      const isPending = serverPendingAssetIds.includes(asset.id) || requestedAssetIds.includes(asset.id) || asset.accessHistory?.some(h => h.status === 'PENDING');
      if (activeFilter === 'AUTHORIZED' && !asset.canDecrypt) return false;
      if (activeFilter === 'PENDING' && !isPending) return false;
      if (activeFilter === 'RESTRICTED' && (asset.canDecrypt || isPending)) return false;

      // 3. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = asset.name.toLowerCase().includes(q);
        const matchCode = asset.code.toLowerCase().includes(q);
        const matchFolder = asset.folder.toLowerCase().includes(q);
        const matchClass = asset.classification.toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchFolder && !matchClass) {
          return false;
        }
      }

      return true;
    });
  }, [assets, activeFolder, activeFilter, searchQuery, requestedAssetIds, serverPendingAssetIds]);

  // Overview Counts
  const totalAssetsCount = assets.length;
  const authorizedCount = assets.filter(a => a.canDecrypt).length;
  const pendingCount = assets.filter(a => serverPendingAssetIds.includes(a.id) || requestedAssetIds.includes(a.id) || a.accessHistory?.some(h => h.status === 'PENDING')).length;
  const restrictedCount = assets.filter(a => !a.canDecrypt && !serverPendingAssetIds.includes(a.id) && !requestedAssetIds.includes(a.id)).length;

  // Flattened Recent Activity
  const recentActivityList = React.useMemo(() => {
    const allLogs: Array<{
      id: string;
      assetName: string;
      action: string;
      timeAgo: string;
      status: 'SUCCESS' | 'DENIED' | 'PENDING';
      timestamp: number;
    }> = [];

    assets.forEach(a => {
      if (a.accessHistory) {
        a.accessHistory.forEach(h => {
          const timeMs = new Date(h.timestamp).getTime();
          const diffMins = Math.max(1, Math.round((Date.now() - timeMs) / (60 * 1000)));
          let timeAgo = `${diffMins} min ago`;
          if (diffMins > 60) {
            timeAgo = `${Math.round(diffMins / 60)} hr ago`;
          }
          allLogs.push({
            id: h.id,
            assetName: a.name,
            action: h.action,
            timeAgo,
            status: h.status,
            timestamp: timeMs,
          });
        });
      }
    });

    return allLogs.sort((a, b) => b.timestamp - a.timestamp);
  }, [assets]);

  const isAdmin = userRole === 'ADMIN';

  return (
    <div className="space-y-6 font-sans selection:bg-cyan-500/30 pb-16">
      
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-100 uppercase flex items-center gap-3">
            <HardDrive className="h-7 w-7 text-cyan-400" />
            My Secure Data Vault
          </h2>
          <p className="text-xs text-zinc-500 font-mono tracking-widest mt-1 uppercase">
            Cryptographically Enforced Access • AES-256-GCM • Server-Side KMS • Controlled Decryption
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Admin Scope Switcher */}
          {isAdmin && (
            <div className="flex items-center bg-zinc-900/80 border border-zinc-800 rounded-lg p-1">
              <button
                onClick={() => setVaultScope('MY_DATA')}
                className={`px-2.5 py-1 text-xs font-mono rounded transition-colors ${
                  vaultScope === 'MY_DATA'
                    ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                My Vault
              </button>
              <button
                onClick={() => setVaultScope('ALL_DATA')}
                className={`px-2.5 py-1 text-xs font-mono rounded transition-colors ${
                  vaultScope === 'ALL_DATA'
                    ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                All Data (Org-Wide)
              </button>
            </div>
          )}

          {/* Default Upload Access Policy Toggle */}
          <button
            onClick={handleToggleDefaultPolicy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 hover:border-cyan-500/30 text-xs font-mono transition-colors text-zinc-300"
            title="Click to toggle your default access policy for new uploads"
          >
            <Settings className="w-3.5 h-3.5 text-zinc-400" />
            <span className="text-zinc-500">Default Upload:</span>
            {defaultAccessPolicy === 'PRIVATE' ? (
              <span className="text-cyan-400 font-semibold flex items-center gap-1">
                <Lock className="w-3 h-3" /> Private to Me
              </span>
            ) : (
              <span className="text-cyan-400 font-semibold flex items-center gap-1">
                <Globe className="w-3 h-3" /> All People
              </span>
            )}
          </button>

          <Badge variant="outline" className="border-cyan-500/30 text-cyan-400 font-mono text-xs px-3 py-1 uppercase">
            {isAdmin && vaultScope === 'ALL_DATA' ? 'ADMINISTRATIVE OVERVIEW' : `COMPARTMENT: ${userName}`}
          </Badge>
        </div>
      </div>

      {/* 2. Overview Card (4-stat strip, storage progress bar, recent activity) */}
      <VaultOverviewCard
        totalAssets={totalAssetsCount}
        authorizedCount={authorizedCount}
        pendingCount={pendingCount}
        restrictedCount={restrictedCount}
        storageUsedBytes={storage.usedBytes}
        storageMaxBytes={storage.maxBytes}
        recentActivity={recentActivityList}
        activeDeviceName="Field Workstation (ECDSA P-256 Bound)"
      />

      {/* 3. Folder Navigation & Status Filter Strip */}
      <VaultFolderNavigation
        folderCounts={folderCounts}
        totalCount={totalAssetsCount}
        activeFolder={activeFolder}
        onSelectFolder={setActiveFolder}
        activeFilter={activeFilter}
        onSelectFilter={setActiveFilter}
        onOpenUpload={() => setIsUploadModalOpen(true)}
      />

      {/* 4. Search and Layout Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
          <Input
            type="search"
            placeholder="Search by file name, code, folder, or classification..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-[#0a0a0c] border-zinc-800 font-mono text-xs text-zinc-200"
          />
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-zinc-900/60 border border-zinc-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'table' ? 'bg-cyan-500/20 text-cyan-300' : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title="Table View"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'grid' ? 'bg-cyan-500/20 text-cyan-300' : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 5. Request Notice Banner */}
      {requestNotice && (
        <div className="bg-amber-950/40 border border-amber-500/50 text-amber-300 px-4 py-3 rounded-xl text-xs font-mono flex items-center gap-2 shadow-lg animate-in fade-in slide-in-from-top-2">
          <Clock className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
          <span>{requestNotice}</span>
        </div>
      )}

      {/* 6. Assets Display: Table or Grid */}
      {loading && assets.length === 0 ? (
        <div className="p-16 rounded-2xl border border-zinc-800 bg-[#0a0a0c] text-center font-mono text-xs text-zinc-500 flex items-center justify-center gap-2 max-w-2xl mx-auto my-8">
          <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
          <span>Loading encrypted vault assets...</span>
        </div>
      ) : assets.length === 0 ? (
        <div className="p-16 rounded-2xl border border-dashed border-cyan-500/30 bg-[#0a0a0c]/80 text-center space-y-4 max-w-2xl mx-auto my-8">
          <div className="w-16 h-16 rounded-2xl bg-cyan-950/40 border border-cyan-500/40 flex items-center justify-center mx-auto text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.2)]">
            <HardDrive className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">Your Secure Data Vault is Empty</h3>
            <p className="text-xs font-mono text-zinc-400 mt-1 max-w-md mx-auto">
              No encrypted assets stored yet. Click below to upload and encrypt your first file using client-side AES-256-GCM and Server-Side KMS.
            </p>
          </div>
          <Button
            onClick={() => setIsUploadModalOpen(true)}
            className="font-mono text-xs bg-cyan-500 hover:bg-cyan-400 text-black font-bold px-5 py-2.5 shadow-[0_0_20px_rgba(6,182,212,0.35)]"
          >
            <Sparkles className="w-3.5 h-3.5 mr-2" />
            Upload &amp; Encrypt First File
          </Button>
        </div>
      ) : filteredAssets.length === 0 ? (
        <div className="p-12 rounded-xl border border-zinc-800/80 bg-[#0a0a0c] text-center space-y-3">
          <FileText className="w-10 h-10 text-zinc-600 mx-auto" />
          <div className="text-sm font-mono text-zinc-400">No assets match your current filter or search criteria.</div>
          <p className="text-xs font-mono text-zinc-600">
            Try switching folder tabs or click &quot;Upload &amp; Encrypt&quot; to add a new asset.
          </p>
        </div>
      ) : viewMode === 'table' ? (
        
        /* TABLE VIEW */
        <div className="rounded-lg border border-zinc-800 bg-[#0a0a0c] overflow-x-auto">
          <table className="w-full text-sm text-left font-mono">
            <thead className="bg-zinc-900/60 text-zinc-400 text-[11px] uppercase border-b border-zinc-800">
              <tr>
                <th className="px-5 py-3.5 font-bold">Asset Name &amp; Code</th>
                <th className="px-4 py-3.5 font-bold">Folder</th>
                <th className="px-4 py-3.5 font-bold">Classification</th>
                <th className="px-4 py-3.5 font-bold">Permissions</th>
                <th className="px-4 py-3.5 font-bold">Status</th>
                <th className="px-5 py-3.5 font-bold text-right">Cryptographic Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-xs">
              {filteredAssets.map((asset) => {
                const isPending = serverPendingAssetIds.includes(asset.id) || requestedAssetIds.includes(asset.id) || asset.accessHistory?.some(h => h.status === 'PENDING');
                const isExpired = asset.status === 'EXPIRED';

                return (
                  <tr key={asset.id} className="hover:bg-zinc-900/40 transition-colors">
                    
                    {/* Asset Name & Code */}
                    <td className="px-5 py-4">
                      <div className="flex items-center">
                        <FileText className="h-5 w-5 mr-3 text-cyan-400 shrink-0" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span 
                              onClick={() => { setDetailsAsset(asset); setIsDetailsOpen(true); }}
                              className="font-bold text-zinc-100 hover:text-cyan-300 cursor-pointer transition-colors"
                            >
                              {asset.name}
                            </span>
                            {/* Sharing Scope Badge */}
                            {asset.sharingScope === 'ALL_PEOPLE' && (
                              <Badge variant="outline" className="border-cyan-500/30 text-cyan-400 bg-cyan-950/20 text-[9px] px-1.5 py-0">
                                <Globe className="w-2.5 h-2.5 mr-1" /> ALL PEOPLE
                              </Badge>
                            )}
                            {asset.sharingScope === 'SPECIFIC_USERS' && (
                              <Badge variant="outline" className="border-purple-500/30 text-purple-400 bg-purple-950/20 text-[9px] px-1.5 py-0">
                                <Users className="w-2.5 h-2.5 mr-1" /> SHARED ({asset.assignedUsersCount || 1})
                              </Badge>
                            )}
                            {asset.sharingScope === 'PRIVATE' && (
                              <Badge variant="outline" className="border-zinc-800 text-zinc-400 bg-zinc-900/60 text-[9px] px-1.5 py-0">
                                <Lock className="w-2.5 h-2.5 mr-1" /> PRIVATE
                              </Badge>
                            )}
                          </div>
                          <div className="text-[11px] text-zinc-500 mt-0.5 flex items-center gap-2">
                            <span>{asset.code}</span>
                            <span>•</span>
                            <span>{asset.fileType}</span>
                            <span>•</span>
                            <span>{(asset.fileSizeBytes / (1024 * 1024)).toFixed(1)} MB</span>
                            {asset.isOwner ? (
                              <>
                                <span>•</span>
                                <span className="text-cyan-400/80 font-bold">You (Owner)</span>
                              </>
                            ) : asset.ownerName ? (
                              <>
                                <span>•</span>
                                <span className="text-zinc-400">By {asset.ownerName}</span>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Folder */}
                    <td className="px-4 py-4">
                      <Badge variant="outline" className="text-[10px] font-mono border-zinc-800 text-zinc-400 bg-zinc-900/50">
                        <Folder className="w-3 h-3 mr-1 text-cyan-400" />
                        {asset.folder}
                      </Badge>
                    </td>

                    {/* Classification */}
                    <td className="px-4 py-4">
                      <Badge className={`text-[10px] font-mono border ${
                        asset.classification === 'RESTRICTED' ? 'border-rose-500/40 text-rose-400 bg-rose-950/20' :
                        asset.classification === 'CONFIDENTIAL' ? 'border-amber-500/40 text-amber-400 bg-amber-950/20' :
                        asset.classification === 'INTERNAL' ? 'border-blue-500/40 text-blue-400 bg-blue-950/20' :
                        'border-emerald-500/40 text-emerald-400 bg-emerald-950/20'
                      }`}>
                        {asset.classification}
                      </Badge>
                    </td>

                    {/* Permissions Matrix */}
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1.5 text-[10px]">
                        <span className={`px-1.5 py-0.5 rounded border ${
                          asset.canRead ? 'border-emerald-500/30 text-emerald-400 bg-emerald-950/20' : 'border-zinc-800 text-zinc-600'
                        }`}>
                          READ
                        </span>
                        <span className={`px-1.5 py-0.5 rounded border ${
                          asset.canDecrypt ? 'border-cyan-500/40 text-cyan-300 bg-cyan-950/20 font-bold' : 'border-zinc-800 text-zinc-600'
                        }`}>
                          DECRYPT
                        </span>
                        <span className={`px-1.5 py-0.5 rounded border ${
                          asset.canDownload ? 'border-blue-500/30 text-blue-400 bg-blue-950/20' : 'border-zinc-800 text-zinc-600'
                        }`}>
                          DL
                        </span>
                        {asset.canEdit && (
                          <span className="px-1.5 py-0.5 rounded border border-purple-500/30 text-purple-400 bg-purple-950/20">
                            EDIT
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Status & Expiry */}
                    <td className="px-4 py-4">
                      {isExpired ? (
                        <Badge className="border-rose-500/30 text-rose-400 bg-rose-950/20 text-[10px]">
                          EXPIRED
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10 text-[10px]">
                          ● {asset.status}
                        </Badge>
                      )}
                      {asset.expiresAt && !isExpired && (
                        <div className="text-[9px] text-amber-400/80 mt-1 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          <span>Exp: {new Date(asset.expiresAt).toLocaleDateString()}</span>
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4 text-right space-x-2 whitespace-nowrap">
                      {asset.canDecrypt || userRole === 'ADMIN' ? (
                        <Button
                          size="sm"
                          onClick={() => handleDecryptAsset(asset)}
                          className="text-xs font-mono font-bold bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 border border-cyan-500/40"
                        >
                          <Unlock className="h-3.5 w-3.5 mr-1.5" />
                          Decrypt &amp; View
                        </Button>
                      ) : isPending ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-500/40 bg-amber-950/30 text-amber-300 text-xs font-mono">
                          <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                          Pending Permit
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleRequestNftAccess(asset.id)}
                          className="text-xs font-mono font-bold bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40"
                        >
                          <Key className="h-3.5 w-3.5 mr-1.5" />
                          Request Access
                        </Button>
                      )}

                      {/* Details Drawer Trigger */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setDetailsAsset(asset); setIsDetailsOpen(true); }}
                        className="text-xs font-mono text-zinc-400 hover:text-zinc-100 border border-zinc-800 hover:bg-zinc-800/60"
                        title="View Asset Details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Button>

                      {/* Share Modal Trigger */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShareModalAsset({ id: asset.id, name: asset.name })}
                        className="text-xs font-mono text-zinc-400 hover:text-cyan-300 border border-zinc-800 hover:bg-zinc-800/60"
                        title="Controlled Share"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </Button>

                      {/* Revoke / Clearance Toggle */}
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAdminToggleRevoke(asset.id, asset.canDecrypt)}
                          className={`text-[10px] font-mono border ${
                            asset.canDecrypt 
                              ? 'text-amber-400 border-amber-500/30 hover:bg-amber-500/10' 
                              : 'text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/10'
                          }`}
                          title={asset.canDecrypt ? "Revoke cryptographic decryption access" : "Grant cryptographic decryption clearance"}
                        >
                          {asset.canDecrypt ? 'Revoke' : 'Clearance'}
                        </Button>
                      )}
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

      ) : (

        /* GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAssets.map((asset) => {
            const isPending = serverPendingAssetIds.includes(asset.id) || requestedAssetIds.includes(asset.id) || asset.accessHistory?.some(h => h.status === 'PENDING');
            const isExpired = asset.status === 'EXPIRED';

            return (
              <Card key={asset.id} className="bg-[#0a0a0c] border-zinc-800 hover:border-cyan-500/40 transition-all flex flex-col justify-between p-5">
                <div>
                  
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <Badge variant="outline" className="text-[10px] font-mono border-zinc-800 text-zinc-400 bg-zinc-900/50">
                      <Folder className="w-3 h-3 mr-1 text-cyan-400" />
                      {asset.folder}
                    </Badge>
                    <Badge className={`text-[10px] font-mono border ${
                      asset.classification === 'RESTRICTED' ? 'border-rose-500/40 text-rose-400 bg-rose-950/20' :
                      asset.classification === 'CONFIDENTIAL' ? 'border-amber-500/40 text-amber-400 bg-amber-950/20' :
                      asset.classification === 'INTERNAL' ? 'border-blue-500/40 text-blue-400 bg-blue-950/20' :
                      'border-emerald-500/40 text-emerald-400 bg-emerald-950/20'
                    }`}>
                      {asset.classification}
                    </Badge>
                  </div>

                  {/* Title & Code */}
                  <div className="flex items-start justify-between gap-2">
                    <h4 
                      onClick={() => { setDetailsAsset(asset); setIsDetailsOpen(true); }}
                      className="font-bold text-sm text-zinc-100 hover:text-cyan-300 cursor-pointer truncate"
                    >
                      {asset.name}
                    </h4>
                    {/* Sharing Scope Badge */}
                    {asset.sharingScope === 'ALL_PEOPLE' && (
                      <Badge variant="outline" className="border-cyan-500/30 text-cyan-400 bg-cyan-950/20 text-[9px] shrink-0">
                        <Globe className="w-2.5 h-2.5 mr-1" /> ALL
                      </Badge>
                    )}
                    {asset.sharingScope === 'SPECIFIC_USERS' && (
                      <Badge variant="outline" className="border-purple-500/30 text-purple-400 bg-purple-950/20 text-[9px] shrink-0">
                        <Users className="w-2.5 h-2.5 mr-1" /> SHARED
                      </Badge>
                    )}
                    {asset.sharingScope === 'PRIVATE' && (
                      <Badge variant="outline" className="border-zinc-800 text-zinc-400 bg-zinc-900/60 text-[9px] shrink-0">
                        <Lock className="w-2.5 h-2.5 mr-1" /> PRIVATE
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 mt-1">
                    <span>{asset.code}</span>
                    {asset.isOwner ? (
                      <span className="text-cyan-400/80 font-bold">You (Owner)</span>
                    ) : asset.ownerName ? (
                      <span className="text-zinc-400">By {asset.ownerName}</span>
                    ) : null}
                  </div>

                  <p className="text-xs text-zinc-400 font-mono mt-3 line-clamp-2 leading-relaxed">
                    {asset.description}
                  </p>

                  {/* Encryption & Key Badge */}
                  <div className="mt-4 pt-3 border-t border-zinc-900 flex items-center justify-between text-[10px] font-mono text-zinc-500">
                    <span className="flex items-center gap-1 text-cyan-400">
                      <Lock className="w-3 h-3" /> AES-256-GCM
                    </span>
                    <span>KEY: {asset.keyVersion || 'v1'}</span>
                    <span>{(asset.fileSizeBytes / (1024 * 1024)).toFixed(1)} MB</span>
                  </div>

                </div>

                {/* Bottom Actions */}
                <div className="mt-5 pt-3 border-t border-zinc-800/80 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setDetailsAsset(asset); setIsDetailsOpen(true); }}
                      className="text-xs font-mono text-zinc-400 hover:text-zinc-100 p-2"
                      title="View Details"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShareModalAsset({ id: asset.id, name: asset.name })}
                      className="text-xs font-mono text-zinc-400 hover:text-cyan-300 p-2"
                      title="Share"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>

                  <div>
                    {asset.canDecrypt || userRole === 'ADMIN' ? (
                      <Button
                        size="sm"
                        onClick={() => handleDecryptAsset(asset)}
                        className="text-xs font-mono font-bold bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 border border-cyan-500/40"
                      >
                        <Unlock className="h-3.5 w-3.5 mr-1" />
                        Decrypt
                      </Button>
                    ) : isPending ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-amber-500/40 bg-amber-950/30 text-amber-300 text-[10px] font-mono">
                        Pending
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleRequestNftAccess(asset.id)}
                        className="text-xs font-mono font-bold bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40"
                      >
                        <Key className="h-3.5 w-3.5 mr-1" />
                        Request
                      </Button>
                    )}
                  </div>
                </div>

              </Card>
            );
          })}
        </div>

      )}

      {/* ---------------------------------------------------- */}
      {/* MODALS AND DRAWERS                                   */}
      {/* ---------------------------------------------------- */}

      {/* 1. Upload Modal */}
      <VaultUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploadSuccess={fetchAssets}
        defaultFolder={activeFolder}
        availableUsers={users}
        userDefaultPolicy={defaultAccessPolicy}
      />

      {/* 2. Share Modal */}
      {shareModalAsset && (
        <VaultShareModal
          isOpen={Boolean(shareModalAsset)}
          onClose={() => setShareModalAsset(null)}
          assetId={shareModalAsset.id}
          assetName={shareModalAsset.name}
          availableUsers={users}
          onShareSuccess={fetchAssets}
        />
      )}

      {/* 3. Asset Details Drawer */}
      <VaultAssetDetailsDrawer
        asset={detailsAsset}
        isOpen={isDetailsOpen}
        onClose={() => { setIsDetailsOpen(false); setDetailsAsset(null); }}
        onDecrypt={(id) => {
          setIsDetailsOpen(false);
          if (detailsAsset) handleDecryptAsset(detailsAsset);
        }}
        onShare={(id) => {
          setIsDetailsOpen(false);
          if (detailsAsset) setShareModalAsset({ id: detailsAsset.id, name: detailsAsset.name });
        }}
        onRename={handleRename}
        onMove={handleMove}
        onDelete={handleDelete}
      />

      {/* 4. Secure Preview / Decryption Modal */}
      <VaultSecurePreviewModal
        isOpen={previewState.isOpen}
        loading={previewState.loading}
        error={previewState.error}
        result={previewState.result}
        canDownload={previewState.canDownload}
        onClose={() => setPreviewState(prev => ({ ...prev, isOpen: false }))}
      />

    </div>
  );
}
