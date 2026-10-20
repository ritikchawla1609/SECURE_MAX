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
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
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
}

export function VaultSecurePreviewModal({
  isOpen,
  loading,
  error,
  result,
  canDownload,
  onClose,
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
        // Fallback if not valid base64
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#0a0a0c] border border-cyan-500/40 rounded-xl shadow-2xl overflow-hidden font-mono text-xs">
        
        {/* Header */}
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/80">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-cyan-400" />
              <h3 className="text-sm font-bold text-zinc-100 uppercase">
                Secure In-Memory Decryption Viewer
              </h3>
            </div>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              AES-256-GCM • Server-Side KMS • Controlled Decryption
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-200 p-1.5 rounded-lg hover:bg-zinc-800/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          
          {/* Loading State */}
          {loading && (
            <div className="p-12 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
              <div className="text-xs font-mono text-cyan-300">
                Executing 10-Step Cryptographic Authorization Pipeline...
              </div>
              <p className="text-[10px] text-zinc-500">
                Verifying P-256 device key, session integrity, RBAC permissions, and KMS token
              </p>
            </div>
          )}

          {/* Error / Refused State */}
          {error && (
            <div className="p-5 bg-red-950/30 border border-red-500/40 rounded-lg space-y-3">
              <div className="flex items-center gap-2.5 text-red-400 font-bold text-sm">
                <ShieldAlert className="w-5 h-5" />
                ACCESS DENIED: KMS &amp; RBAC Authorization Rejection
              </div>
              <p className="text-xs font-mono text-zinc-300 leading-relaxed bg-black/60 p-3 rounded border border-red-900/50">
                {error}
              </p>
              <div className="text-[10px] font-mono text-zinc-500">
                Security Invariant: Unauthorized callers never receive or derive Data Encryption Keys (DEKs). Audit event recorded.
              </div>
            </div>
          )}

          {/* Success State */}
          {result && !loading && (
            <div className="space-y-4">
              
              {/* 10-Step Pipeline Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                <div className="bg-zinc-900/80 p-2 rounded border border-emerald-500/20 text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> 1. P-256 Auth OK
                </div>
                <div className="bg-zinc-900/80 p-2 rounded border border-emerald-500/20 text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> 2. Session Active
                </div>
                <div className="bg-zinc-900/80 p-2 rounded border border-emerald-500/20 text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> 3. Identity Active
                </div>
                <div className="bg-zinc-900/80 p-2 rounded border border-emerald-500/20 text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> 4. KMS Authorized
                </div>
              </div>

              {/* Decrypted Payload Viewer */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-400 flex items-center gap-1.5">
                    <FileCode className="w-4 h-4 text-cyan-400" />
                    Decrypted Plaintext Payload:
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopy}
                      className="text-[10px] text-zinc-400 hover:text-cyan-300 flex items-center gap-1 px-2 py-1 rounded bg-zinc-900 border border-zinc-800"
                    >
                      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                    {canDownload && (
                      <button
                        onClick={handleDownload}
                        className="text-[10px] text-zinc-400 hover:text-cyan-300 flex items-center gap-1 px-2 py-1 rounded bg-zinc-900 border border-zinc-800"
                      >
                        <Download className="w-3 h-3" />
                        <span>Download</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-4 bg-black/90 rounded-lg border border-cyan-500/30 text-xs text-cyan-200 leading-relaxed font-mono whitespace-pre-wrap select-all max-h-64 overflow-y-auto">
                  {result.mimeType?.startsWith('image/') ? (
                    <img 
                      src={`data:${result.mimeType};base64,${result.decryptedData}`} 
                      alt={result.assetName} 
                      className="max-w-full h-auto rounded"
                    />
                  ) : (result.mimeType && result.mimeType !== 'text/plain') ? (
                    <div className="flex flex-col items-center justify-center p-8 text-zinc-500 gap-3">
                      <FileCode className="w-8 h-8 opacity-50" />
                      <p>Binary File Preview Not Supported</p>
                      <p className="text-[10px]">Please download the decrypted file to view its contents.</p>
                    </div>
                  ) : (
                    result.decryptedData
                  )}
                </div>
              </div>

              {/* Technical Audit Footer */}
              <div className="pt-3 border-t border-zinc-900 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 text-[10px] text-zinc-500">
                <span>Authorized By: {result.authorizedBy}</span>
                <span>Decrypted At: {new Date(result.decryptedAt).toLocaleTimeString()}</span>
              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950/80 flex justify-end gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-100 text-xs font-mono"
          >
            Close
          </Button>
          {result && canDownload && (
            <Button
              size="sm"
              onClick={handleDownload}
              className="bg-cyan-500 text-zinc-950 hover:bg-cyan-400 font-mono font-bold text-xs"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Download Decrypted File
            </Button>
          )}
        </div>

      </div>
    </div>
  );
}
