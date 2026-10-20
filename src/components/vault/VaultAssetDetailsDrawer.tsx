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
  ChevronRight
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
  const [activeTab, setActiveTab] = React.useState<'overview' | 'permissions' | 'versions' | 'history' | 'blockchain'>('overview');

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
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl h-full bg-[#0a0a0c] border-l border-zinc-800 shadow-2xl flex flex-col font-mono text-xs">
        
        {/* Drawer Header */}
        <div className="p-6 border-b border-zinc-800 flex items-start justify-between bg-zinc-950/50">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge className={`text-[10px] uppercase font-mono ${classificationColor}`}>
                {asset.classification}
              </Badge>
              <Badge variant="outline" className="border-cyan-500/30 text-cyan-400 text-[10px]">
                KEY: {asset.keyVersion || 'v1'}
              </Badge>
              <span className="text-zinc-500 text-[11px]">{asset.code}</span>
            </div>
            <h2 className="text-lg font-bold text-zinc-100 mt-1 truncate max-w-md">
              {asset.name}
            </h2>
            <p className="text-[11px] text-zinc-400 line-clamp-1">
              {asset.description}
            </p>
          </div>

          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-200 p-1.5 rounded-lg hover:bg-zinc-800/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Tabs */}
        <div className="flex items-center border-b border-zinc-800 px-6 bg-zinc-900/30 overflow-x-auto scrollbar-none">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'permissions', label: 'Permissions' },
            { id: 'versions', label: `Versions (${asset.versions?.length || 1})` },
            { id: 'history', label: 'Access History' },
            { id: 'blockchain', label: 'Blockchain' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-3 px-3 border-b-2 font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-cyan-400 text-cyan-300 font-bold'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
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

          {/* TAB 2: PERMISSIONS MATRIX */}
          {activeTab === 'permissions' && (
            <div className="space-y-4">
              <div className="text-zinc-400 text-xs">
                Active permissions granted to your hardware-attested session:
              </div>

              <div className="divide-y divide-zinc-800 border border-zinc-800 rounded-lg overflow-hidden bg-zinc-900/20">
                {[
                  { label: 'READ METADATA', granted: asset.canRead, desc: 'Query file information, attributes, and on-chain DID.' },
                  { label: 'DECRYPT (KMS)', granted: asset.canDecrypt, desc: 'Request server-side DEK unwrap and view payload plaintext.' },
                  { label: 'DOWNLOAD FILE', granted: asset.canDownload, desc: 'Export and save decrypted payload locally.' },
                  { label: 'EDIT / RENAME', granted: asset.canEdit, desc: 'Modify metadata, rename asset, or move between folders.' },
                  { label: 'DELETE ASSET', granted: asset.canDelete, desc: 'Permanently remove ciphertext blob and zeroize wrapped DEK.' },
                ].map((perm) => (
                  <div key={perm.label} className="p-3 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-zinc-200 text-xs flex items-center gap-2">
                        {perm.granted ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <XCircle className="w-4 h-4 text-zinc-600" />
                        )}
                        <span>{perm.label}</span>
                      </div>
                      <div className="text-[10px] text-zinc-500 mt-0.5">{perm.desc}</div>
                    </div>
                    <Badge className={`text-[10px] font-mono ${
                      perm.granted 
                        ? 'border-emerald-500/30 text-emerald-400 bg-emerald-950/20' 
                        : 'border-zinc-800 text-zinc-500 bg-zinc-900'
                    }`}>
                      {perm.granted ? 'AUTHORIZED' : 'RESTRICTED'}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: VERSION HISTORY */}
          {activeTab === 'versions' && (
            <div className="space-y-3">
              <div className="text-zinc-400 text-xs">
                Immutable version history and audit increments:
              </div>

              <div className="space-y-2">
                {asset.versions && asset.versions.length > 0 ? (
                  asset.versions.map((ver, idx) => (
                    <div 
                      key={idx} 
                      className="p-3.5 rounded-lg bg-zinc-900/40 border border-zinc-800 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-cyan-400 text-xs">{ver.version}</span>
                        <span className="text-zinc-500 text-[10px]">
                          {new Date(ver.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-300">
                        {ver.notes || 'Routine revision update'}
                      </div>
                      <div className="text-[10px] text-zinc-500 flex items-center justify-between pt-1 border-t border-zinc-800/60">
                        <span>Committed by: {ver.uploaded_by}</span>
                        <span>Size: {ver.size}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-zinc-500 text-xs py-4 text-center">
                    No version history recorded.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: ACCESS HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              <div className="text-zinc-400 text-xs">
                Cryptographic audit trail of access attempts:
              </div>

              <div className="space-y-2">
                {asset.accessHistory && asset.accessHistory.length > 0 ? (
                  asset.accessHistory.map((log) => (
                    <div 
                      key={log.id} 
                      className="p-3 rounded-lg bg-zinc-900/40 border border-zinc-800 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-zinc-200 text-xs flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${
                            log.status === 'SUCCESS' ? 'bg-emerald-400' : 'bg-rose-400'
                          }`} />
                          <span>{log.action}</span>
                          <span className="text-zinc-500 text-[10px]">by {log.user_name}</span>
                        </div>
                        {log.details && (
                          <div className="text-[10px] text-zinc-400 mt-0.5">{log.details}</div>
                        )}
                      </div>
                      <span className="text-[10px] text-zinc-500 shrink-0">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-zinc-500 text-xs py-4 text-center">
                    No access history records found.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: BLOCKCHAIN ANCHOR */}
          {activeTab === 'blockchain' && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400 text-xs font-bold flex items-center gap-1.5">
                    <Cpu className="w-4 h-4 text-cyan-400" />
                    Sepolia Ethereum On-Chain Registry
                  </span>
                  <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-[10px]">
                    ANCHORED
                  </Badge>
                </div>

                <div className="space-y-2 text-[11px]">
                  <div>
                    <span className="text-zinc-500 block text-[10px] uppercase">Token ID</span>
                    <span className="font-mono text-cyan-300 font-bold">{asset.blockchainTokenId}</span>
                  </div>

                  <div>
                    <span className="text-zinc-500 block text-[10px] uppercase">Smart Contract</span>
                    <span className="font-mono text-zinc-300 break-all">{asset.blockchainContract}</span>
                  </div>

                  <div>
                    <span className="text-zinc-500 block text-[10px] uppercase">Decentralized Identifier (DID)</span>
                    <span className="font-mono text-zinc-300 break-all">{asset.did}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-800 flex justify-end">
                  <a
                    href={`https://sepolia.etherscan.io/address/${asset.blockchainContract}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-bold"
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
        <div className="p-4 border-t border-zinc-800 bg-zinc-950/80 flex items-center justify-between gap-2">
          
          <div className="flex items-center gap-2">
            {asset.canEdit && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onRename(asset.id, asset.name)}
                  className="border-zinc-800 text-zinc-300 hover:text-zinc-100 text-xs font-mono"
                  title="Rename File"
                >
                  <Edit3 className="w-3.5 h-3.5 mr-1" /> Rename
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onMove(asset.id, asset.folder)}
                  className="border-zinc-800 text-zinc-300 hover:text-zinc-100 text-xs font-mono"
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
              className="border-zinc-800 text-zinc-300 hover:text-cyan-300 text-xs font-mono"
              title="Share with Team"
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
                className="text-rose-400 hover:text-rose-300 hover:bg-rose-950/20 text-xs font-mono"
                title="Delete Asset"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}

            {asset.canDecrypt ? (
              <Button
                size="sm"
                onClick={() => onDecrypt(asset.id)}
                className="bg-cyan-500 text-zinc-950 hover:bg-cyan-400 font-mono font-bold text-xs"
              >
                <Unlock className="w-3.5 h-3.5 mr-1.5" />
                Decrypt &amp; View
              </Button>
            ) : (
              <Button
                size="sm"
                disabled
                className="bg-zinc-800 text-zinc-500 font-mono text-xs"
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
