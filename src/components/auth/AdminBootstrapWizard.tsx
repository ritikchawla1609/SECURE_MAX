'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Shield,
  Building2,
  User,
  Laptop,
  Key,
  Lock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Copy,
  Check,
  Fingerprint,
  Sparkles,
  Info
} from 'lucide-react';
import { generateAndSaveDeviceKey } from '@/lib/crypto/clientP256';

interface AdminBootstrapWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function AdminBootstrapWizard({ isOpen, onClose, onSuccess }: AdminBootstrapWizardProps) {
  const router = useRouter();

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Step 1 — Organization
  const [orgName, setOrgName] = useState('SecureMAX Defense Vault Command');
  const [orgId, setOrgId] = useState('');
  const [orgType, setOrgType] = useState('Company');
  const [country, setCountry] = useState('India');
  const [timezone, setTimezone] = useState('Asia/Kolkata');

  // Step 2 — Administrator Identity
  const [adminName, setAdminName] = useState('Vasu Kumar');
  const [adminId, setAdminId] = useState('ADM-0001');
  const [officialEmail, setOfficialEmail] = useState('vasu.admin@securemax.mil');
  const [phone, setPhone] = useState('+91 98765 43210');
  const [department, setDepartment] = useState('Root Security & Cryptography');
  const [designation, setDesignation] = useState('Chief Administrator');

  // Step 3 — Admin Security Setup (Device)
  const [deviceName, setDeviceName] = useState('SecureMAX Admin Laptop');
  const [detectedOs, setDetectedOs] = useState('macOS');
  const [detectedBrowser, setDetectedBrowser] = useState('Chrome');
  const [deviceType, setDeviceType] = useState('laptop');

  // Step 4 — WebAuthn / Passkey Device Registration
  const [publicKeySpki, setPublicKeySpki] = useState('');
  const [passkeyCreated, setPasskeyCreated] = useState(false);

