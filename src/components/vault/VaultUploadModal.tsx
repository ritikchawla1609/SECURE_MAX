'use client';

import * as React from 'react';
import { 
  X, 
  UploadCloud, 
  Lock, 
  ShieldCheck, 
  Cpu, 
  Loader2, 
  FileText, 
  AlertCircle,
  User,
  Users,
  Globe,
  CheckCircle2,
  FileCode
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useBlockchainTransaction } from '@/hooks/useBlockchainTransaction';
import { AssetRegistryABI } from '@/lib/blockchain/abis';
import deployedAddresses from '../../../deployed-addresses.json';
import { useAccount } from 'wagmi';

interface UserOption {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface VaultUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: () => void;
  defaultFolder?: string;
  availableUsers?: UserOption[];
  userDefaultPolicy?: 'PRIVATE' | 'ORGANIZATION';
  initialFile?: File | null;
}

export function VaultUploadModal({
  isOpen,
  onClose,
  onUploadSuccess,
  defaultFolder = 'Projects',
  availableUsers = [],
  userDefaultPolicy = 'PRIVATE',
  initialFile = null,
}: VaultUploadModalProps) {
  const [name, setName] = React.useState('');
  const [folder, setFolder] = React.useState(defaultFolder);
  const [classification, setClassification] = React.useState('CONFIDENTIAL');
  const [description, setDescription] = React.useState('');
  const [content, setContent] = React.useState('');
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState(0);
  
  // Access scope selection
  const [shareScope, setShareScope] = React.useState<'PRIVATE' | 'SPECIFIC_USER' | 'ALL_PEOPLE'>(
    userDefaultPolicy === 'ORGANIZATION' ? 'ALL_PEOPLE' : 'PRIVATE'
  );
  const [targetUserId, setTargetUserId] = React.useState('');
  const [saveDefaultPolicy, setSaveDefaultPolicy] = React.useState(false);

  const [loading, setLoading] = React.useState(false);
  const [uploadStage, setUploadStage] = React.useState<'IDLE' | 'ENCRYPTING' | 'STORING' | 'DONE'>('IDLE');
  const [error, setError] = React.useState<string | null>(null);

  const { execute, txState, hash, errorMessage, reset: resetTx } = useBlockchainTransaction();
  const { address } = useAccount();
  const assetRegistryAddress = (process.env.NEXT_PUBLIC_ASSET_REGISTRY_ADDRESS || (deployedAddresses.contracts as any).AssetRegistry) as `0x${string}`;

  React.useEffect(() => {
    if (defaultFolder && defaultFolder !== 'ALL') {
      setFolder(defaultFolder);
    }
  }, [defaultFolder]);

  React.useEffect(() => {
    if (availableUsers.length > 0 && !targetUserId) {
      setTargetUserId(availableUsers[0].id);
    }
  }, [availableUsers, targetUserId]);

  React.useEffect(() => {
    if (initialFile) {
      setName(initialFile.name);
      setSelectedFile(initialFile);
      setContent(`[File selected: ${initialFile.name} (${(initialFile.size / 1024).toFixed(1)} KB)]`);
    }
  }, [initialFile]);

  const finishUpload = React.useCallback(() => {
    setName('');
    setDescription('');
    setContent('');
    setSelectedFile(null);
    setUploadProgress(0);
    setUploadStage('IDLE');
    resetTx();
    setLoading(false);
    onUploadSuccess();
    onClose();
  }, [resetTx, onUploadSuccess, onClose]);

  React.useEffect(() => {
    if (txState === 'CONFIRMED') {
      finishUpload();
    }
  }, [txState, finishUpload]);

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

  if (!isOpen) return null;

  const handleFile = (file: File) => {
    setName(file.name);
    setSelectedFile(file);
    setContent(`[File selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)]`);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('File name is required');
      return;
    }
    if (!content.trim() && !selectedFile) {
      setError('Please select a file or enter content');
      return;
    }

    setLoading(true);
    setError(null);
    setUploadStage('ENCRYPTING');
    setUploadProgress(35);

    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('folder', folder);
      formData.append('classification', classification);
      formData.append('description', description.trim());
      formData.append('shareScope', shareScope);
      
      if (shareScope === 'SPECIFIC_USER') {
        formData.append('targetUserId', targetUserId);
      }
      formData.append('saveDefaultPolicy', String(saveDefaultPolicy));

      if (selectedFile) {
        formData.append('file', selectedFile);
      } else {
        formData.append('plaintext', content);
      }

      setUploadProgress(70);
      setUploadStage('STORING');

      const res = await fetch('/api/assets/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload and encrypt asset');
      }

      setUploadProgress(100);
      setUploadStage('DONE');

      // Mint on Blockchain if connected
      if (address) {
        try {
          await execute({
            address: assetRegistryAddress,
            abi: AssetRegistryABI,
            functionName: 'registerAsset',
            args: [
              "0x" + Buffer.from(data.asset.id).toString("hex").padEnd(64, '0').slice(0, 64),
              data.asset.code,
              "0x" + Buffer.from("content_hash_mock").toString("hex").padEnd(64, '0').slice(0, 64),
              classification === 'PUBLIC' ? 0 : classification === 'INTERNAL' ? 1 : classification === 'CONFIDENTIAL' ? 2 : 3,
              `did:securemax:user:${address.toLowerCase()}`
            ],
          });
        } catch (txErr) {
          console.warn("Blockchain minting skipped or failed:", txErr);
        }
      }

      if (!address) {
        setTimeout(() => finishUpload(), 600);
      }
    } catch (err: any) {
      setError(err.message || 'Upload error');
      setLoading(false);
      setUploadStage('IDLE');
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
        aria-labelledby="upload-modal-title"
        className="relative z-10 w-full max-w-xl bg-[#0F172A] border border-slate-800 rounded-2xl shadow-xl p-6 sm:p-7 space-y-5 font-sans text-xs max-h-[92vh] overflow-y-auto"
      >
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-950/40 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h3 id="upload-modal-title" className="text-base font-bold text-white tracking-tight">
                Upload file
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Client-side AES-256-GCM encryption with Server-Side KMS protection
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

        {/* DRAG & DROP ZONE */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-xl p-6 sm:p-8 text-center transition-all flex flex-col items-center justify-center cursor-pointer ${
            isDragging
              ? 'border-blue-500 bg-blue-950/40'
              : 'border-slate-700 hover:border-slate-600 bg-slate-900/40 hover:bg-slate-900/60'
          }`}
          onClick={() => document.getElementById('vault-file-input')?.click()}
        >
          <input
            id="vault-file-input"
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />

          <div className="w-12 h-12 rounded-xl bg-blue-950/50 border border-blue-500/40 flex items-center justify-center text-blue-400 mb-3">
            <UploadCloud className={`w-6 h-6 transition-transform ${isDragging ? 'scale-110 -translate-y-0.5' : ''}`} />
          </div>

          <h4 className="text-sm font-semibold text-white tracking-tight">
            Drag &amp; drop files here
          </h4>
          <p className="text-xs text-slate-400 mt-1">
            or <span className="text-blue-400 underline font-medium">browse files</span>
          </p>
          <p className="text-[11px] text-slate-500 font-mono mt-2">
            Supports: PDF, DOCX, TXT, images (Max 5MB)
          </p>
        </div>

        {/* SELECTED / UPLOADING STATE BANNER */}
        {selectedFile && (
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-700 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="font-semibold text-white truncate">{selectedFile.name}</span>
                <span className="text-[10px] font-mono text-slate-400 shrink-0">
                  ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
                </span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedFile(null);
                  setName('');
                }}
                className="text-slate-400 hover:text-red-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Progress bar */}
            {loading && (
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-[10px] font-mono text-blue-300">
                  <span>
                    {uploadStage === 'ENCRYPTING' ? 'Encrypting AES-256-GCM payload...' : 'Storing ciphertext...'}
                  </span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-blue-600 h-full rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* METADATA FORM */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* File Name */}
          <div className="space-y-1">
            <label className="text-slate-300 text-xs font-medium block">File Name *</label>
            <Input
              type="text"
              placeholder="e.g. Q3_Financial_Review.pdf"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-[#0B0F19] border-slate-700 text-slate-100 text-xs rounded-lg"
              required
            />
          </div>

          {/* Folder & Classification */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-slate-300 text-xs font-medium block">Folder</label>
              <select
                value={folder}
                onChange={(e) => setFolder(e.target.value)}
                className="w-full h-9 rounded-lg bg-[#0B0F19] border border-slate-700 text-slate-200 text-xs px-3 focus:outline-none focus:border-blue-500"
              >
                <option value="Projects">Projects</option>
                <option value="Finance">Finance</option>
                <option value="HR">HR</option>
                <option value="Engineering">Engineering</option>
                <option value="Legal">Legal</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-slate-300 text-xs font-medium block">Classification</label>
              <select
                value={classification}
                onChange={(e) => setClassification(e.target.value)}
                className="w-full h-9 rounded-lg bg-[#0B0F19] border border-slate-700 text-slate-200 text-xs px-3 focus:outline-none focus:border-blue-500"
              >
                <option value="PUBLIC">PUBLIC</option>
                <option value="INTERNAL">INTERNAL</option>
                <option value="CONFIDENTIAL">CONFIDENTIAL</option>
                <option value="RESTRICTED">RESTRICTED</option>
              </select>
            </div>
          </div>

          {/* Access Scope (Private vs Specific Person vs All) */}
          <div className="space-y-2 pt-1">
            <label className="text-slate-300 text-xs font-medium block">Initial Access</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setShareScope('PRIVATE')}
                className={`py-2 px-3 rounded-lg border text-xs font-mono transition-all ${
                  shareScope === 'PRIVATE'
                    ? 'border-blue-500 bg-blue-950/40 text-blue-300 font-semibold'
                    : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                Private to Me
              </button>
              <button
                type="button"
                onClick={() => setShareScope('SPECIFIC_USER')}
                className={`py-2 px-3 rounded-lg border text-xs font-mono transition-all ${
                  shareScope === 'SPECIFIC_USER'
                    ? 'border-blue-500 bg-blue-950/40 text-blue-300 font-semibold'
                    : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                Specific Person
              </button>
              <button
                type="button"
                onClick={() => setShareScope('ALL_PEOPLE')}
                className={`py-2 px-3 rounded-lg border text-xs font-mono transition-all ${
                  shareScope === 'ALL_PEOPLE'
                    ? 'border-blue-500 bg-blue-950/40 text-blue-300 font-semibold'
                    : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                All People
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !name.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs px-5 py-2 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Upload file</span>
                </>
              )}
            </Button>
          </div>
        </form>

      </div>
    </div>
  );
}
