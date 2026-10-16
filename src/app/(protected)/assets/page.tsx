'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  Settings,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from '@/components/ui/dialog';
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

function getFileTypeIconBadge(fileType?: string, fileName?: string) {
  const ext = (fileName?.split('.').pop() || fileType || '').toUpperCase();
  if (ext === 'PDF') {
    return {
      Icon: FileText,
      color: 'text-rose-400',
      bg: 'bg-rose-950/40 border-rose-500/40',
    };
  }
  if (['ZIP', 'TAR', 'GZ', '7Z', 'RAR'].includes(ext)) {
    return {
      Icon: Folder,
      color: 'text-amber-400',
      bg: 'bg-amber-950/40 border-amber-500/40',
    };
  }
  if (['DOC', 'DOCX', 'TXT', 'MD'].includes(ext)) {
    return {
      Icon: FileText,
      color: 'text-blue-400',
      bg: 'bg-blue-950/40 border-blue-500/40',
    };
  }
  if (['PPT', 'PPTX'].includes(ext)) {
    return {
      Icon: FileCode,
      color: 'text-orange-400',
      bg: 'bg-orange-950/40 border-orange-500/40',
    };
  }
  return {
    Icon: FileText,
    color: 'text-cyan-400',
    bg: 'bg-cyan-950/40 border-cyan-500/40',
  };
}

