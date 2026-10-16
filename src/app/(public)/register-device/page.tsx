'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Smartphone, 
  Laptop, 
  Fingerprint, 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  ArrowRight, 
  Key, 
  Hexagon, 
  Lock,
  Globe,
  Cpu
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { detectDeviceMetadata, registerWebAuthnPasskey } from '@/lib/crypto/clientWebAuthn';

function RegisterDeviceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCode = searchParams.get('code') || searchParams.get('t') || '';

  // Steps: 1: ENTER_CODE -> 2: NAME_DEVICE -> 3: WEBAUTHN_AUTH -> 4: PASSPORT_READY
  const [step, setStep] = React.useState<1 | 2 | 3 | 4>(1);

  // Form State
  const [code, setCode] = React.useState(initialCode);
  const [loading, setLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Verified Enrollment State
  const [verifiedEnrollment, setVerifiedEnrollment] = React.useState<{
    id: string;
    positionName: string;
    expiresAt: string;
    targetDeviceType?: string;
    user: { id: string; name: string; email: string; role: string; position: string };
  } | null>(null);

  // Detected Hardware State
  const [deviceMetadata, setDeviceMetadata] = React.useState({
    deviceType: 'laptop' as 'laptop' | 'phone' | 'tablet' | 'desktop' | 'terminal',
    os: 'macOS',
    browser: 'Chrome',
    browserVersion: '128.0',
    model: 'MacBook Pro',
    region: 'Punjab, India',
    suggestedName: 'Primary Workstation',
  });
  const [deviceName, setDeviceName] = React.useState('');

  // Issued Passport State
  const [issuedPassport, setIssuedPassport] = React.useState<any>(null);

  // Initialize hardware detection on mount
  React.useEffect(() => {
    const meta = detectDeviceMetadata();
    setDeviceMetadata(meta);
  }, []);

  const verifyCode = React.useCallback(async (codeToVerify: string) => {
    const clean = codeToVerify.trim();
    if (!clean) return;

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/devices/enrollment/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: clean }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to verify enrollment code');

      setVerifiedEnrollment({
        id: data.enrollment.id,
        positionName: data.enrollment.positionName,
        expiresAt: data.enrollment.expiresAt,
        targetDeviceType: data.enrollment.targetDeviceType,
        user: data.user,
      });

      // Default device name: e.g. "Vasu — Primary MacBook"
      const meta = detectDeviceMetadata();
      const defaultName = `${data.user.name.split(' ')[0]} — Primary ${meta.model}`;
      setDeviceName(defaultName);

      setStep(2);
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid or expired enrollment code');
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-verify if code passed via URL
  React.useEffect(() => {
    if (initialCode && step === 1) {
      verifyCode(initialCode);
    }
  }, [initialCode, step, verifyCode]);

  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    verifyCode(code);
  };

  const handleDeviceNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceName.trim()) return;
    setStep(3);
    performWebAuthnRegistration();
  };

  const performWebAuthnRegistration = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      // 1. Trigger WebAuthn platform passkey / hardware enclave key generation
      const webauthnRes = await registerWebAuthnPasskey(
        deviceName.trim(),
        verifiedEnrollment?.user.email
      );

      // 2. Register with server
      const completeRes = await fetch('/api/devices/enrollment/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enrollmentCode: code.trim().toUpperCase(),
          deviceName: deviceName.trim(),
          publicKey: webauthnRes.publicKeySpki,
          deviceId: webauthnRes.clientDevice.deviceId,
          deviceType: deviceMetadata.deviceType,
          os: deviceMetadata.os,
          browser: deviceMetadata.browser,
          browserVersion: deviceMetadata.browserVersion,
          model: deviceMetadata.model,
          region: deviceMetadata.region,
          credentialId: webauthnRes.credentialId,
          credentialType: webauthnRes.credentialType,
        }),
      });

      const completeData = await completeRes.json();
      if (!completeRes.ok) throw new Error(completeData.error || 'Registration failed');

      setIssuedPassport(completeData.passport || completeData.device);
      setStep(4);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to complete WebAuthn device registration');
      setStep(2);
    } finally {
      setLoading(false);
    }
  };

  const handleProceedToWorkspace = () => {
    if (verifiedEnrollment?.user.role === 'ADMIN') {
      router.push('/dashboard/admin');
    } else if (verifiedEnrollment?.user.role === 'AUDITOR') {
      router.push('/dashboard/auditor');
    } else {
      router.push('/assets');
    }
  };

  return (
    <div className="min-h-[100dvh] w-full bg-[#07090e] text-zinc-100 font-sans selection:bg-cyan-500/30 relative flex flex-col justify-between overflow-x-hidden p-6">
      
      {/* High-Tech Backgrounds */}
      <div 
        className="fixed inset-0 bg-cover bg-center opacity-30 pointer-events-none z-0"
        style={{ backgroundImage: "url('/hero-bg.jpg')" }}
      />
      <div className="fixed inset-0 bg-gradient-to-t from-[#07090e] via-[#07090e]/90 to-transparent pointer-events-none z-0" />

      {/* Header */}
      <header className="relative z-10 w-full max-w-4xl mx-auto flex items-center justify-between py-4">
        <div className="flex items-center gap-3">
          <Hexagon className="h-8 w-8 text-cyan-400 stroke-[2.2] drop-shadow-[0_0_12px_rgba(6,182,212,0.6)]" />
          <div className="flex flex-col">
            <span className="text-xl font-black tracking-tight text-white flex items-center">
              Secure<span className="text-cyan-400">MAX</span>
            </span>
            <span className="text-[8px] font-mono tracking-[0.25em] text-zinc-400 uppercase -mt-0.5">
              DEVICE PASSPORT ENROLLMENT
            </span>
          </div>
        </div>

        <div className="border border-cyan-500/40 bg-cyan-950/30 px-3.5 py-1 rounded-full text-cyan-300 font-mono text-[11px] flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
          ZERO-TRUST HARDWARE BINDING
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 w-full max-w-xl mx-auto flex-1 flex items-center justify-center my-8">
        <div className="w-full bg-[#0a0f18]/90 backdrop-blur-2xl border border-cyan-500/35 rounded-[2.2rem] p-7 sm:p-9 shadow-[0_0_60px_rgba(6,182,212,0.2)]">
          
          {/* STEP 1: ENTER ENROLLMENT CODE */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mx-auto shadow-[0_0_15px_rgba(6,182,212,0.3)]">
                  <Key className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold text-white tracking-tight">
                  Register This Device
                </h2>
                <p className="text-xs text-zinc-400 font-light max-w-sm mx-auto">
                  Enter the 15-minute security code issued by your organization administrator.
                </p>
              </div>

              <form onSubmit={handleCodeSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-mono tracking-widest text-zinc-400 uppercase block">
                    Security Enrollment Code
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="7K4M-92QP-8X2L"
                    required
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm font-mono font-bold text-cyan-300 tracking-widest text-center uppercase focus:outline-none focus:border-cyan-400 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)]"
                  />
                  <p className="text-[10px] text-zinc-500 font-mono text-center">
                    Cryptographic one-time capability • Valid for 15 minutes
                  </p>
                </div>

                {errorMessage && (
                  <div className="p-3 bg-red-950/40 border border-red-500/40 rounded-xl text-red-400 text-xs font-mono flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading || !code.trim()}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-600 hover:from-cyan-300 hover:to-blue-500 text-white font-bold text-xs tracking-wider shadow-[0_0_25px_rgba(6,182,212,0.4)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                  CONTINUE
                </Button>
              </form>

              <div className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-500/20 text-xs text-zinc-400 font-light leading-relaxed">
                💡 <strong>Zero Password Architecture</strong>: The administrator does not assign you a password. Your device generates an independent cryptographic key pair inside its local hardware authenticator.
              </div>
            </div>
          )}

          {/* STEP 2: NAME YOUR DEVICE */}
          {step === 2 && verifiedEnrollment && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mx-auto shadow-[0_0_15px_rgba(6,182,212,0.3)]">
                  <Laptop className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold text-white tracking-tight">
                  Name Your Device
                </h2>
                <p className="text-xs text-zinc-400 font-light">
                  This name will be visible in your security and audit history.
                </p>
              </div>

              {/* Enrollment Context Badge */}
              <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800 text-xs font-mono flex items-center justify-between">
                <div>
                  <span className="text-zinc-500 block text-[10px]">RECIPIENT IDENTITY</span>
                  <span className="text-zinc-200 font-bold">{verifiedEnrollment.user.name}</span>
                </div>
                <div className="text-right">
                  <span className="text-zinc-500 block text-[10px]">POSITION</span>
                  <span className="text-cyan-400 font-bold">{verifiedEnrollment.positionName}</span>
                </div>
              </div>

              {/* Target Device Policy Badge */}
              {verifiedEnrollment.targetDeviceType && verifiedEnrollment.targetDeviceType !== 'any' && (
                <div className="p-3 rounded-xl border border-cyan-500/30 bg-cyan-950/20 text-xs font-mono flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span className="text-zinc-300">Policy Binding:</span>
                  </div>
                  <span className="text-cyan-300 font-bold uppercase">{verifiedEnrollment.targetDeviceType} ONLY</span>
                </div>
              )}

              {/* Device Mismatch Warning */}
              {verifiedEnrollment.targetDeviceType && 
               verifiedEnrollment.targetDeviceType !== 'any' && 
               deviceMetadata.deviceType.toLowerCase() !== verifiedEnrollment.targetDeviceType.toLowerCase() && (
                <div className="p-3 bg-amber-950/40 border border-amber-500/40 rounded-xl text-amber-300 text-xs font-mono flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                  <div>
                    <span className="font-bold">Device Binding Mismatch:</span> This enrollment capability is strictly bound to <strong>{verifiedEnrollment.targetDeviceType.toUpperCase()}</strong> devices. Your detected device is <strong>{deviceMetadata.deviceType.toUpperCase()}</strong>.
                  </div>
                </div>
              )}

              <form onSubmit={handleDeviceNameSubmit} className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-[11px] text-zinc-400">
                    <span>Device Detected:</span>
                    <span className="text-cyan-400 font-semibold">{deviceMetadata.model} ({deviceMetadata.os})</span>
                  </div>
                  <input
                    type="text"
                    value={deviceName}
                    onChange={(e) => setDeviceName(e.target.value)}
                    placeholder="e.g. Vasu — Primary MacBook"
                    required
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-100 focus:outline-none focus:border-cyan-400"
                  />
                  <div className="text-[10px] text-zinc-500 font-mono space-y-0.5 pt-1">
                    <div>Examples:</div>
                    <div className="text-zinc-400">• Vasu — Work Laptop &nbsp;• Vasu — Personal Phone &nbsp;• Ritik — Engineering Laptop</div>
                  </div>
                </div>

                {/* Privacy-conscious Metadata Preview */}
                <div className="grid grid-cols-2 gap-2 bg-zinc-950/60 p-3 rounded-xl border border-zinc-800/80 text-[11px] font-mono">
                  <div className="text-zinc-400 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Region:</span>
                  </div>
                  <div className="text-zinc-200 text-right">{deviceMetadata.region}</div>

                  <div className="text-zinc-400 flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Authenticator:</span>
                  </div>
                  <div className="text-cyan-400 text-right">WebAuthn / Passkey</div>
                </div>

                {errorMessage && (
                  <div className="p-3 bg-red-950/40 border border-red-500/40 rounded-xl text-red-400 text-xs font-mono flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={
                    loading || 
                    !deviceName.trim() || 
                    Boolean(
                      verifiedEnrollment.targetDeviceType && 
                      verifiedEnrollment.targetDeviceType !== 'any' && 
                      deviceMetadata.deviceType.toLowerCase() !== verifiedEnrollment.targetDeviceType.toLowerCase()
                    )
                  }
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-600 hover:from-cyan-300 hover:to-blue-500 text-white font-bold text-xs tracking-wider shadow-[0_0_25px_rgba(6,182,212,0.4)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Fingerprint className="w-4 h-4" />
                  AUTHENTICATE &amp; REGISTER DEVICE
                </Button>
              </form>
            </div>
          )}

          {/* STEP 3: WEBAUTHN / BIOMETRIC PROMPT */}
          {step === 3 && (
            <div className="text-center space-y-6 py-6 animate-in fade-in">
              <div className="relative flex items-center justify-center w-20 h-20 mx-auto">
                <div className="absolute inset-0 rounded-full border-2 border-cyan-400 animate-ping opacity-25"></div>
                <div className="w-16 h-16 rounded-2xl bg-cyan-950/60 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-[0_0_25px_rgba(6,182,212,0.5)]">
                  <Fingerprint className="w-8 h-8 animate-pulse" />
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-bold text-white tracking-tight">
                  Authenticate With Your Device
                </h3>
                <p className="text-xs text-zinc-400 max-w-sm mx-auto font-light">
                  Use Touch ID, Face ID, Windows Hello, or device PIN to create your hardware cryptographic credential.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 text-[11px] font-mono text-zinc-400 space-y-1 text-left max-w-md mx-auto">
                <div className="text-emerald-400 font-bold flex items-center gap-1.5 mb-1">
                  <ShieldCheck className="w-4 h-4" />
                  Hardware-Enclave Security Guarantee
                </div>
                <div>• Fingerprint, Face ID, and PIN NEVER leave your device.</div>
                <div>• Only the cryptographic public key is transmitted to SecureMAX.</div>
              </div>

              <div className="flex items-center justify-center gap-2 text-xs font-mono text-cyan-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Waiting for platform authenticator response...</span>
              </div>
            </div>
          )}

          {/* STEP 4: PASSPORT ISSUED SUCCESS */}
          {step === 4 && issuedPassport && (
            <div className="space-y-6 animate-in fade-in">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold text-white tracking-tight">
                  Device Passport Created
                </h2>
                <p className="text-xs text-zinc-400 font-light">
                  Your device is cryptographically enrolled and authorized.
                </p>
              </div>

              {/* DEVICE PASSPORT CARD */}
              <div className="bg-[#050810] border border-cyan-500/40 rounded-2xl p-5 font-mono text-xs space-y-3.5 shadow-[0_0_30px_rgba(6,182,212,0.15)] relative overflow-hidden">
                <div className="flex justify-between items-center pb-2 border-b border-zinc-800">
                  <span className="text-[10px] tracking-widest text-cyan-400 font-bold uppercase">SECUREMAX DEVICE PASSPORT</span>
                  <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 bg-emerald-950/30 text-[9px]">
                    ● TRUSTED
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-y-2.5 text-[11px]">
                  <div>
                    <span className="text-zinc-500 block text-[9px] uppercase">User Identity</span>
                    <span className="text-zinc-200 font-bold">{verifiedEnrollment?.user.name}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[9px] uppercase">Position</span>
                    <span className="text-cyan-400 font-bold">{verifiedEnrollment?.positionName}</span>
                  </div>

                  <div>
                    <span className="text-zinc-500 block text-[9px] uppercase">Device Name</span>
                    <span className="text-zinc-200 font-semibold">{issuedPassport.device_name || issuedPassport.name}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[9px] uppercase">Platform</span>
                    <span className="text-zinc-300">{deviceMetadata.os} • {deviceMetadata.browser}</span>
                  </div>

                  <div>
                    <span className="text-zinc-500 block text-[9px] uppercase">Registration Region</span>
                    <span className="text-zinc-300">{deviceMetadata.region}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[9px] uppercase">Credential Type</span>
                    <span className="text-cyan-400">WebAuthn / Passkey</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-800/80 text-[10px] text-zinc-500 flex justify-between">
                  <span>STATUS: ACTIVE</span>
                  <span>ENCLAVE: ECDSA P-256</span>
                </div>
              </div>

              <Button
                onClick={handleProceedToWorkspace}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-500 hover:from-emerald-300 hover:to-cyan-400 text-zinc-950 font-bold text-xs tracking-wider shadow-[0_0_25px_rgba(16,185,129,0.35)] flex items-center justify-center gap-2 cursor-pointer"
              >
                PROCEED TO SECUREMAX WORKSPACE
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          )}

        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-4xl mx-auto py-4 border-t border-zinc-800/60 text-center text-[10px] font-mono text-zinc-500 tracking-wider">
        SECUREMAX ZERO-TRUST DEVICE FABRIC • HARDWARE ATTESTATION COMPLETE
      </footer>

    </div>
  );
}

export default function RegisterDevicePage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-400 font-mono text-xs">
          <Loader2 className="w-5 h-5 animate-spin mr-2 text-cyan-400" />
          INITIALIZING DEVICE ATTESTATION ENVIRONMENT...
        </div>
      }
    >
      <RegisterDeviceContent />
    </React.Suspense>
  );
}
