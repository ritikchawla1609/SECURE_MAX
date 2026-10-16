'use client';

import * as React from 'react';
import { 
  X, 
  Share2, 
  Clock, 
  ShieldCheck, 
  UserCheck, 
  Users, 
  User, 
  Loader2, 
  AlertCircle, 
  Trash2, 
  Globe, 
  FileText, 
  Plus, 
  Check, 
  ChevronDown,
  Lock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

interface UserOption {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface ActiveShare {
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
}

interface VaultShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  assetId: string;
  assetName: string;
  availableUsers: UserOption[];
  onShareSuccess: () => void;
}

export function VaultShareModal({
  isOpen,
  onClose,
  assetId,
  assetName,
  availableUsers,
  onShareSuccess,
}: VaultShareModalProps) {
  const [shareTargetType, setShareTargetType] = React.useState<'SPECIFIC' | 'ALL'>('SPECIFIC');
  const [targetUserId, setTargetUserId] = React.useState('');
  const [permissionLevel, setPermissionLevel] = React.useState<'VIEW' | 'DOWNLOAD' | 'EDIT'>('DOWNLOAD');
  
  const [canRead, setCanRead] = React.useState(true);
  const [canDecrypt, setCanDecrypt] = React.useState(true);
  const [canDownload, setCanDownload] = React.useState(true);
  const [canEdit, setCanEdit] = React.useState(false);
  
  const [expiry, setExpiry] = React.useState<'24h' | '7d' | '30d' | 'never'>('7d');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Active shares list
  const [activeShares, setActiveShares] = React.useState<ActiveShare[]>([]);
  const [loadingShares, setLoadingShares] = React.useState(false);

  const fetchActiveShares = React.useCallback(async () => {
    if (!assetId) return;
    try {
      setLoadingShares(true);
      const res = await fetch(`/api/assets/share?assetId=${assetId}`);
      const data = await res.json();
      if (data.success) {
        setActiveShares(data.shares || []);
      }
    } catch (err) {
      console.error('Failed to fetch active shares:', err);
    } finally {
      setLoadingShares(false);
    }
  }, [assetId]);

  React.useEffect(() => {
    if (isOpen) {
      fetchActiveShares();
      if (availableUsers.length > 0 && !targetUserId) {
        setTargetUserId(availableUsers[0].id);
      }
    }
  }, [isOpen, fetchActiveShares, availableUsers, targetUserId]);

  // Sync permission level presets
  const handlePermissionPresetChange = (preset: 'VIEW' | 'DOWNLOAD' | 'EDIT') => {
    setPermissionLevel(preset);
    if (preset === 'VIEW') {
      setCanRead(true);
      setCanDecrypt(true);
      setCanDownload(false);
      setCanEdit(false);
    } else if (preset === 'DOWNLOAD') {
      setCanRead(true);
      setCanDecrypt(true);
      setCanDownload(true);
      setCanEdit(false);
    } else if (preset === 'EDIT') {
      setCanRead(true);
      setCanDecrypt(true);
      setCanDownload(true);
      setCanEdit(true);
    }
  };

  // Revoke modal state
  const [revokeTarget, setRevokeTarget] = React.useState<{ userId: string; userName: string } | null>(null);
  const [revoking, setRevoking] = React.useState(false);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (revokeTarget) {
          setRevokeTarget(null);
        } else {
          onClose();
        }
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, revokeTarget]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalTarget = shareTargetType === 'ALL' ? 'ALL' : targetUserId;

    if (!finalTarget) {
      setError('Please select a recipient user');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/assets/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId,
          targetUserId: finalTarget,
          canRead,
          canDecrypt,
          canDownload,
          canEdit,
          expiry,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to share asset');
      }

      await fetchActiveShares();
      onShareSuccess();
    } catch (err: any) {
      setError(err.message || 'Sharing error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenRevoke = (share: ActiveShare) => {
    setRevokeTarget({ userId: share.userId, userName: share.userName });
  };

  const handleConfirmRevoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    setError(null);
    try {
      const res = await fetch('/api/assets/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'revoke',
          assetId,
          targetUserId: revokeTarget.userId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to revoke access');
      await fetchActiveShares();
      onShareSuccess();
      setRevokeTarget(null);
    } catch (err: any) {
      setError(err.message || 'Failed to revoke share');
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="fixed inset-0" 
        onClick={onClose} 
        aria-hidden="true" 
      />
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-modal-title"
        className="relative z-10 w-full max-w-lg bg-[#0F172A] border border-slate-800 rounded-2xl shadow-xl p-6 sm:p-7 space-y-6 font-sans text-xs max-h-[92vh] overflow-y-auto"
      >
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-950/40 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 id="share-modal-title" className="text-base font-bold text-white tracking-tight">
                Share File
              </h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5 truncate max-w-[260px]">
                {assetName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-950/30 border border-red-500/40 rounded-xl text-red-300 flex items-center gap-2 font-mono">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* 1. Permissions Preset Selector */}
        <div className="space-y-1.5">
          <label className="text-slate-300 text-xs font-medium block">Permissions</label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handlePermissionPresetChange('VIEW')}
              className={`py-2 px-3 rounded-lg border text-xs font-mono transition-all cursor-pointer ${
                permissionLevel === 'VIEW'
                  ? 'border-blue-500 bg-blue-950/40 text-blue-300 font-semibold'
                  : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              View Only
            </button>
            <button
              type="button"
              onClick={() => handlePermissionPresetChange('DOWNLOAD')}
              className={`py-2 px-3 rounded-lg border text-xs font-mono transition-all cursor-pointer ${
                permissionLevel === 'DOWNLOAD'
                  ? 'border-blue-500 bg-blue-950/40 text-blue-300 font-semibold'
                  : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              Download
            </button>
            <button
              type="button"
              onClick={() => handlePermissionPresetChange('EDIT')}
              className={`py-2 px-3 rounded-lg border text-xs font-mono transition-all cursor-pointer ${
                permissionLevel === 'EDIT'
                  ? 'border-blue-500 bg-blue-950/40 text-blue-300 font-semibold'
                  : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              Can Edit
            </button>
          </div>
        </div>

        {/* 2. Share with Input */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-slate-300 text-xs font-medium block">Share with</label>
            <div className="flex gap-2">
              <select
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
                className="flex-1 h-9 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-xs px-3 focus:outline-none focus:border-blue-500"
              >
                {availableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email}) — {u.role}
                  </option>
                ))}
              </select>

              <button
                type="submit"
                disabled={loading}
                className="px-4 h-9 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                <span>Share</span>
              </button>
            </div>
          </div>
        </form>

        {/* 3. Existing Access List */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-medium text-slate-300">People with access</span>
            <span className="font-mono text-[10px] text-blue-400">
              {activeShares.length} granted
            </span>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {loadingShares ? (
              <div className="p-4 text-center text-slate-500 font-mono text-xs">
                Loading access list...
              </div>
            ) : activeShares.length === 0 ? (
              <div className="p-4 text-center text-slate-500 font-mono text-xs rounded-lg bg-slate-900/50 border border-slate-800">
                Only file owner currently has clearance.
              </div>
            ) : (
              activeShares.map((share) => (
                <div
                  key={share.userId}
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-900/60 border border-slate-800 text-xs"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs uppercase shrink-0">
                      {share.userName.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-slate-200 truncate">{share.userName}</div>
                      <div className="text-[10px] font-mono text-slate-400 truncate">{share.userEmail || 'Active user'}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950/60 text-blue-300 border border-blue-500/30">
                      {share.canEdit ? 'Can edit' : share.canDownload ? 'Can view & DL' : 'Can view'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleOpenRevoke(share)}
                      className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                      title="Remove access"
                      aria-label={`Remove access for ${share.userName}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Central Invariant Notice */}
        <div className="p-3 rounded-lg bg-blue-950/30 border border-blue-500/20 text-[11px] text-slate-400 flex items-center gap-2">
          <Lock className="w-4 h-4 text-blue-400 shrink-0" />
          <span>Authorization ≠ Decryption: Sharing grants clearance. Cryptographic keys are protected by KMS.</span>
        </div>

        {/* Action Button */}
        <div className="pt-2">
          <Button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs"
          >
            Close
          </Button>
        </div>

      </div>

      {/* Accessible Revoke Confirmation Dialog */}
      {revokeTarget && (
        <Dialog open={Boolean(revokeTarget)} onOpenChange={(open) => !open && setRevokeTarget(null)}>
          <DialogContent onClose={() => setRevokeTarget(null)}>
            <DialogHeader>
              <DialogTitle>Revoke Access Clearance</DialogTitle>
              <DialogDescription>
                Are you sure you want to revoke access for <strong className="text-white">{revokeTarget.userName}</strong>?
              </DialogDescription>
            </DialogHeader>
            <div className="p-3 rounded-lg bg-red-950/20 border border-red-500/30 text-red-300 text-xs leading-relaxed font-sans">
              This will immediately invalidate their cryptographic access rights across the server KMS and prevent future decryption requests.
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRevokeTarget(null)}
                className="border-slate-800 text-slate-300 hover:bg-slate-800 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={revoking}
                onClick={handleConfirmRevoke}
                className="bg-red-600 hover:bg-red-700 text-white text-xs font-medium"
              >
                {revoking ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                Confirm Revocation
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

    </div>
  );
}
