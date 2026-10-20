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
  Globe
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

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

  const handleRevokeShare = async (targetId: string) => {
    try {
      const res = await fetch('/api/assets/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'revoke',
          assetId,
          targetUserId: targetId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await fetchActiveShares();
      onShareSuccess();
    } catch (err: any) {
      alert(err.message || 'Failed to revoke share');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#0a0a0c] border border-zinc-800 rounded-xl shadow-2xl p-6 space-y-6 font-mono text-xs max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-100 uppercase">
                Controlled Asset Sharing
              </h3>
              <p className="text-[11px] text-zinc-500 mt-0.5 truncate max-w-[280px]">
                {assetName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-200 p-1.5 rounded-lg hover:bg-zinc-800/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-950/30 border border-rose-500/40 rounded-lg text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* 1. Share Target Scope Switcher */}
        <div className="space-y-1.5">
          <label className="text-zinc-400 text-[11px] uppercase tracking-wider block">Choose Who Can Access</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setShareTargetType('SPECIFIC')}
              className={`flex items-center justify-center gap-2 p-3 rounded-lg border text-xs font-bold transition-all ${
                shareTargetType === 'SPECIFIC'
                  ? 'border-cyan-500/60 bg-cyan-500/15 text-cyan-300 shadow-sm'
                  : 'border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <User className="w-4 h-4" />
              <span>Specific Person</span>
            </button>

            <button
              type="button"
              onClick={() => setShareTargetType('ALL')}
              className={`flex items-center justify-center gap-2 p-3 rounded-lg border text-xs font-bold transition-all ${
                shareTargetType === 'ALL'
                  ? 'border-cyan-500/60 bg-cyan-500/15 text-cyan-300 shadow-sm'
                  : 'border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Globe className="w-4 h-4" />
              <span>All People (Org-Wide)</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Specific Person Picker */}
          {shareTargetType === 'SPECIFIC' ? (
            <div className="space-y-1.5">
              <label className="text-zinc-400 text-[11px] uppercase tracking-wider">Select Recipient Person</label>
              <select
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
                className="w-full h-9 rounded-md bg-black/60 border border-zinc-800 text-zinc-200 text-xs px-3 py-1 focus:outline-none focus:border-cyan-500"
              >
                {availableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email}) — {u.role}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="p-3 bg-zinc-900/40 border border-cyan-500/20 rounded-lg text-[11px] text-cyan-300 flex items-center gap-2">
              <Globe className="w-4 h-4 shrink-0 text-cyan-400" />
              <span>
                Organization-Wide: All authenticated personnel in the organization will be granted access to this data.
              </span>
            </div>
          )}

          {/* Granular Permissions Matrix */}
          <div className="space-y-2">
            <label className="text-zinc-400 text-[11px] uppercase tracking-wider">Grant Permissions</label>
            <div className="grid grid-cols-2 gap-2 p-3 bg-zinc-900/40 border border-zinc-800 rounded-lg">
              
              <label className="flex items-center gap-2 text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={canRead}
                  onChange={(e) => setCanRead(e.target.checked)}
                  className="rounded border-zinc-700 bg-black/50 text-cyan-500 focus:ring-0"
                />
                <span>Read Metadata</span>
              </label>

              <label className="flex items-center gap-2 text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={canDecrypt}
                  onChange={(e) => setCanDecrypt(e.target.checked)}
                  className="rounded border-zinc-700 bg-black/50 text-cyan-500 focus:ring-0"
                />
                <span className="text-cyan-400 font-bold">Decrypt (KMS)</span>
              </label>

              <label className="flex items-center gap-2 text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={canDownload}
                  onChange={(e) => setCanDownload(e.target.checked)}
                  className="rounded border-zinc-700 bg-black/50 text-cyan-500 focus:ring-0"
                />
                <span>Download File</span>
              </label>

              <label className="flex items-center gap-2 text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={canEdit}
                  onChange={(e) => setCanEdit(e.target.checked)}
                  className="rounded border-zinc-700 bg-black/50 text-cyan-500 focus:ring-0"
                />
                <span>Edit / Manage</span>
              </label>

            </div>
          </div>

          {/* Expiring Access Selection */}
          <div className="space-y-1.5">
            <label className="text-zinc-400 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              Access Duration (Auto-Expiring)
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: '24h', label: '24 Hours' },
                { id: '7d', label: '7 Days' },
                { id: '30d', label: '30 Days' },
                { id: 'never', label: 'Permanent' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setExpiry(opt.id as any)}
                  className={`py-2 px-1 rounded border text-center text-[10px] transition-all ${
                    expiry === opt.id
                      ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-300 font-bold'
                      : 'border-zinc-800 bg-black/40 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-zinc-500 mt-1">
              Cryptographic KMS clearance will automatically revoke when expiration timestamp is reached.
            </p>
          </div>

          {/* Action Button */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="submit"
              disabled={loading}
              className="bg-cyan-500 text-zinc-950 hover:bg-cyan-400 font-mono font-bold text-xs w-full sm:w-auto"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                  Granting Access...
                </>
              ) : (
                <>
                  <UserCheck className="w-3.5 h-3.5 mr-1.5" />
                  {shareTargetType === 'ALL' ? 'Share with All People' : 'Grant Person Access'}
                </>
              )}
            </Button>
          </div>

        </form>

        {/* 2. Active Access & Who Can Access List */}
        <div className="pt-4 border-t border-zinc-800 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold text-zinc-300">
            <span className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-cyan-400" />
              Who Currently Has Access:
            </span>
            <span className="text-zinc-500">{activeShares.length} Active Permission(s)</span>
          </div>

          <div className="space-y-1.5">
            {loadingShares ? (
              <div className="py-4 text-center text-zinc-500 flex items-center justify-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                <span>Loading access matrix...</span>
              </div>
            ) : activeShares.length > 0 ? (
              activeShares.map((share) => (
                <div
                  key={share.userId}
                  className="flex items-center justify-between p-2.5 rounded bg-zinc-900/60 border border-zinc-800 text-[11px]"
                >
                  <div>
                    <div className="font-bold text-zinc-200 flex items-center gap-1.5">
                      {share.isAll ? (
                        <Globe className="w-3.5 h-3.5 text-cyan-400" />
                      ) : (
                        <User className="w-3.5 h-3.5 text-zinc-400" />
                      )}
                      <span>{share.userName}</span>
                      {share.isAll && (
                        <Badge variant="outline" className="border-cyan-500/30 text-cyan-400 text-[9px]">
                          ORG-WIDE
                        </Badge>
                      )}
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">
                      Perms: {[
                        share.canRead && 'Read',
                        share.canDecrypt && 'Decrypt',
                        share.canDownload && 'Download',
                        share.canEdit && 'Edit',
                      ].filter(Boolean).join(', ')}
                      {share.expiresAt && ` • Expires ${new Date(share.expiresAt).toLocaleDateString()}`}
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRevokeShare(share.userId)}
                    className="text-rose-400 hover:text-rose-300 hover:bg-rose-950/20 text-[10px] p-1.5 h-auto font-mono"
                    title="Revoke access for this user"
                  >
                    <Trash2 className="w-3 h-3 mr-1" /> Revoke
                  </Button>
                </div>
              ))
            ) : (
              <div className="text-zinc-500 text-[11px] py-2 text-center">
                Private to owner. No external users currently have access.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
