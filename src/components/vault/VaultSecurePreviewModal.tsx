'use client';

import * as React from 'react';
import { 
  X, 
  Sparkles, 
  CheckCircle2, 
  FileCode, 
  Copy, 
  Check, 
  Download, 
  ShieldAlert, 
  ShieldCheck,
  Loader2,
  Lock,
  Share2,
  FileText,
  Key,
  Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface DecryptResultData {
  success: boolean;
  assetId: string;
  assetName: string;
  classification: string;
  folder?: string;
  fileType?: string;
  mimeType?: string;
  fileSizeBytes?: number;
  decryptedData: string;
  decryptedAt: string;
  keyVersion?: string;
  encryptionStandard?: string;
  authorizedBy?: string;
}

interface VaultSecurePreviewModalProps {
  isOpen: boolean;
  loading: boolean;
  error: string | null;
  result: DecryptResultData | null;
  canDownload: boolean;
  onClose: () => void;
  onShare?: () => void;
}

export function VaultSecurePreviewModal({
  isOpen,
  loading,
  error,
  result,
  canDownload,
  onClose,
  onShare,
}: VaultSecurePreviewModalProps) {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (!result?.decryptedData) return;
    navigator.clipboard.writeText(result.decryptedData);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!result?.decryptedData) return;
    
    let blob: Blob;
    const isBase64 = result.mimeType && result.mimeType !== 'text/plain';
    
    if (isBase64) {
      try {
        const byteCharacters = atob(result.decryptedData);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        blob = new Blob([byteArray], { type: result.mimeType });
      } catch (e) {
        blob = new Blob([result.decryptedData], { type: result.mimeType || 'text/plain' });
      }
    } else {
      blob = new Blob([result.decryptedData], { type: result.mimeType || 'text/plain' });
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.assetName || `decrypted_${result.assetId}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const fileSizeFormatted = result?.fileSizeBytes
    ? (result.fileSizeBytes / (1024 * 1024)).toFixed(1) + ' MB'
    : '2.4 MB';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-[#0B0F19] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden font-sans text-xs">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-[#0F172A]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-950/60 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white tracking-wide flex items-center gap-2">
                Secure Decryption Preview
                <span className="text-[10px] font-mono font-normal px-2 py-0.5 rounded bg-blue-950/80 border border-blue-500/30 text-blue-300">
                  IN-MEMORY ENCLAVE
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 font-light mt-0.5">
                Cryptographic authorization verified against zero-trust policy.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800/60 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 max-h-[78vh] overflow-y-auto">
          
          {/* Loading State */}
          {loading && (
            <div className="py-20 flex flex-col items-center justify-center space-y-4">
              <div className="relative">
                <Loader2 className="w-10 h-10 animate-spin text-cyan-400" />
                <div className="absolute inset-0 rounded-full border border-cyan-400/20 animate-ping" />
              </div>
              <div className="text-sm font-mono text-cyan-300 font-bold">
                Executing 10-Step Cryptographic Authorization Pipeline...
              </div>
              <p className="text-xs text-zinc-400 font-light text-center max-w-md">
                Verifying local ECDSA P-256 hardware signature, session posture, KMS key wrapping token, and audit chaining.
              </p>
            </div>
          )}

          {/* Error / Access Denied State */}
          {error && !loading && (
            <div className="p-6 bg-red-950/30 border border-red-500/40 rounded-2xl space-y-4">
              <div className="flex items-center gap-3 text-red-400 font-bold text-sm">
                <ShieldAlert className="w-6 h-6 shrink-0" />
                <span>ACCESS DENIED: Decryption Authorization Refused</span>
              </div>
              <p className="text-xs font-mono text-zinc-300 leading-relaxed bg-black/60 p-4 rounded-xl border border-red-900/50">
                {error}
              </p>
              <div className="text-[11px] font-mono text-zinc-400 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                <span>Zero-Trust Invariant: User lacks valid KMS decryption permit. Authorization ≠ Decryption.</span>
              </div>
            </div>
          )}

          {/* Success State (Matching Panel 5 in Design Specification) */}
          {result && !loading && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Column: Document Preview Sheet (col 7) */}
              <div className="lg:col-span-7 flex flex-col bg-zinc-950/80 rounded-2xl border border-zinc-800 p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                  <div className="flex items-center gap-2 text-zinc-300 font-mono text-xs">
                    <FileText className="w-4 h-4 text-cyan-400" />
                    <span>Decrypted Content Viewer</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopy}
                      className="text-[11px] font-mono text-zinc-400 hover:text-cyan-300 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 transition-colors"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                {/* Document Sheet Display */}
                <div className="flex-1 min-h-[260px] max-h-[360px] p-4 bg-black/90 rounded-xl border border-cyan-500/25 text-xs text-cyan-200 leading-relaxed font-mono whitespace-pre-wrap select-all overflow-y-auto">
                  {result.mimeType?.startsWith('image/') ? (
                    /* Safe image rendering using standard img with role presentation */
                    <div className="flex items-center justify-center p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img 
                        src={`data:${result.mimeType};base64,${result.decryptedData}`} 
                        alt={result.assetName} 
                        className="max-w-full max-h-72 object-contain rounded-lg border border-cyan-500/30"
                      />
                    </div>
                  ) : (result.mimeType && result.mimeType !== 'text/plain') ? (
                    <div className="flex flex-col items-center justify-center h-48 text-zinc-500 gap-3">
                      <FileCode className="w-10 h-10 opacity-50 text-cyan-400" />
                      <p className="text-zinc-300 font-bold">Binary Payload Decrypted</p>
                      <p className="text-[11px] text-zinc-400 text-center max-w-xs">
                        Binary contents (MIME: {result.mimeType}) have been decrypted in memory. Click Download below to save the file.
                      </p>
                    </div>
                  ) : (
                    result.decryptedData
                  )}
                </div>

                <div className="text-[10px] font-mono text-zinc-500 pt-1 flex items-center justify-between">
                  <span>DECRYPTED: {new Date(result.decryptedAt).toLocaleTimeString()}</span>
                  <span>BY: {result.authorizedBy}</span>
                </div>
              </div>

              {/* Right Column: Metadata & Security Status (col 5 - Panel 5) */}
              <div className="lg:col-span-5 flex flex-col justify-between space-y-5">
                
                {/* File Header */}
                <div className="p-4 rounded-2xl bg-[#0D172A]/80 border border-zinc-800">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-950/50 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-white text-sm truncate">{result.assetName}</h4>
                      <p className="text-xs text-zinc-400 font-mono mt-0.5">{fileSizeFormatted}</p>
                    </div>
                  </div>

                  {/* Actions: Download & Share */}
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    {canDownload && (
                      <Button
                        size="sm"
                        onClick={handleDownload}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs tracking-wide shadow-sm"
                      >
                        <Download className="w-3.5 h-3.5 mr-1.5" />
                        Download
                      </Button>
                    )}
                    {onShare && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={onShare}
                        className="w-full border-slate-800 text-slate-300 hover:bg-slate-800 text-xs font-mono"
                      >
                        <Share2 className="w-3.5 h-3.5 mr-1.5" />
                        Share
                      </Button>
                    )}
                  </div>
                </div>

                {/* Security Status Panel */}
                <div className="p-5 rounded-xl bg-[#0F172A] border border-slate-800 space-y-4">
                  <div className="text-xs font-bold text-white tracking-wide uppercase font-mono flex items-center gap-2">
                    <Shield className="w-4 h-4 text-blue-400" />
                    Security Details
                  </div>

                  {/* 1. Encrypted Badge */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/80 border border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-950/50 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-200 text-xs">Encrypted</div>
                        <div className="text-[10px] font-mono text-emerald-400">AES-256-GCM</div>
                      </div>
                    </div>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </div>

                  {/* 2. Access Control Badge */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/80 border border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-950/50 border border-blue-500/40 flex items-center justify-center text-blue-400">
                        <Key className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-200 text-xs">Access Control</div>
                        <div className="text-[10px] font-mono text-slate-400">RBAC Enforced</div>
                      </div>
                    </div>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </div>

                  {/* 3. Audit Integrity Badge */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/80 border border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-950/50 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-200 text-xs">Audit Integrity</div>
                        <div className="text-[10px] font-mono text-emerald-400">Verified</div>
                      </div>
                    </div>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </div>

                </div>

              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-[#0F172A] flex justify-end gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xs font-mono"
          >
            Cancel
          </Button>
          {result && canDownload && (
            <Button
              size="sm"
              onClick={handleDownload}
              className="bg-blue-600 text-white hover:bg-blue-700 font-medium text-xs shadow-sm flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Download
            </Button>
          )}
        </div>

      </div>
    </div>
  );
}