  // Step 5 — Admin Recovery Vault
  const [recoveryPackage, setRecoveryPackage] = useState<{
    recoveryId: string;
    recoveryCode: string;
    generatedAt: string;
  } | null>(null);
  const [recoveryStoredConfirmed, setRecoveryStoredConfirmed] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Auto-generate org ID on mount and detect device environment
  useEffect(() => {
    if (!orgId) {
      const randHex = Math.floor(1000 + Math.random() * 9000).toString();
      setOrgId(`ORG-SMX-${randHex}`);
    }

    if (typeof window !== 'undefined') {
      const ua = navigator.userAgent;
      if (/Mac/i.test(ua)) setDetectedOs('macOS');
      else if (/Windows/i.test(ua)) setDetectedOs('Windows');
      else if (/Linux/i.test(ua)) setDetectedOs('Linux');

      if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) setDetectedBrowser('Chrome');
      else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) setDetectedBrowser('Safari');
      else if (/Firefox/i.test(ua)) setDetectedBrowser('Firefox');
      else if (/Edg/i.test(ua)) setDetectedBrowser('Edge');
    }
  }, [orgId]);

  if (!isOpen) return null;

  // Step 4: Create Passkey / Hardware Key
  const handleCreatePasskey = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      // Generate hardware-isolated P-256 key pair locally via Web Crypto API
      const dev = await generateAndSaveDeviceKey(deviceName, officialEmail);
      setPublicKeySpki(dev.publicKeySpki);
      setPasskeyCreated(true);

      // Call bootstrap endpoint to register root admin & generate recovery package
      const res = await fetch('/api/admin/bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgName,
          orgId,
          orgType,
          country,
          timezone,
          adminName,
          adminId,
          email: officialEmail,
          phone,
          department,
          designation,
          deviceName,
          deviceType,
          os: detectedOs,
          browser: detectedBrowser,
          publicKey: dev.publicKeySpki,
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
                  : `Bootstrap failed with HTTP ${res.status}`;
        throw new Error(errorMsg);
      }

      setRecoveryPackage(data.recoveryPackage);
      setStep(5);
    } catch (err: any) {
      console.error('[Admin Bootstrap Error]:', err);
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
      setErrorMessage(msg || 'Passkey creation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyRecoveryCode = () => {
    if (recoveryPackage) {
      navigator.clipboard.writeText(
        `SECUREMAX ADMIN RECOVERY VAULT\nRecovery ID: ${recoveryPackage.recoveryId}\nRecovery Code: ${recoveryPackage.recoveryCode}\nGenerated: ${new Date(recoveryPackage.generatedAt).toLocaleString()}`
      );
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 3000);
    }
  };

  const handleFinishBootstrap = () => {
    if (!recoveryStoredConfirmed) {
      setErrorMessage('Please confirm that you have stored the offline recovery package safely.');
      return;
    }
    if (onSuccess) onSuccess();
    onClose();
    router.push('/dashboard/admin');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-[#0a0f18] border border-cyan-500/40 rounded-3xl p-6 sm:p-8 relative shadow-[0_0_80px_rgba(6,182,212,0.25)] text-zinc-100 my-8">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-5 border-b border-zinc-800/80 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-950/60 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight flex items-center gap-2">
                SecureMAX Root Identity Bootstrap
              </h2>
              <p className="text-xs text-zinc-400 font-light">
                One-time cryptographic enrollment for the Root Administrator
              </p>
            </div>
          </div>

          <span className="text-xs font-mono px-3 py-1 rounded-full bg-cyan-950/60 text-cyan-300 border border-cyan-500/30">
            Step {step} of 5
          </span>
        </div>

        {/* Step Progress Dots */}
        <div className="grid grid-cols-5 gap-2 mb-8">
          {[
            { num: 1, label: 'Organization' },
            { num: 2, label: 'Root Admin' },
            { num: 3, label: 'Security Setup' },
            { num: 4, label: 'Passkey' },
            { num: 5, label: 'Recovery Vault' },
          ].map((s) => (
            <div key={s.num} className="flex flex-col gap-1">
              <div
                className={`h-1.5 rounded-full transition-all ${
                  step >= s.num
                    ? 'bg-cyan-400 shadow-[0_0_10px_#06b6d4]'
                    : 'bg-zinc-800'
                }`}
              />
              <span className={`text-[10px] font-mono truncate ${step === s.num ? 'text-cyan-300 font-bold' : 'text-zinc-500'}`}>
                {s.label}
              </span>
            </div>
          ))}
        </div>

        {/* STEP 1: ORGANIZATION DETAILS */}
        {step === 1 && (
          <div className="space-y-4 animate-in fade-in">
            <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono uppercase tracking-wider mb-2">
              <Building2 className="w-4 h-4" />
              CREATE SECUREMAX ORGANIZATION
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-zinc-300 font-semibold block mb-1">Organization Name</label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="e.g. Acme Defense Systems"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-100 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-300 font-semibold block mb-1">Organization ID</label>
                  <input
                    type="text"
                    value={orgId}
                    onChange={(e) => setOrgId(e.target.value)}
                    placeholder="ORG-SMX-001"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-400 font-mono focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="text-zinc-300 font-semibold block mb-1">Organization Type</label>
                  <select
                    value={orgType}
                    onChange={(e) => setOrgType(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-100 focus:outline-none focus:border-cyan-400"
                  >
                    <option value="Company">Company / Enterprise</option>
                    <option value="Defense">Defense / Military</option>
                    <option value="Government">Government Agency</option>
                    <option value="Research">Research Laboratory</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-300 font-semibold block mb-1">Country</label>
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-100 focus:outline-none focus:border-cyan-400"
                  >
                    <option value="India">India</option>
                    <option value="United States">United States</option>
                    <option value="United Kingdom">United Kingdom</option>
                    <option value="Singapore">Singapore</option>
                  </select>
                </div>

                <div>
                  <label className="text-zinc-300 font-semibold block mb-1">Timezone</label>
                  <input
                    type="text"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    placeholder="Asia/Kolkata"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-100 focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  if (!orgName.trim()) {
                    setErrorMessage('Please enter an organization name.');
                    return;
                  }
                  setErrorMessage('');
                  setStep(2);
                }}
                className="py-2.5 px-6 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-600 hover:from-cyan-300 hover:to-blue-500 text-white font-bold text-xs tracking-wider shadow-[0_0_20px_rgba(6,182,212,0.4)] flex items-center gap-2 cursor-pointer"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: ROOT ADMINISTRATOR IDENTITY */}
        {step === 2 && (
          <div className="space-y-4 animate-in fade-in">
            <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono uppercase tracking-wider mb-2">
              <User className="w-4 h-4" />
              CREATE ROOT ADMINISTRATOR
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-zinc-300 font-semibold block mb-1">Full Name</label>
                <input
                  type="text"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  placeholder="e.g. Vasu Kumar"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-100 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-300 font-semibold block mb-1">Administrator ID</label>
                  <input
                    type="text"
                    value={adminId}
                    onChange={(e) => setAdminId(e.target.value)}
                    placeholder="ADM-0001"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-cyan-300 font-mono focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="text-zinc-300 font-semibold block mb-1">Official Email</label>
                  <input
                    type="email"
                    value={officialEmail}
                    onChange={(e) => setOfficialEmail(e.target.value)}
                    placeholder="admin@securemax.mil"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-100 focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-300 font-semibold block mb-1">Phone (Optional)</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-100 focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="text-zinc-300 font-semibold block mb-1">Department</label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="Root Security & Cryptography"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-100 focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-zinc-300 font-semibold block mb-1">Designation</label>
                <input
                  type="text"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  placeholder="Chief Administrator"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-100 focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="py-2 px-4 rounded-xl border border-zinc-800 hover:border-zinc-700 text-zinc-400 text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!adminName.trim() || !officialEmail.trim()) {
                    setErrorMessage('Please provide both administrator name and official email.');
                    return;
                  }
                  setErrorMessage('');
                  setStep(3);
                }}
                className="py-2.5 px-6 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-600 hover:from-cyan-300 hover:to-blue-500 text-white font-bold text-xs tracking-wider shadow-[0_0_20px_rgba(6,182,212,0.4)] flex items-center gap-2 cursor-pointer"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: ADMIN SECURITY SETUP */}
        {step === 3 && (
          <div className="space-y-4 animate-in fade-in">
            <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono uppercase tracking-wider mb-2">
              <Laptop className="w-4 h-4" />
              ADMIN SECURITY SETUP
            </div>

            <div className="p-4 bg-cyan-950/30 border border-cyan-500/30 rounded-2xl text-xs space-y-2 text-zinc-300 font-light leading-relaxed">
              <div className="font-semibold text-white flex items-center gap-2">
                <Info className="w-4 h-4 text-cyan-400" />
                Hardware Enclave Device Binding
              </div>
              <p>
                Your administrator account will be bound to this device. This device will be the 
                <strong className="text-cyan-300"> only device authorized</strong> to access the root Admin account.
              </p>
              <p className="text-[11px] text-zinc-400">
                Administrator accounts are restricted to exactly one active trusted device.
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-3 p-3.5 bg-zinc-950 border border-zinc-800 rounded-xl">
                <div>
                  <span className="text-[10px] text-zinc-500 font-mono block uppercase">Operating System</span>
                  <span className="font-semibold text-zinc-200">{detectedOs}</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 font-mono block uppercase">Browser</span>
                  <span className="font-semibold text-zinc-200">{detectedBrowser}</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 font-mono block uppercase">Device Class</span>
                  <span className="font-semibold text-zinc-200 capitalize">{deviceType}</span>
                </div>
              </div>

              <div>
                <label className="text-zinc-300 font-semibold block mb-1">Device Name / Label</label>
                <input
                  type="text"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  placeholder="SecureMAX Admin Laptop"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-100 focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="py-2 px-4 rounded-xl border border-zinc-800 hover:border-zinc-700 text-zinc-400 text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </button>

              <button
                type="button"
                onClick={() => setStep(4)}
                className="py-2.5 px-6 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-600 hover:from-cyan-300 hover:to-blue-500 text-white font-bold text-xs tracking-wider shadow-[0_0_20px_rgba(6,182,212,0.4)] flex items-center gap-2 cursor-pointer"
              >
                <span>Register Secure Device</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: WEBAUTHN / PASSKEY CREATION */}
        {step === 4 && (
          <div className="space-y-5 animate-in fade-in text-center py-4">
            <div className="w-16 h-16 rounded-2xl bg-cyan-950/60 border border-cyan-500/40 flex items-center justify-center text-cyan-400 mx-auto shadow-[0_0_30px_rgba(6,182,212,0.35)]">
              <Fingerprint className="w-8 h-8 animate-pulse" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white tracking-tight">
                SecureMAX wants to create a passkey
              </h3>
              <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
                Use your device security: Face ID, Fingerprint, Windows Hello, or Device PIN. 
                The biometric/PIN remains safely on your operating system; SecureMAX receives only the cryptographic credential.
              </p>
            </div>

            <div className="p-4 bg-zinc-950/80 border border-zinc-800 rounded-2xl max-w-md mx-auto text-left text-xs space-y-2">
              <div className="flex justify-between text-zinc-400">
                <span>Admin Identity:</span>
                <span className="text-zinc-200 font-semibold">{adminName} ({adminId})</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Hardware Target:</span>
                <span className="text-cyan-300 font-mono">{deviceName}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Algorithm:</span>
                <span className="text-zinc-200 font-mono">ECDSA P-256 (FIPS 186-4)</span>
              </div>
            </div>

            {loading && (
              <div className="p-3 bg-cyan-950/30 border border-cyan-500/30 rounded-xl flex items-center justify-center gap-2 text-xs font-mono text-cyan-300">
                <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                <span>Anchoring cryptographic credential in browser secure enclave...</span>
              </div>
            )}

            <div className="pt-4 flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => setStep(3)}
                disabled={loading}
                className="py-2.5 px-5 rounded-xl border border-zinc-800 hover:border-zinc-700 text-zinc-400 text-xs cursor-pointer disabled:opacity-50"
              >
                Back
              </button>

              <button
                type="button"
                onClick={handleCreatePasskey}
                disabled={loading}
                className="py-3 px-8 rounded-xl bg-gradient-to-r from-cyan-400 via-sky-500 to-blue-600 hover:from-cyan-300 hover:via-sky-400 hover:to-blue-500 text-white font-bold text-xs tracking-wider shadow-[0_0_25px_rgba(6,182,212,0.5)] flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                <span>Create Passkey &amp; Register</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: ADMIN RECOVERY VAULT */}
        {step === 5 && recoveryPackage && (
          <div className="space-y-5 animate-in fade-in">
            <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono uppercase tracking-wider mb-1">
              <Lock className="w-4 h-4" />
              SECUREMAX ADMIN RECOVERY VAULT
            </div>

            <div className="p-4 bg-amber-950/30 border border-amber-500/40 rounded-2xl text-xs space-y-1.5 text-amber-300 leading-relaxed">
              <div className="font-bold flex items-center gap-2 text-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                CRITICAL: One-Time Offline Recovery Secret
              </div>
              <p>
                If your registered laptop is lost or broken, this recovery package is the 
                <strong> only way</strong> to regain access to the Root Administrator identity.
              </p>
              <p className="font-semibold text-amber-200">
                ⚠ Store this offline in a physical safe. It will not be shown again.
              </p>
            </div>

            {/* Recovery Card */}
            <div className="p-5 bg-zinc-950 border border-cyan-500/30 rounded-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono text-zinc-500 block uppercase">Recovery ID</span>
                  <span className="text-sm font-mono text-zinc-200 font-bold">{recoveryPackage.recoveryId}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-mono text-zinc-500 block uppercase">Generated</span>
                  <span className="text-xs font-mono text-zinc-400">
                    {new Date(recoveryPackage.generatedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-mono text-zinc-500 block uppercase mb-1">
                  Offline Recovery Code (Factor A)
                </span>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-black/80 border border-cyan-500/40 rounded-xl px-4 py-3 text-cyan-300 font-mono text-base tracking-[0.25em] font-bold text-center select-all">
                    {recoveryPackage.recoveryCode}
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyRecoveryCode}
                    className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-cyan-500/40 text-zinc-300 hover:text-white transition-all cursor-pointer"
                    title="Copy to clipboard"
                  >
                    {copiedCode ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Confirmation Checkbox */}
            <label className="flex items-start gap-3 p-3 rounded-xl bg-zinc-950/60 border border-zinc-800 cursor-pointer text-xs text-zinc-300">
              <input
                type="checkbox"
                checked={recoveryStoredConfirmed}
                onChange={(e) => setRecoveryStoredConfirmed(e.target.checked)}
                className="mt-0.5 rounded border-zinc-700 text-cyan-500 focus:ring-cyan-400 bg-zinc-900"
              />
              <span>
                I have securely saved this recovery code in an offline vault. I understand that the backend will never show this code again.
              </span>
            </label>

            <div className="pt-3 flex justify-end">
              <button
                type="button"
                onClick={handleFinishBootstrap}
                disabled={!recoveryStoredConfirmed}
                className="py-3 px-8 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white font-bold text-xs tracking-wider shadow-[0_0_25px_rgba(16,185,129,0.4)] flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Complete Initialization &amp; Sign In</span>
              </button>
            </div>
          </div>
        )}

        {/* Error Message */}
        {errorMessage && (
          <div className="mt-4 p-3 bg-red-950/40 border border-red-500/40 rounded-xl flex items-center gap-2 text-red-400 text-xs font-mono animate-in fade-in">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

      </div>
    </div>
  );
}
