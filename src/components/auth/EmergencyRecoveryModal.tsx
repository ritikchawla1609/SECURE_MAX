'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldAlert,
  Key,
  Lock,
  Laptop,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  X,
  Copy,
  Check,
  ArrowRight
} from 'lucide-react';
import { generateAndSaveDeviceKey } from '@/lib/crypto/clientP256';

interface EmergencyRecoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function EmergencyRecoveryModal({ isOpen, onClose, onSuccess }: EmergencyRecoveryModalProps) {
  const router = useRouter();

  const [adminId, setAdminId] = useState('ADM-0001');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [bootstrapSecret, setBootstrapSecret] = useState('');
  const [newDeviceName, setNewDeviceName] = useState('SecureMAX Replacement Admin Laptop');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [copied, setCopied] = useState(false);

  // Success state with new recovery kit
  const [newRecoveryPackage, setNewRecoveryPackage] = useState<{
    recoveryId: string;
    recoveryCode: string;
    generatedAt: string;
  } | null>(null);

  if (!isOpen) return null;

  const handleExecuteRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryCode.trim()) {
      setErrorMessage('Please provide your offline recovery code.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      // Generate replacement hardware-isolated P-256 key pair on this device
      const newKey = await generateAndSaveDeviceKey(newDeviceName);

      const res = await fetch('/api/admin/recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminId: adminId.trim(),
          recoveryCode: recoveryCode.trim().toUpperCase(),
          bootstrapSecret: bootstrapSecret.trim() || undefined,
          newDeviceName: newDeviceName.trim(),
          newPublicKey: newKey.publicKeySpki,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errorMsg =
          typeof data?.error === 'string'
            ? data.error
            : typeof data?.error?.message === 'string'
              ? data.error.message
              : typeof data?.message === 'string'
                ? data.message
                : data?.error
                  ? JSON.stringify(data.error)
                  : `Recovery failed with HTTP ${res.status}`;
        throw new Error(errorMsg);
      }

      setNewRecoveryPackage(data.newRecoveryPackage);
    } catch (err: any) {
      console.error('[Emergency Recovery Error]:', err);
      const msg =
        typeof err === 'string'
          ? err
          : typeof err?.message === 'string'
            ? err.message
            : typeof err?.error === 'string'
              ? err.error
              : typeof err?.error === 'object' && err.error !== null
                ? (err.error.message || JSON.stringify(err.error))
                : String(err);
      setErrorMessage(msg || 'Emergency recovery failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteAndSignIn = () => {
    if (onSuccess) onSuccess();
    onClose();
    router.push('/dashboard/admin');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-[#0a0f18] border border-amber-500/40 rounded-3xl p-6 sm:p-8 relative shadow-[0_0_70px_rgba(245,158,11,0.2)] text-zinc-100">
        
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-zinc-400 hover:text-white p-1"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 pb-5 border-b border-zinc-800/80 mb-6">
          <div className="w-11 h-11 rounded-xl bg-amber-950/60 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 shadow-[0_0_15px_rgba(245,158,11,0.3)]">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              Emergency Administrator Recovery
            </h2>
            <p className="text-xs text-zinc-400 font-light">
              2-Factor ceremony to restore root identity and bind a replacement device
            </p>
          </div>
        </div>

        {!newRecoveryPackage ? (
          <form onSubmit={handleExecuteRecovery} className="space-y-4 text-xs">
            <div className="p-3.5 bg-amber-950/30 border border-amber-500/30 rounded-xl text-amber-300 space-y-1">
              <span className="font-semibold text-amber-200 block">Emergency Ceremony Protocol:</span>
              <p className="font-light leading-relaxed">
                Executing this ceremony immediately revokes your previous admin device and invalidates all active sessions. 
                Your administrator account will be re-bound to this workstation.
              </p>
            </div>

            {/* Admin ID */}
            <div>
              <label className="text-zinc-300 font-semibold block mb-1">Administrator ID or Email</label>
              <input
                type="text"
                value={adminId}
                onChange={(e) => setAdminId(e.target.value)}
                placeholder="ADM-0001 or admin@securemax.mil"
                required
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-100 focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Factor A: Offline Recovery Code */}
            <div>
              <label className="text-zinc-300 font-semibold block mb-1">
                Factor A: Offline Recovery Code (e.g. REC-XXXX-XXXX-XXXX)
              </label>
              <input
                type="text"
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
                placeholder="REC-8A92-491F-C841"
                required
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-amber-300 font-mono tracking-widest uppercase focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Factor B: Deployment Secret */}
            <div>
              <label className="text-zinc-300 font-semibold block mb-1">
                Factor B: Deployment Recovery Secret (Optional / If Configured)
              </label>
              <input
                type="password"
                value={bootstrapSecret}
                onChange={(e) => setBootstrapSecret(e.target.value)}
                placeholder="Server deployment secret"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-100 focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Replacement Device Name */}
            <div>
              <label className="text-zinc-300 font-semibold block mb-1">Replacement Device Name</label>
              <input
                type="text"
                value={newDeviceName}
                onChange={(e) => setNewDeviceName(e.target.value)}
                placeholder="SecureMAX Replacement Admin Laptop"
                required
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-100 focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Error Banner */}
            {errorMessage && (
              <div className="p-3 bg-red-950/40 border border-red-500/40 rounded-xl flex items-center gap-2 text-red-400 font-mono">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold text-xs tracking-wider shadow-[0_0_20px_rgba(245,158,11,0.4)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-4"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying Cryptographic Recovery Factors...</span>
                </>
              ) : (
                <>
                  <Key className="w-4 h-4" />
                  <span>Execute Emergency Recovery Ceremony</span>
                </>
              )}
            </button>
          </form>
        ) : (
          /* Success: Show New Recovery Package */
          <div className="space-y-4 animate-in fade-in text-xs">
            <div className="p-4 bg-emerald-950/40 border border-emerald-500/40 rounded-2xl flex items-start gap-3 text-emerald-300">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-white text-sm">Account Successfully Recovered!</div>
                <p className="mt-1 text-emerald-300 font-light leading-relaxed">
                  Previous admin devices have been revoked. This device is now your verified singleton Admin terminal.
                </p>
              </div>
            </div>

            <div className="p-4 bg-zinc-950 border border-cyan-500/30 rounded-2xl space-y-3">
              <span className="text-[10px] font-mono text-zinc-400 block uppercase">
                New Offline Recovery Package (Store Safely)
              </span>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-black/80 border border-cyan-500/40 rounded-xl px-4 py-2.5 text-cyan-300 font-mono text-sm tracking-wider font-bold text-center select-all">
                  {newRecoveryPackage.recoveryCode}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(newRecoveryPackage.recoveryCode);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 3000);
                  }}
                  className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-cyan-500/40 text-zinc-300 hover:text-white cursor-pointer"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCompleteAndSignIn}
              className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-600 hover:from-cyan-300 hover:to-blue-500 text-white font-bold text-xs tracking-wider shadow-[0_0_20px_rgba(6,182,212,0.4)] flex items-center justify-center gap-2 cursor-pointer mt-4"
            >
              <span>Access Admin Command Center</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