function AssetsPageContent() {
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
  const [currentTab, setCurrentTab] = React.useState<'my_files' | 'shared'>('my_files');
  const [activeFolder, setActiveFolder] = React.useState<string>('ALL');
  const [activeFilter, setActiveFilter] = React.useState<'ALL' | 'AUTHORIZED' | 'PENDING' | 'RESTRICTED'>('ALL');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [viewMode, setViewMode] = React.useState<'table' | 'grid'>('table');
  const [requestedAssetIds, setRequestedAssetIds] = React.useState<string[]>([]);
  const [serverPendingAssetIds, setServerPendingAssetIds] = React.useState<string[]>([]);
  const [serverRejectedAssetIds, setServerRejectedAssetIds] = React.useState<string[]>([]);
  const [requestNotice, setRequestNotice] = React.useState<string | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();

  // Sorting State
  const [sortField, setSortField] = React.useState<'name' | 'date' | 'size' | 'status'>('date');
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('desc');

  // Action Modals State (Accessible Enterprise Dialogs)
  const [renameTarget, setRenameTarget] = React.useState<{ id: string; name: string } | null>(null);
  const [renameValue, setRenameValue] = React.useState('');
  const [moveTarget, setMoveTarget] = React.useState<{ id: string; currentFolder: string; name: string } | null>(null);
  const [moveFolderValue, setMoveFolderValue] = React.useState('Projects');
  const [deleteTarget, setDeleteTarget] = React.useState<{ id: string; name: string } | null>(null);
  const [actionLoading, setActionLoading] = React.useState(false);

  // Synchronize tab and action from URL query parameters reactively
  React.useEffect(() => {
    const tabParam = searchParams?.get('tab') || searchParams?.get('filter');
    const qParam = searchParams?.get('q') || searchParams?.get('search');
    const actionParam = searchParams?.get('action');

    if (qParam !== null && qParam !== undefined) {
      setSearchQuery(qParam);
    }
    if (tabParam === 'shared') {
      setCurrentTab('shared');
    } else {
      setCurrentTab('my_files');
    }
    if (actionParam === 'upload') {
      setIsUploadModalOpen(true);
    }
  }, [searchParams]);

  const handleSelectTab = (tab: 'my_files' | 'shared') => {
    setCurrentTab(tab);
    if (tab === 'shared') {
      router.push('/assets?tab=shared');
    } else {
      router.push('/assets');
    }
  };

  const handleToggleSort = (field: 'name' | 'date' | 'size' | 'status') => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(field === 'name' ? 'asc' : 'desc');
    }
  };

  // Modal / Drawer States
  const [isUploadModalOpen, setIsUploadModalOpen] = React.useState(false);
  const [shareModalAsset, setShareModalAsset] = React.useState<{ id: string; name: string } | null>(null);
  const [detailsAsset, setDetailsAsset] = React.useState<AssetRecord | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = React.useState(false);
  const [stagedFile, setStagedFile] = React.useState<File | null>(null);
  const [isDropActive, setIsDropActive] = React.useState(false);
  const [selectedAssetIds, setSelectedAssetIds] = React.useState<string[]>([]);
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

  // Asset Actions (Accessible Enterprise Dialog Openers & Handlers)
  const handleOpenRename = (assetId: string, currentName: string) => {
    setRenameTarget({ id: assetId, name: currentName });
    setRenameValue(currentName);
  };

  const handleConfirmRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameTarget || !renameValue.trim() || renameValue.trim() === renameTarget.name) {
      setRenameTarget(null);
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch('/api/assets/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rename', assetId: renameTarget.id, newName: renameValue.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await fetchAssets();
      setIsDetailsOpen(false);
      setRenameTarget(null);
    } catch (err: any) {
      alert(err.message || 'Failed to rename asset');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenMove = (assetId: string, currentFolder: string, name?: string) => {
    setMoveTarget({ id: assetId, currentFolder, name: name || 'Document' });
    setMoveFolderValue(currentFolder);
  };

  const handleConfirmMove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moveTarget || moveFolderValue === moveTarget.currentFolder) {
      setMoveTarget(null);
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch('/api/assets/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'move', assetId: moveTarget.id, newFolder: moveFolderValue }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await fetchAssets();
      setIsDetailsOpen(false);
      setMoveTarget(null);
    } catch (err: any) {
      alert(err.message || 'Failed to move asset');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenDelete = (assetId: string, name?: string) => {
    setDeleteTarget({ id: assetId, name: name || 'Document' });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/assets/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', assetId: deleteTarget.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await fetchAssets();
      setIsDetailsOpen(false);
      setDeleteTarget(null);
    } catch (err: any) {
      alert(err.message || 'Failed to delete asset');
    } finally {
      setActionLoading(false);
    }
  };

  // Assets partitioned by tab
  const myFilesAssets = React.useMemo(() => {
    return assets.filter(a => a.isOwner !== false);
  }, [assets]);

  const sharedAssets = React.useMemo(() => {
    return assets.filter(a => !a.isOwner || Boolean(a.sharedBy));
  }, [assets]);

  const tabAssets = React.useMemo(() => {
    if (currentTab === 'shared') {
      return sharedAssets;
    }
    return vaultScope === 'ALL_DATA' ? assets : myFilesAssets;
  }, [currentTab, sharedAssets, vaultScope, assets, myFilesAssets]);

  // Folder Counts Calculation based on current tab
  const folderCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    tabAssets.forEach(a => {
      counts[a.folder] = (counts[a.folder] || 0) + 1;
    });
    return counts;
  }, [tabAssets]);

  // Filtered Assets
  const filteredAssets = React.useMemo(() => {
    return tabAssets.filter((asset) => {
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
        const matchOwner = (asset.ownerName || asset.sharedBy || '').toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchFolder && !matchClass && !matchOwner) {
          return false;
        }
      }

      return true;
    });
  }, [tabAssets, activeFolder, activeFilter, searchQuery, requestedAssetIds, serverPendingAssetIds]);

  // Sorted and Filtered Assets
  const sortedAndFilteredAssets = React.useMemo(() => {
    const list = [...filteredAssets];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') {
        cmp = a.name.localeCompare(b.name);
      } else if (sortField === 'date') {
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (sortField === 'size') {
        cmp = (a.fileSizeBytes || 0) - (b.fileSizeBytes || 0);
      } else if (sortField === 'status') {
        cmp = a.status.localeCompare(b.status);
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [filteredAssets, sortField, sortDirection]);

  // Overview Counts
  const totalAssetsCount = tabAssets.length;
  const authorizedCount = tabAssets.filter(a => a.canDecrypt).length;
  const pendingCount = tabAssets.filter(a => serverPendingAssetIds.includes(a.id) || requestedAssetIds.includes(a.id) || a.accessHistory?.some(h => h.status === 'PENDING')).length;
  const restrictedCount = tabAssets.filter(a => !a.canDecrypt && !serverPendingAssetIds.includes(a.id) && !requestedAssetIds.includes(a.id)).length;

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
      
      {/* 1. Top Navigation Tab Switcher */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleSelectTab('my_files')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors ${
              currentTab === 'my_files'
                ? 'bg-blue-600/20 text-blue-300 border border-blue-500/40 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
            }`}
          >
            <Folder className="w-3.5 h-3.5 text-blue-400" />
            <span>My Files</span>
            <Badge variant="outline" className="ml-1 px-1.5 py-0 text-[10px] border-slate-700 text-slate-400 bg-slate-900/60 font-mono">
              {myFilesAssets.length}
            </Badge>
          </button>
          <button
            type="button"
            onClick={() => handleSelectTab('shared')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors ${
              currentTab === 'shared'
                ? 'bg-blue-600/20 text-blue-300 border border-blue-500/40 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-blue-400" />
            <span>Shared With Me</span>
            <Badge variant="outline" className="ml-1 px-1.5 py-0 text-[10px] border-slate-700 text-slate-400 bg-slate-900/60 font-mono">
              {sharedAssets.length}
            </Badge>
          </button>
        </div>

        {/* Primary Action Button */}
        <Button
          onClick={() => setIsUploadModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs shadow-sm flex items-center gap-1.5"
        >
          <HardDrive className="w-3.5 h-3.5" />
          <span>Upload File</span>
        </Button>
      </div>

      {/* 2. Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            {currentTab === 'shared' ? (
              <>
                <Users className="h-6 w-6 text-blue-400" />
                Shared With Me
              </>
            ) : (
              <>
                <HardDrive className="h-6 w-6 text-blue-400" />
                My Files
              </>
            )}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {currentTab === 'shared'
              ? 'Documents other people have shared with you with granted cryptographic clearance.'
              : 'Find, upload, inspect, download, and manage your encrypted documents.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Admin Scope Switcher */}
          {isAdmin && (
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1">
              <button
                onClick={() => setVaultScope('MY_DATA')}
                className={`px-2.5 py-1 text-xs font-mono rounded transition-colors ${
                  vaultScope === 'MY_DATA'
                    ? 'bg-blue-600/20 text-blue-300 font-bold border border-blue-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                My Vault
              </button>
              <button
                onClick={() => setVaultScope('ALL_DATA')}
                className={`px-2.5 py-1 text-xs font-mono rounded transition-colors ${
                  vaultScope === 'ALL_DATA'
                    ? 'bg-blue-600/20 text-blue-300 font-bold border border-blue-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All Data (Org-Wide)
              </button>
            </div>
          )}

          {/* Default Upload Access Policy Toggle */}
          <button
            onClick={handleToggleDefaultPolicy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:border-slate-700 text-xs font-mono transition-colors text-slate-300"
            title="Click to toggle your default access policy for new uploads"
          >
            <Settings className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-500">Default Upload:</span>
            {defaultAccessPolicy === 'PRIVATE' ? (
              <span className="text-blue-400 font-semibold flex items-center gap-1">
                <Lock className="w-3 h-3" /> Private
              </span>
            ) : (
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <Globe className="w-3 h-3" /> Organization
              </span>
            )}
          </button>

          <Badge variant="outline" className="border-slate-800 text-slate-400 font-mono text-xs px-3 py-1">
            {isAdmin && vaultScope === 'ALL_DATA' ? 'ADMINISTRATIVE OVERVIEW' : `USER: ${userName}`}
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
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <Input
            type="search"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-[#0F172A] border-slate-800 font-mono text-xs text-slate-200 focus-visible:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'table' ? 'bg-blue-600/20 text-blue-300' : 'text-slate-500 hover:text-slate-300'
              }`}
              title="Table View"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'grid' ? 'bg-blue-600/20 text-blue-300' : 'text-slate-500 hover:text-slate-300'
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
        <div className="bg-amber-950/40 border border-amber-500/50 text-amber-300 px-4 py-3 rounded-xl text-xs font-mono flex items-center gap-2 shadow-sm animate-in fade-in slide-in-from-top-2">
          <Clock className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
          <span>{requestNotice}</span>
        </div>
      )}

      {/* 6. Assets Display: Table or Grid */}
      {loading && assets.length === 0 ? (
        <div className="p-16 rounded-2xl border border-slate-800 bg-[#0F172A] text-center font-mono text-xs text-slate-400 flex items-center justify-center gap-2 max-w-2xl mx-auto my-8">
          <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
          <span>Loading encrypted documents...</span>
        </div>
      ) : tabAssets.length === 0 ? (
        <div className="p-16 rounded-2xl border border-dashed border-slate-800 bg-[#0B0F19] text-center space-y-4 max-w-2xl mx-auto my-8">
          <div className="w-14 h-14 rounded-2xl bg-blue-950/40 border border-blue-500/30 flex items-center justify-center mx-auto text-blue-400 shadow-sm">
            {currentTab === 'shared' ? <Users className="w-7 h-7" /> : <HardDrive className="w-7 h-7" />}
          </div>
          <div>
            <h3 className="text-base font-semibold text-white tracking-tight">
              {currentTab === 'shared' ? 'No Shared Documents Yet' : 'No Files Uploaded Yet'}
            </h3>
            <p className="text-xs font-mono text-slate-400 mt-1 max-w-md mx-auto">
              {currentTab === 'shared'
                ? 'Documents that team members share with your identity will appear here with cryptographic clearance.'
                : 'Click Upload file below to encrypt and store your first document.'}
            </p>
          </div>
          {currentTab === 'my_files' && (
            <Button
              onClick={() => setIsUploadModalOpen(true)}
              className="font-mono text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2"
            >
              <HardDrive className="w-3.5 h-3.5 mr-2" />
              Upload file
            </Button>
          )}
        </div>
      ) : filteredAssets.length === 0 ? (
        <div className="p-12 rounded-xl border border-slate-800 bg-[#0F172A] text-center space-y-3">
          <FileText className="w-10 h-10 text-slate-600 mx-auto" />
          <div className="text-sm font-mono text-slate-300">No documents match your current filter or search criteria.</div>
          <p className="text-xs font-mono text-slate-500">
            {currentTab === 'shared'
              ? 'Try clearing your search query or switching folder filters.'
              : 'Try selecting another folder or click "Upload file" to add a new document.'}
          </p>
        </div>
      ) : viewMode === 'table' ? (
        
        /* TABLE & RESPONSIVE LIST VIEW */
        <div className="space-y-4">
          
          {/* MOBILE RESPONSIVE CARD LIST (Visible on small screens) */}
          <div className="block md:hidden space-y-3">
            {sortedAndFilteredAssets.map((asset) => {
              const isPending = serverPendingAssetIds.includes(asset.id) || requestedAssetIds.includes(asset.id) || asset.accessHistory?.some(h => h.status === 'PENDING');
              const isExpired = asset.status === 'EXPIRED';
              const iconInfo = getFileTypeIconBadge(asset.fileType, asset.name);
              const IconComp = iconInfo.Icon;

              return (
                <div
                  key={asset.id}
                  className="p-4 rounded-xl border border-slate-800 bg-[#0F172A] space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-lg ${iconInfo.bg} border flex items-center justify-center shrink-0 mt-0.5`}>
                        <IconComp className={`w-4 h-4 ${iconInfo.color}`} />
                      </div>
                      <div className="min-w-0">
                        <div 
                          onClick={() => { setDetailsAsset(asset); setIsDetailsOpen(true); }}
                          className="font-semibold text-white hover:text-blue-400 cursor-pointer text-sm truncate"
                        >
                          {asset.name}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 mt-0.5 flex flex-wrap items-center gap-2">
                          <span>{asset.code}</span>
                          <span>•</span>
                          <span>{(asset.fileSizeBytes / (1024 * 1024)).toFixed(1)} MB</span>
                          <span>•</span>
                          <span>{asset.folder}</span>
                        </div>
                      </div>
                    </div>
                    <Badge className={`text-[9px] font-mono shrink-0 ${
                      isExpired ? 'border-rose-500/30 text-rose-400 bg-rose-950/20' : 'border-emerald-500/30 text-emerald-400 bg-emerald-950/20'
                    }`}>
                      {asset.status}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800/80 font-mono">
                    <div className="flex items-center gap-1.5 text-[9px]">
                      <span className={`px-1.5 py-0.5 rounded border ${
                        asset.canRead ? 'border-emerald-500/30 text-emerald-400 bg-emerald-950/20' : 'border-slate-800 text-slate-600'
                      }`}>
                        READ
                      </span>
                      <span className={`px-1.5 py-0.5 rounded border ${
                        asset.canDecrypt ? 'border-blue-500/40 text-blue-300 bg-blue-950/20 font-bold' : 'border-slate-800 text-slate-600'
                      }`}>
                        DECRYPT
                      </span>
                      <span className={`px-1.5 py-0.5 rounded border ${
                        asset.canDownload ? 'border-indigo-500/30 text-indigo-300 bg-indigo-950/20' : 'border-slate-800 text-slate-600'
                      }`}>
                        DOWNLOAD
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setDetailsAsset(asset); setIsDetailsOpen(true); }}
                        className="text-xs text-slate-300 hover:text-white border border-slate-800 h-8 px-2"
                        title="View Details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShareModalAsset({ id: asset.id, name: asset.name })}
                        className="text-xs text-slate-300 hover:text-blue-400 border border-slate-800 h-8 px-2"
                        title="Share File"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </Button>
                      {asset.canDecrypt || userRole === 'ADMIN' ? (
                        <Button
                          size="sm"
                          onClick={() => handleDecryptAsset(asset)}
                          className="text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white h-8 px-2.5"
                        >
                          <Download className="h-3.5 w-3.5 mr-1" />
                          Download
                        </Button>
                      ) : isPending ? (
                        <span className="text-[10px] text-amber-300 border border-amber-500/40 px-2 py-1 rounded bg-amber-950/30">
                          Pending
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleRequestNftAccess(asset.id)}
                          className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/40 h-8 px-2"
                        >
                          Request
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* DESKTOP TABLE VIEW */}
          <div className="hidden md:block rounded-xl border border-slate-800 bg-[#0F172A] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left font-sans">
                <thead className="bg-[#0B0F19] text-slate-400 text-[11px] uppercase font-mono tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="w-10 px-3 py-3.5 text-center">
                      <input
                        type="checkbox"
                        checked={sortedAndFilteredAssets.length > 0 && selectedAssetIds.length === sortedAndFilteredAssets.length}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedAssetIds(sortedAndFilteredAssets.map(a => a.id));
                          else setSelectedAssetIds([]);
                        }}
                        className="w-3.5 h-3.5 accent-blue-500 rounded cursor-pointer"
                        aria-label="Select all assets"
                      />
                    </th>
                    <th 
                      onClick={() => handleToggleSort('name')}
                      className="px-5 py-3.5 font-bold cursor-pointer hover:text-white select-none transition-colors"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Document Name</span>
                        {sortField === 'name' ? (
                          sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-blue-400" /> : <ArrowDown className="w-3.5 h-3.5 text-blue-400" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-600 hover:text-slate-400" />
                        )}
                      </div>
                    </th>
                    {currentTab === 'shared' ? (
                      <th className="px-4 py-3.5 font-bold">Shared By</th>
                    ) : (
                      <th className="px-4 py-3.5 font-bold">Folder</th>
                    )}
                    <th 
                      onClick={() => handleToggleSort('size')}
                      className="px-4 py-3.5 font-bold cursor-pointer hover:text-white select-none transition-colors"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Format &amp; Size</span>
                        {sortField === 'size' ? (
                          sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-blue-400" /> : <ArrowDown className="w-3.5 h-3.5 text-blue-400" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-600 hover:text-slate-400" />
                        )}
                      </div>
                    </th>
                    <th className="px-4 py-3.5 font-bold">Permissions</th>
                    <th 
                      onClick={() => handleToggleSort('status')}
                      className="px-4 py-3.5 font-bold cursor-pointer hover:text-white select-none transition-colors"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Status</span>
                        {sortField === 'status' ? (
                          sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-blue-400" /> : <ArrowDown className="w-3.5 h-3.5 text-blue-400" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-600 hover:text-slate-400" />
                        )}
                      </div>
                    </th>
                    <th className="px-5 py-3.5 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {sortedAndFilteredAssets.map((asset) => {
                  const isPending = serverPendingAssetIds.includes(asset.id) || requestedAssetIds.includes(asset.id) || asset.accessHistory?.some(h => h.status === 'PENDING');
                  const isExpired = asset.status === 'EXPIRED';

                  return (
                    <tr key={asset.id} className="hover:bg-slate-800/40 transition-colors">
                      
                      {/* Row Checkbox */}
                      <td className="w-10 px-3 py-4 text-center">
                        <input
                          type="checkbox"
                          checked={selectedAssetIds.includes(asset.id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedAssetIds(prev => [...prev, asset.id]);
                            else setSelectedAssetIds(prev => prev.filter(id => id !== asset.id));
                          }}
                          className="w-3.5 h-3.5 accent-blue-500 rounded cursor-pointer"
                          aria-label={`Select ${asset.name}`}
                        />
                      </td>

                      {/* Asset Name & Code */}
                      <td className="px-5 py-4">
                        <div className="flex items-center">
                          {(() => {
                            const iconInfo = getFileTypeIconBadge(asset.fileType, asset.name);
                            const IconComp = iconInfo.Icon;
                            return (
                              <div className={`w-8 h-8 rounded-lg ${iconInfo.bg} border flex items-center justify-center mr-3 shrink-0`}>
                                <IconComp className={`w-4 h-4 ${iconInfo.color}`} />
                              </div>
                            );
                          })()}
                          <div>
                            <div className="flex items-center gap-2">
                              <span 
                                onClick={() => { setDetailsAsset(asset); setIsDetailsOpen(true); }}
                                className="font-semibold text-white hover:text-blue-400 cursor-pointer transition-colors"
                              >
                                {asset.name}
                              </span>
                              {/* Sharing Scope Badge */}
                              {asset.sharingScope === 'ALL_PEOPLE' && (
                                <Badge variant="outline" className="border-blue-500/30 text-blue-400 bg-blue-950/20 text-[9px] px-1.5 py-0 font-mono">
                                  <Globe className="w-2.5 h-2.5 mr-1" /> ALL PEOPLE
                                </Badge>
                              )}
                              {asset.sharingScope === 'SPECIFIC_USERS' && (
                                <Badge variant="outline" className="border-purple-500/30 text-purple-400 bg-purple-950/20 text-[9px] px-1.5 py-0 font-mono">
                                  <Users className="w-2.5 h-2.5 mr-1" /> SHARED ({asset.assignedUsersCount || 1})
                                </Badge>
                              )}
                              {asset.sharingScope === 'PRIVATE' && (
                                <Badge variant="outline" className="border-slate-800 text-slate-400 bg-slate-900/60 text-[9px] px-1.5 py-0 font-mono">
                                  <Lock className="w-2.5 h-2.5 mr-1" /> PRIVATE
                                </Badge>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2 font-mono">
                              <span>{asset.code}</span>
                              <span>•</span>
                              <span>{new Date(asset.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                              {asset.isOwner ? (
                                <>
                                  <span>•</span>
                                  <span className="text-blue-400/90 font-medium">You (Owner)</span>
                                </>
                              ) : asset.ownerName ? (
                                <>
                                  <span>•</span>
                                  <span className="text-slate-400">Owner: {asset.ownerName}</span>
                                </>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Folder or Shared By */}
                      <td className="px-4 py-4">
                        {currentTab === 'shared' ? (
                          <div className="font-mono text-xs">
                            <span className="text-slate-200 font-semibold">{asset.ownerName || asset.sharedBy || 'Team Member'}</span>
                            <div className="text-[10px] text-slate-400">Authorized Sharer</div>
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-[10px] font-mono border-slate-800 text-slate-300 bg-slate-900/60">
                            <Folder className="w-3 h-3 mr-1 text-blue-400" />
                            {asset.folder}
                          </Badge>
                        )}
                      </td>

                      {/* Format & Size */}
                      <td className="px-4 py-4 font-mono text-xs text-slate-300">
                        <div>{asset.fileType}</div>
                        <div className="text-[10px] text-slate-400">{(asset.fileSizeBytes / (1024 * 1024)).toFixed(1)} MB</div>
                      </td>

                      {/* Permissions Matrix */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1.5 text-[10px] font-mono">
                          <span className={`px-1.5 py-0.5 rounded border ${
                            asset.canRead ? 'border-emerald-500/30 text-emerald-400 bg-emerald-950/20' : 'border-slate-800 text-slate-600'
                          }`}>
                            READ
                          </span>
                          <span className={`px-1.5 py-0.5 rounded border ${
                            asset.canDecrypt ? 'border-blue-500/40 text-blue-300 bg-blue-950/20 font-bold' : 'border-slate-800 text-slate-600'
                          }`}>
                            DECRYPT
                          </span>
                          <span className={`px-1.5 py-0.5 rounded border ${
                            asset.canDownload ? 'border-indigo-500/30 text-indigo-300 bg-indigo-950/20' : 'border-slate-800 text-slate-600'
                          }`}>
                            DOWNLOAD
                          </span>
                        </div>
                      </td>

                      {/* Status & Expiry */}
                      <td className="px-4 py-4 font-mono">
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
                            className="text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                          >
                            <Download className="h-3.5 w-3.5 mr-1.5" />
                            Download
                          </Button>
                        ) : isPending ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-500/40 bg-amber-950/30 text-amber-300 text-xs font-mono">
                            <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                            Pending Access
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleRequestNftAccess(asset.id)}
                            className="text-xs font-mono font-medium bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40"
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
                          className="text-xs text-slate-400 hover:text-white border border-slate-800 hover:bg-slate-800/60"
                          title="View Details"
                          aria-label="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>

                        {/* Share Modal Trigger */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShareModalAsset({ id: asset.id, name: asset.name })}
                          className="text-xs text-slate-400 hover:text-blue-300 border border-slate-800 hover:bg-slate-800/60"
                          title="Share File"
                          aria-label="Share File"
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
                                : 'text-blue-400 border-blue-500/30 hover:bg-blue-500/10'
                            }`}
                            title={asset.canDecrypt ? "Remove Access" : "Grant Access"}
                          >
                            {asset.canDecrypt ? 'Remove Access' : 'Grant Access'}
                          </Button>
                        )}
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      ) : (

        /* GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedAndFilteredAssets.map((asset) => {
            const isPending = serverPendingAssetIds.includes(asset.id) || requestedAssetIds.includes(asset.id) || asset.accessHistory?.some(h => h.status === 'PENDING');
            const isExpired = asset.status === 'EXPIRED';

            return (
              <Card key={asset.id} className="bg-[#0F172A] border-slate-800 hover:border-slate-700 transition-colors flex flex-col justify-between p-5">
                <div>
                  
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <Badge variant="outline" className="text-[10px] font-mono border-slate-800 text-slate-300 bg-slate-900/60">
                      <Folder className="w-3 h-3 mr-1 text-blue-400" />
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
                      className="font-semibold text-sm text-white hover:text-blue-400 cursor-pointer truncate"
                    >
                      {asset.name}
                    </h4>
                    {/* Sharing Scope Badge */}
                    {asset.sharingScope === 'ALL_PEOPLE' && (
                      <Badge variant="outline" className="border-blue-500/30 text-blue-400 bg-blue-950/20 text-[9px] shrink-0 font-mono">
                        <Globe className="w-2.5 h-2.5 mr-1" /> ALL
                      </Badge>
                    )}
                    {asset.sharingScope === 'SPECIFIC_USERS' && (
                      <Badge variant="outline" className="border-purple-500/30 text-purple-400 bg-purple-950/20 text-[9px] shrink-0 font-mono">
                        <Users className="w-2.5 h-2.5 mr-1" /> SHARED
                      </Badge>
                    )}
                    {asset.sharingScope === 'PRIVATE' && (
                      <Badge variant="outline" className="border-slate-800 text-slate-400 bg-slate-900/60 text-[9px] shrink-0 font-mono">
                        <Lock className="w-2.5 h-2.5 mr-1" /> PRIVATE
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mt-1">
                    <span>{asset.code}</span>
                    {asset.isOwner ? (
                      <span className="text-blue-400/90 font-medium">You (Owner)</span>
                    ) : asset.ownerName ? (
                      <span className="text-slate-400">By {asset.ownerName}</span>
                    ) : null}
                  </div>

                  <p className="text-xs text-slate-300 font-normal mt-3 line-clamp-2 leading-relaxed">
                    {asset.description}
                  </p>

                  {/* Encryption & Key Badge */}
                  <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-[10px] font-mono text-slate-400">
                    <span className="flex items-center gap-1 text-emerald-400">
                      <Lock className="w-3 h-3" /> AES-256-GCM
                    </span>
                    <span>KEY: {asset.keyVersion || 'v1'}</span>
                    <span>{(asset.fileSizeBytes / (1024 * 1024)).toFixed(1)} MB</span>
                  </div>

                </div>

                {/* Bottom Actions */}
                <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setDetailsAsset(asset); setIsDetailsOpen(true); }}
                      className="text-xs text-slate-400 hover:text-white p-2"
                      title="View Details"
                      aria-label="View Details"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShareModalAsset({ id: asset.id, name: asset.name })}
                      className="text-xs text-slate-400 hover:text-blue-300 p-2"
                      title="Share File"
                      aria-label="Share File"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>

                  <div>
                    {asset.canDecrypt || userRole === 'ADMIN' ? (
                      <Button
                        size="sm"
                        onClick={() => handleDecryptAsset(asset)}
                        className="text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                      >
                        <Download className="h-3.5 w-3.5 mr-1" />
                        Download
                      </Button>
                    ) : isPending ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-amber-500/40 bg-amber-950/30 text-amber-300 text-[10px] font-mono">
                        Pending Access
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleRequestNftAccess(asset.id)}
                        className="text-xs font-mono font-medium bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40"
                      >
                        <Key className="h-3.5 w-3.5 mr-1" />
                        Request Access
                      </Button>
                    )}
                  </div>
                </div>

              </Card>
            );
          })}
        </div>

      )}

      {/* Bulk Actions Bar */}
      {selectedAssetIds.length > 0 && (
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#0F172A] border border-slate-800 text-xs font-sans shadow-lg animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center gap-2.5 text-slate-200">
            <CheckCircle2 className="w-4 h-4 text-blue-400" />
            <span className="font-semibold">{selectedAssetIds.length} asset(s) selected</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedAssetIds([])}
              className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Clear Selection
            </button>
            <Button
              size="sm"
              onClick={() => {
                const first = assets.find(a => selectedAssetIds.includes(a.id));
                if (first) setShareModalAsset({ id: first.id, name: first.name });
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs shadow-sm"
            >
              <Share2 className="w-3.5 h-3.5 mr-1.5" />
              Share Selected
            </Button>
          </div>
        </div>
      )}

      {/* 7. Bottom Drag & Drop Area */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDropActive(true);
        }}
        onDragLeave={() => setIsDropActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDropActive(false);
          const file = e.dataTransfer.files?.[0];
          if (file) {
            setStagedFile(file);
            setIsUploadModalOpen(true);
          }
        }}
        onClick={() => {
          setStagedFile(null);
          setIsUploadModalOpen(true);
        }}
        className={`border-2 border-dashed rounded-2xl p-6 sm:p-7 text-center transition-all flex items-center justify-center gap-3 cursor-pointer group ${
          isDropActive
            ? 'border-blue-500 bg-blue-950/30 shadow-md'
            : 'border-slate-800 hover:border-slate-700 bg-[#0F172A]/40 hover:bg-[#0F172A]/70'
        }`}
      >
        <div className="w-9 h-9 rounded-xl bg-blue-950/50 border border-blue-500/30 flex items-center justify-center text-blue-400 group-hover:scale-105 transition-transform">
          <HardDrive className="w-4 h-4" />
        </div>
        <div>
          <span className="text-xs font-mono font-medium text-slate-300 group-hover:text-blue-300 transition-colors">
            Drag &amp; drop files here or click to upload
          </span>
          <span className="text-[10px] font-mono text-slate-500 block mt-0.5">
            AES-256-GCM Envelope Encryption
          </span>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* MODALS AND DRAWERS                                   */}
      {/* ---------------------------------------------------- */}

      {/* 1. Upload Modal */}
      <VaultUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => {
          setIsUploadModalOpen(false);
          setStagedFile(null);
        }}
        onUploadSuccess={fetchAssets}
        defaultFolder={activeFolder}
        availableUsers={users}
        userDefaultPolicy={defaultAccessPolicy}
        initialFile={stagedFile}
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
        onRename={(id, name) => handleOpenRename(id, name)}
        onMove={(id, folder) => handleOpenMove(id, folder, detailsAsset?.name)}
        onDelete={(id) => handleOpenDelete(id, detailsAsset?.name)}
      />

      <VaultSecurePreviewModal
        isOpen={previewState.isOpen}
        loading={previewState.loading}
        error={previewState.error}
        result={previewState.result}
        canDownload={previewState.canDownload}
        onClose={() => setPreviewState(prev => ({ ...prev, isOpen: false }))}
        onShare={() => {
          if (previewState.result?.assetId) {
            setShareModalAsset({ id: previewState.result.assetId, name: previewState.result.assetName });
          }
        }}
      />

      {/* 4. Accessible Rename Dialog */}
      {renameTarget && (
        <Dialog open={Boolean(renameTarget)} onOpenChange={(open) => !open && setRenameTarget(null)}>
          <DialogContent onClose={() => setRenameTarget(null)}>
            <DialogHeader>
              <DialogTitle>Rename Document</DialogTitle>
              <DialogDescription>
                Enter a new name for this encrypted document.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleConfirmRename} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Document Name</label>
                <Input
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  className="bg-slate-900 border-slate-800 text-white text-xs"
                  autoFocus
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setRenameTarget(null)}
                  className="border-slate-800 text-slate-300 hover:bg-slate-800 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={actionLoading || !renameValue.trim()}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium"
                >
                  {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* 5. Accessible Move Dialog */}
      {moveTarget && (
        <Dialog open={Boolean(moveTarget)} onOpenChange={(open) => !open && setMoveTarget(null)}>
          <DialogContent onClose={() => setMoveTarget(null)}>
            <DialogHeader>
              <DialogTitle>Move Document</DialogTitle>
              <DialogDescription>
                Select destination compartment folder for <strong className="text-white">{moveTarget.name}</strong>.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleConfirmMove} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Destination Folder</label>
                <select
                  value={moveFolderValue}
                  onChange={(e) => setMoveFolderValue(e.target.value)}
                  className="w-full h-9 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-xs px-3 focus:outline-none focus:border-blue-500 font-mono"
                >
                  {['Projects', 'Finance', 'HR', 'Engineering', 'Legal'].map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setMoveTarget(null)}
                  className="border-slate-800 text-slate-300 hover:bg-slate-800 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={actionLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium"
                >
                  {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                  Move Document
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* 6. Accessible Delete Confirmation Dialog */}
      {deleteTarget && (
        <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <DialogContent onClose={() => setDeleteTarget(null)}>
            <DialogHeader>
              <DialogTitle className="text-red-400">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                Permanently Delete Document
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to delete <strong className="text-white">{deleteTarget.name}</strong>?
              </DialogDescription>
            </DialogHeader>
            <div className="p-3 rounded-lg bg-red-950/20 border border-red-500/30 text-red-300 text-xs leading-relaxed font-sans">
              This action will destroy the encrypted file and invalidate all delegated access keys across server KMS and local cache. This cannot be undone.
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDeleteTarget(null)}
                className="border-slate-800 text-slate-300 hover:bg-slate-800 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={actionLoading}
                onClick={handleConfirmDelete}
                className="bg-red-600 hover:bg-red-700 text-white text-xs font-medium"
              >
                {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                Permanently Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

    </div>
  );
}

export default function AssetsPage() {
  return (
    <React.Suspense
      fallback={
        <div className="p-16 rounded-2xl border border-slate-800 bg-[#0F172A] text-center font-mono text-xs text-slate-400 flex items-center justify-center gap-2 max-w-2xl mx-auto my-8">
          <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
          <span>Loading encrypted documents...</span>
        </div>
      }
    >
      <AssetsPageContent />
    </React.Suspense>
  );
}
