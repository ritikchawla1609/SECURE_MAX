'use client';

import * as React from 'react';
import { 
  X, 
  FileText, 
  ExternalLink, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ShieldCheck, 
  Key, 
  Cpu, 
  Folder, 
  History, 
  Lock, 
  Unlock, 
  Trash2, 
  Edit3, 
  FolderInput, 
  Share2,
  ChevronRight,
  Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface AssetDetailProps {
  asset: {
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
    expiresAt?: string | null;
    sharedBy?: string;
    folder: string;
    fileType: string;
    mimeType: string;
    fileSizeBytes: number;
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
  } | null;
  isOpen: boolean;
  onClose: () => void;
  onDecrypt: (assetId: string) => void;
  onShare: (assetId: string) => void;
  onRename: (assetId: string, currentName: string) => void;
  onMove: (assetId: string, currentFolder: string) => void;
  onDelete: (assetId: string) => void;
}

export function VaultAssetDetailsDrawer({
  asset,
  isOpen,
  onClose,
  onDecrypt,
  onShare,
  onRename,
  onMove,
  onDelete,
}: AssetDetailProps) {
  const [activeTab, setActiveTab] = React.useState<'overview' | 'permissions' | 'encryption' | 'activity' | 'technical'>('overview');

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
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
  }, [isOpen, onClose]);

  if (!isOpen || !asset) return null;

  const sizeFormatted = asset.fileSizeBytes 
    ? `${(asset.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB`
    : 'Unknown';

  const classificationColor = 
    asset.classification === 'RESTRICTED' ? 'border-rose-500/40 text-rose-400 bg-rose-950/20' :
    asset.classification === 'CONFIDENTIAL' ? 'border-amber-500/40 text-amber-400 bg-amber-950/20' :
    asset.classification === 'INTERNAL' ? 'border-blue-500/40 text-blue-400 bg-blue-950/20' :
    'border-emerald-500/40 text-emerald-400 bg-emerald-950/20';

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="fixed inset-0" 
        onClick={onClose} 
        aria-hidden="true" 
      />
      <div 
        role="dialog" 
        aria-modal="true" 
        aria-labelledby="drawer-asset-title"
        className="relative z-10 w-full max-w-xl h-full bg-[#0F172A] border-l border-slate-800 shadow-2xl flex flex-col font-sans text-xs"
      >
        
        {/* Drawer Header */}
        <div className="p-6 border-b border-slate-800 flex items-start justify-between bg-slate-900/40">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge className={`text-[10px] uppercase font-mono ${classificationColor}`}>
                {asset.classification}
              </Badge>
              <Badge variant="outline" className="border-blue-500/30 text-blue-400 text-[10px] font-mono">
                KEY: {asset.keyVersion || 'v1'}
              </Badge>
              <span className="text-slate-400 font-mono text-[11px]">{asset.code}</span>
            </div>
            <h2 id="drawer-asset-title" className="text-lg font-bold text-white mt-1 truncate max-w-md">
              {asset.name}
            </h2>
            <p className="text-[11px] text-slate-400 line-clamp-1">
              {asset.description}
            </p>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Close drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Tabs */}
        <div className="flex items-center border-b border-slate-800 px-6 bg-slate-900/30 overflow-x-auto scrollbar-none">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'permissions', label: 'Access & Permissions' },
            { id: 'encryption', label: 'Encryption & Integrity' },
            { id: 'activity', label: 'Activity' },
            { id: 'technical', label: 'Technical Details' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-3 px-3 border-b-2 font-medium transition-colors whitespace-nowrap text-xs ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-400 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-zinc-900/40 border border-zinc-800 space-y-1">
                  <span className="text-zinc-500 text-[10px] uppercase">Folder</span>
                  <div className="font-bold text-zinc-200 flex items-center gap-1.5">
                    <Folder className="w-3.5 h-3.5 text-cyan-400" />
                    {asset.folder}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-zinc-900/40 border border-zinc-800 space-y-1">
                  <span className="text-zinc-500 text-[10px] uppercase">File Format &amp; Size</span>
                  <div className="font-bold text-zinc-200">
                    {asset.fileType} • {sizeFormatted}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-zinc-900/40 border border-zinc-800 space-y-1">
                  <span className="text-zinc-500 text-[10px] uppercase">Owner / Custodian</span>
                  <div className="font-bold text-zinc-200">{asset.ownerName}</div>
                </div>

                <div className="p-3 rounded-lg bg-zinc-900/40 border border-zinc-800 space-y-1">
                  <span className="text-zinc-500 text-[10px] uppercase">Created Date</span>
                  <div className="font-bold text-zinc-200">
                    {new Date(asset.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {/* Expiration Notice if Applicable */}
              {asset.expiresAt && (
                <div className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
                  asset.status === 'EXPIRED' 
                    ? 'bg-rose-950/30 border-rose-500/40 text-rose-300' 
                    : 'bg-amber-950/30 border-amber-500/40 text-amber-300'
                }`}>
                  <Clock className="w-4 h-4 shrink-0" />
                  <div>
                    <span className="font-bold">
                      {asset.status === 'EXPIRED' ? 'Access Expired' : 'Expiring Access'}:
                    </span>{' '}
                    <span>{new Date(asset.expiresAt).toLocaleString()}</span>
                  </div>
                </div>
              )}

              {/* Technical Wording Banner */}
              <div className="p-4 rounded-lg bg-zinc-900/60 border border-cyan-500/20 space-y-2">
                <div className="flex items-center gap-2 text-cyan-400 font-bold">
                  <ShieldCheck className="w-4 h-4" />
                  <span>AES-256-GCM • Server-Side KMS • Controlled Decryption</span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Envelope-encrypted data. The Data Encryption Key (DEK) is securely wrapped by the Server-Side Key Management Service (KMS) master key and only unwrapped inside an authenticated memory enclave upon 10-step authorization verification.
                </p>
              </div>

            </div>
          )}

          {/* TAB 2: ACCESS & PERMISSIONS */}
          {activeTab === 'permissions' && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-blue-950/30 border border-blue-500/20 text-slate-300 text-xs">
                <div className="font-semibold text-blue-400 mb-1">Authorization ≠ Decryption</div>
                <div className="text-[11px] text-slate-400 leading-relaxed">
                  Viewing permissions in the interface confirms identity authorization. Decryption keys are decoupled and protected by Server-Side KMS and cryptographic attestation.
                </div>
              </div>

              <div className="text-slate-400 text-xs font-medium">
                Active permissions for your authenticated session:
              </div>

              <div className="divide-y divide-slate-800 border border-slate-800 rounded-lg overflow-hidden bg-slate-900/30">
                {[
                  { label: 'Read Metadata', granted: asset.canRead, desc: 'Query file information, attributes, and on-chain DID.' },
                  { label: 'Decrypt File', granted: asset.canDecrypt, desc: 'Request server-side DEK unwrap and view payload plaintext.' },
                  { label: 'Download File', granted: asset.canDownload, desc: 'Export and save decrypted payload locally.' },
                  { label: 'Edit Metadata', granted: asset.canEdit, desc: 'Modify metadata, rename asset, or move between folders.' },
                  { label: 'Delete Asset', granted: asset.canDelete, desc: 'Permanently remove ciphertext blob and zeroize wrapped DEK.' },
                ].map((perm) => (
                  <div key={perm.label} className="p-3 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-200 text-xs flex items-center gap-2">
                        {perm.granted ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <XCircle className="w-4 h-4 text-slate-600" />
                        )}
                        <span>{perm.label}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{perm.desc}</div>
                    </div>
                    <Badge className={`text-[10px] font-mono ${
                      perm.granted 
                        ? 'border-emerald-500/30 text-emerald-400 bg-emerald-950/20' 
                        : 'border-slate-800 text-slate-500 bg-slate-900'
                    }`}>
                      {perm.granted ? 'AUTHORIZED' : 'RESTRICTED'}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: ENCRYPTION & INTEGRITY */}
          {activeTab === 'encryption' && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-200 text-xs font-semibold flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    Cryptographic Specifications
                  </span>
                  <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-[10px] font-mono">
                    VERIFIED ENCLAVE
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                  <div className="p-2.5 rounded bg-slate-950/50 border border-slate-800">
                    <span className="text-slate-500 block text-[10px] uppercase font-mono">Algorithm</span>
                    <span className="font-mono text-slate-200 font-bold">AES-256-GCM</span>
                  </div>

                  <div className="p-2.5 rounded bg-slate-950/50 border border-slate-800">
                    <span className="text-slate-500 block text-[10px] uppercase font-mono">Key Version</span>
                    <span className="font-mono text-blue-400 font-bold">{asset.keyVersion || 'v1'}</span>
                  </div>

                  <div className="p-2.5 rounded bg-slate-950/50 border border-slate-800">
                    <span className="text-slate-500 block text-[10px] uppercase font-mono">Integrity Standard</span>
                    <span className="font-mono text-slate-200">SHA-256 Hash Chained</span>
                  </div>

                  <div className="p-2.5 rounded bg-slate-950/50 border border-slate-800">
                    <span className="text-slate-500 block text-[10px] uppercase font-mono">Key Wrap Protection</span>
                    <span className="font-mono text-slate-200">Server-Side KMS</span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 leading-relaxed pt-2 border-t border-slate-800">
                  Data encryption key (DEK) is generated client-side and sealed under the KMS master key. Payload decryption requires hardware device attestation and verifiable access policy clearance.
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ACTIVITY */}
          {activeTab === 'activity' && (
            <div className="space-y-3">
              <div className="text-slate-400 text-xs">
                Verified audit trail for this document:
              </div>

              <div className="space-y-2">
                {asset.accessHistory && asset.accessHistory.length > 0 ? (
                  asset.accessHistory.map((log) => (
                    <div 
                      key={log.id} 
                      className="p-3 rounded-lg bg-slate-900/40 border border-slate-800 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-semibold text-slate-200 text-xs flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${
                            log.status === 'SUCCESS' ? 'bg-emerald-400' : 'bg-rose-400'
                          }`} />
                          <span>{log.action}</span>
                          <span className="text-slate-400 text-[10px]">by {log.user_name}</span>
                        </div>
                        {log.details && (
                          <div className="text-[10px] text-slate-400 mt-0.5">{log.details}</div>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-500 text-xs py-6 text-center">
                    No recent activity records found for this document.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: TECHNICAL DETAILS */}
          {activeTab === 'technical' && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 text-xs font-semibold flex items-center gap-1.5">
                    <Cpu className="w-4 h-4 text-blue-400" />
                    Sepolia Ethereum On-Chain Registry
                  </span>
                  <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-[10px] font-mono">
                    ANCHORED
                  </Badge>
                </div>

                <div className="space-y-2 text-[11px]">
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-mono">Token ID</span>
                    <span className="font-mono text-blue-300 font-bold">{asset.blockchainTokenId}</span>
                  </div>

                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-mono">Smart Contract</span>
                    <span className="font-mono text-slate-300 break-all">{asset.blockchainContract}</span>
                  </div>

                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-mono">Decentralized Identifier (DID)</span>
                    <span className="font-mono text-slate-300 break-all">{asset.did}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 flex justify-end">
                  <a
                    href={`https://sepolia.etherscan.io/address/${asset.blockchainContract}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium"
                  >
                    <span>View on Sepolia Etherscan</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Drawer Action Bar */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/70 flex items-center justify-between gap-2">
          
          <div className="flex items-center gap-2">
            {asset.canEdit && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onRename(asset.id, asset.name)}
                  className="border-slate-700 text-slate-300 hover:text-white text-xs"
                  title="Rename File"
                >
                  <Edit3 className="w-3.5 h-3.5 mr-1" /> Rename
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onMove(asset.id, asset.folder)}
                  className="border-slate-700 text-slate-300 hover:text-white text-xs"
                  title="Move Folder"
                >
                  <FolderInput className="w-3.5 h-3.5 mr-1" /> Move
                </Button>
              </>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => onShare(asset.id)}
              className="border-slate-700 text-slate-300 hover:text-white text-xs"
              title="Share File"
            >
              <Share2 className="w-3.5 h-3.5 mr-1" /> Share
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {asset.canDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(asset.id)}
                className="text-rose-400 hover:text-rose-300 hover:bg-rose-950/20 text-xs"
                title="Delete File"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs"
            >
              Close
            </Button>

            {asset.canDecrypt ? (
              <Button
                size="sm"
                onClick={() => onDecrypt(asset.id)}
                className="bg-blue-600 text-white hover:bg-blue-700 font-medium text-xs shadow-sm flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download</span>
              </Button>
            ) : (
              <Button
                size="sm"
                disabled
                className="bg-slate-800 text-slate-500 text-xs"
              >
                <Lock className="w-3.5 h-3.5 mr-1.5" />
                Restricted
              </Button>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
