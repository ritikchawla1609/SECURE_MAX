'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Fingerprint, 
  Lock, 
  Database, 
  Mail, 
  Eye, 
  EyeOff, 
  QrCode, 
  Key, 
  User, 
  Shield, 
  Hexagon, 
  ArrowRight, 
  Loader2, 
  CheckCircle2, 
  AlertTriangle,
  X,
  Laptop,
  Sparkles,
  ShieldCheck,
  UserPlus,
  Briefcase,
  Settings,
  Wallet
} from 'lucide-react';
import { 
  getOrCreateLocalDeviceKey, 
  signChallengeWithLocalKey, 
  generateAndSaveDeviceKey,
  ClientDeviceInfo 
} from '@/lib/crypto/clientP256';
import SecureMaxChainIntro from '@/components/ui/SecureMaxChainIntro';
import AdminBootstrapWizard from '@/components/auth/AdminBootstrapWizard';
import EmergencyRecoveryModal from '@/components/auth/EmergencyRecoveryModal';

export default function SecureMaxHeroLogin() {
  const router = useRouter();

  // State-Aware System State (Admin Count = 0 vs 1)
  const [systemInitialized, setSystemInitialized] = useState<boolean>(true);
  const [isCheckingBootstrap, setIsCheckingBootstrap] = useState<boolean>(true);
  const [adminCount, setAdminCount] = useState<number>(1);
  const [showBootstrapWizard, setShowBootstrapWizard] = useState<boolean>(false);
  const [showRecoveryModal, setShowRecoveryModal] = useState<boolean>(false);

  // Cinematic Intro State
  const [showIntro, setShowIntro] = useState(false);

  useEffect(() => {
    // Show cinematic intro once on initial page entry
    if (typeof window !== 'undefined') {
      const hasSeen = sessionStorage.getItem('securemax_intro_shown');
      if (!hasSeen) {
        setShowIntro(true);
        sessionStorage.setItem('securemax_intro_shown', 'true');
      }
    }
  }, []);

  // Check initialization status on mount
  const checkBootstrapState = async () => {
    try {
      const res = await fetch('/api/admin/bootstrap', { cache: 'no-store' });
      if (res.ok) {
        const d = await res.json();
        setSystemInitialized(Boolean(d.initialized));
        setAdminCount(typeof d.adminCount === 'number' ? d.adminCount : (d.initialized ? 1 : 0));
      }
    } catch (e) {
      console.error('Failed to check bootstrap status', e);
    } finally {
      setIsCheckingBootstrap(false);
    }
  };

  useEffect(() => {
    checkBootstrapState();
  }, []);

  // Auth Mode: Admin (MetaMask) vs Team Member (P-256) vs Device Enrollment (15-Min Code)
  const [authMode, setAuthMode] = useState<'ADMIN_METAMASK' | 'TEAM_MEMBER' | 'ENROLL_DEVICE'>('TEAM_MEMBER');

  const [email, setEmail] = useState('');

  // MetaMask Detection & Status
  const [hasMetaMask, setHasMetaMask] = useState<boolean>(false);
  const [metaMaskAccount, setMetaMaskAccount] = useState<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const eth = (window as any).ethereum;
      if (eth) {
        setHasMetaMask(true);
        // Check if already connected
        eth.request({ method: 'eth_accounts' })
          .then((accounts: string[]) => {
            if (accounts && accounts.length > 0) {
              setMetaMaskAccount(accounts[0]);
            }
          })
          .catch(() => {});
      }
    }
  }, []);

  // Self-Registration / Enrollment State
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regRole, setRegRole] = useState<'USER' | 'MANAGER' | 'AUDITOR'>('USER');
  const [regDeviceName, setRegDeviceName] = useState('Primary Workstation');

  // Verified Enrollment Capability State
  const [verifiedCapability, setVerifiedCapability] = useState<{
    id: string;
    positionName: string;
    expiresAt: string;
    user?: { id: string; name: string; email: string; role: string; position: string } | null;
  } | null>(null);
  const [codeVerifying, setCodeVerifying] = useState(false);

  const handleVerifyEnrollCode = async (inputCode: string) => {
    const clean = inputCode.trim().toUpperCase();
    if (clean.replace(/[^A-Z0-9]/g, '').length < 8) {
      setVerifiedCapability(null);
      return;
    }

    setCodeVerifying(true);
    setErrorMessage('');

    try {
      const res = await fetch('/api/devices/enrollment/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: clean }),
      });
      const data = await res.json();
      if (!res.ok) {
        setVerifiedCapability(null);
        setErrorMessage(data.error || 'Invalid or expired enrollment code');
        return;
      }

      setVerifiedCapability({
        id: data.enrollment.id,
        positionName: data.enrollment.positionName,
        expiresAt: data.enrollment.expiresAt,
        user: data.user,
      });

      if (data.user?.name) setRegName(data.user.name);
      if (data.user?.email) setRegEmail(data.user.email);

      // Lock role to the position from the enrollment code
      if (data.user?.role) {
        setRegRole(data.user.role as any);
      } else if (data.enrollment?.positionName) {
        const pName = data.enrollment.positionName.toUpperCase();
        if (pName.includes('MANAGER')) setRegRole('MANAGER');
        else if (pName.includes('AUDITOR')) setRegRole('AUDITOR');
        else setRegRole('USER');
      }
    } catch (e: any) {
      setVerifiedCapability(null);
      setErrorMessage(e.message || 'Failed to verify code');
    } finally {
      setCodeVerifying(false);
    }
  };

  // Auth Status
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [deviceInfo, setDeviceInfo] = useState<ClientDeviceInfo | null>(null);

  // Enrollment Modal
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [enrollCode, setEnrollCode] = useState('');
  const [enrollDeviceName, setEnrollDeviceName] = useState('Secondary Mobile Device');
  const [enrollLoading, setEnrollLoading] = useState(false);
  const [enrollSuccess, setEnrollSuccess] = useState(false);

  // Initialize or discover client P-256 key on mount
  useEffect(() => {
    if (email) {
      getOrCreateLocalDeviceKey('Primary Client Device', email)
        .then(dev => setDeviceInfo(dev))
        .catch(err => console.error('P-256 Web Crypto Init:', err));
    }
  }, [email]);

  // ----------------------------------------------------
  // MODEL A: ORGANIZATION ADMINISTRATOR (METAMASK EIP-191)
  // ----------------------------------------------------
  const handleMetaMaskAdminLogin = async () => {
    setErrorMessage('');
    setLoading(true);
    setStatusMessage('Connecting to MetaMask wallet...');

    try {
      if (typeof window === 'undefined' || !(window as any).ethereum) {
        throw new Error('MetaMask wallet extension not detected. Please install MetaMask to authenticate as Organization Administrator.');
      }

      const ethereum = (window as any).ethereum;

      // 1. Request account access
      setStatusMessage('Requesting MetaMask account access...');
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
      if (!accounts || accounts.length === 0) {
        throw new Error('No Ethereum account selected in MetaMask.');
      }
      const walletAddress = accounts[0].toLowerCase();
      setMetaMaskAccount(walletAddress);

      // 2. Request cryptographic challenge for this wallet
      setStatusMessage('Requesting administrative authentication challenge...');
      const challengeRes = await fetch('/api/auth/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'ETHEREUM',
          walletAddress,
        }),
      });

      if (!challengeRes.ok) {
        const errData = await challengeRes.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to request admin challenge');
      }

      const challenge = await challengeRes.json();

      // 3. Request EIP-191 personal_sign from MetaMask
      setStatusMessage('Please sign the cryptographic challenge in MetaMask...');
      const signature = await ethereum.request({
        method: 'personal_sign',
        params: [challenge.message, walletAddress],
      });

      // 4. Submit to /api/auth/login
      setStatusMessage('Verifying cryptographic proof of wallet ownership...');
      const loginRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          challengeId: challenge.challengeId,
          signature,
          authType: 'METAMASK',
        }),
      });

      const result = await loginRes.json().catch(() => ({}));
      if (!loginRes.ok) {
        throw new Error(result.error || 'Admin authentication failed');
      }

      setStatusMessage('Administrator verified! Redirecting to Root Admin Dashboard...');
      router.push('/dashboard/admin');
    } catch (err: any) {
      console.error('MetaMask Admin Login Error:', err);
      if (err?.code === 4001) {
        setErrorMessage('MetaMask signature request was rejected by user.');
      } else {
        setErrorMessage(err.message || 'MetaMask authentication failed');
      }
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------------------------------
  // MODEL B: NORMAL USER LOGIN (ENROLLED P-256 DEVICE KEY)
  // ----------------------------------------------------
  const handlePrimaryLogin = async (e?: React.FormEvent, overrideEmail?: string, overrideDevice?: ClientDeviceInfo) => {
    if (e) e.preventDefault();
    setErrorMessage('');

    const targetEmail = (overrideEmail || email).trim().toLowerCase();
    if (!targetEmail) {
      setErrorMessage('Please enter your account email address or User ID.');
      return;
    }

    setLoading(true);
    setStatusMessage('Accessing local cryptographic credential (ECDSA P-256)...');

    try {
      // 1. Retrieve or initialize local hardware P-256 key
      const dev = overrideDevice || deviceInfo || await getOrCreateLocalDeviceKey('Local Workstation', targetEmail);
      setDeviceInfo(dev);

      // 2. Request single-use cryptographic challenge from server
      setStatusMessage('Requesting cryptographic challenge from server...');
      const challengeRes = await fetch('/api/auth/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          identifier: targetEmail,
          type: 'P256',
          deviceId: dev.deviceId 
        }),
      });

      if (!challengeRes.ok) {
        const chalData = await challengeRes.json().catch(() => ({}));
        throw new Error(chalData.error || 'Failed to request challenge from server');
      }

      const challenge = await challengeRes.json();

      // 3. Sign challenge with local private key using Web Crypto API
      setStatusMessage('Signing challenge with Cryptographic Device Credential (ECDSA P-256)...');
      const signature = await signChallengeWithLocalKey(challenge.message);

      // 4. Verify on server: server checks against registered database public key (NO client public key sent)
      setStatusMessage('Verifying cryptographic signature with identity registry...');
      const loginRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: targetEmail,
          deviceId: dev.deviceId,
          challengeId: challenge.challengeId,
          signature,
        }),
      });

      const result = await loginRes.json();
      if (!loginRes.ok) {
        setLoading(false);
        setErrorMessage(result.error || 'Authentication failed');
        return;
      }

      setStatusMessage('Signature verified! Establishing secure session...');
      if (result.user.role === 'ADMIN') router.push('/dashboard/admin');
      else if (result.user.role === 'AUDITOR') router.push('/dashboard/auditor');
      else router.push('/assets');

    } catch (err: any) {
      setLoading(false);
      setErrorMessage(err.message || 'Authentication error');
    }
  };

  // ----------------------------------------------------
  // MODEL C: USER ENROLLMENT (15-MINUTE SINGLE-USE CODE)
  // ----------------------------------------------------
  const handleRegisterUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const targetEmail = regEmail.trim().toLowerCase();
    const targetName = regName.trim();
    const cleanCode = enrollCode.trim().toUpperCase();

    if (!cleanCode) {
      setErrorMessage('Please enter the 15-minute security code issued by your Administrator.');
      return;
    }

    if (!targetName || !targetEmail) {
      setErrorMessage('Please enter both your Full Name and Email Address.');
      return;
    }

    setLoading(true);
    setStatusMessage('Generating Cryptographic Device Credential (ECDSA P-256) in browser...');

    try {
      const dev = await generateAndSaveDeviceKey(regDeviceName || 'Primary Workstation', targetEmail);
      setDeviceInfo(dev);

      setStatusMessage('Verifying 15-minute security code and establishing Device Passport...');
      const res = await fetch('/api/devices/enrollment/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enrollmentCode: cleanCode,
          deviceName: regDeviceName.trim() || 'Primary Workstation',
          publicKey: dev.publicKeySpki,
          deviceId: dev.deviceId,
          name: targetName,
          email: targetEmail,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Device registration and enrollment failed');
      }

      setStatusMessage('Identity & Device Passport verified! Redirecting to workspace...');
      const userRole = data.user?.role || data.passport?.position?.toUpperCase();
      if (userRole === 'ADMIN') router.push('/dashboard/admin');
      else if (userRole === 'AUDITOR') router.push('/dashboard/auditor');
      else router.push('/assets');
    } catch (err: any) {
      setLoading(false);
      setErrorMessage(err.message || 'Registration failed');
    }
  };

  // ----------------------------------------------------
  // SECONDARY CONNECT: "Use Device Key"
  // ----------------------------------------------------
  const handleUseDeviceKey = async () => {
    await handlePrimaryLogin();
  };

  // ----------------------------------------------------
  // SECONDARY CONNECT: Device Enrollment Complete
  // ----------------------------------------------------
  const handleCompleteEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollCode.trim()) return;

    setEnrollLoading(true);
    setErrorMessage('');

    try {
      const newKey = await generateAndSaveDeviceKey(enrollDeviceName);
      setDeviceInfo(newKey);

      const res = await fetch('/api/devices/enrollment/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enrollmentCode: enrollCode.trim().toUpperCase(),
          deviceName: enrollDeviceName,
          publicKey: newKey.publicKeySpki,
          deviceId: newKey.deviceId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Enrollment failed');

      setEnrollSuccess(true);
      setShowEnrollModal(false);
      if (data.user?.email) {
        setEmail(data.user.email);
        handlePrimaryLogin(undefined, data.user.email, newKey);
      } else {
        handlePrimaryLogin(undefined, undefined, newKey);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Enrollment error');
    } finally {
      setEnrollLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full bg-[#07090e] text-zinc-100 font-sans selection:bg-cyan-500/30 relative flex flex-col justify-between overflow-x-hidden">
      
      {/* Dynamic Background Backdrop */}
      <div 
        className="fixed inset-0 bg-cover bg-center opacity-40 pointer-events-none z-0"
        style={{ backgroundImage: "url('/hero-bg.jpg')" }}
      />
      
      {/* High-Tech Gradient Overlays */}
      <div className="fixed inset-0 bg-gradient-to-r from-[#07090e] via-[#07090e]/85 to-transparent pointer-events-none z-0" />
      <div className="fixed inset-0 bg-gradient-to-t from-[#07090e] via-transparent to-[#07090e]/80 pointer-events-none z-0" />
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_80%_40%,_var(--tw-gradient-stops))] from-cyan-900/15 via-transparent to-transparent pointer-events-none z-0" />

      {/* ==================================================================== */}
      {/* TOP NAVIGATION BAR                                                   */}
      {/* ==================================================================== */}
      <header className="relative z-20 w-full max-w-7xl mx-auto px-6 pt-6 pb-4 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center">
            <Hexagon className="h-8 w-8 text-cyan-400 stroke-[2.2] drop-shadow-[0_0_12px_rgba(6,182,212,0.6)]" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#06b6d4]"></div>
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-black tracking-tight text-white flex items-center">
              Secure<span className="text-cyan-400 drop-shadow-[0_0_10px_rgba(6,182,212,0.8)]">MAX</span>
            </span>
            <span className="text-[8px] font-mono tracking-[0.25em] text-zinc-400 uppercase -mt-0.5">
              PEOPLE | DATA | TRUST
            </span>
          </div>
        </div>



        {/* Right Pill Badge & Cinematic Intro Trigger */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowIntro(true)}
            className="border border-cyan-500/50 bg-cyan-950/40 hover:bg-cyan-900/60 px-3.5 py-1.5 rounded-full text-cyan-300 font-mono text-xs tracking-wider shadow-[0_0_15px_rgba(6,182,212,0.3)] hover:shadow-[0_0_25px_rgba(6,182,212,0.5)] transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            title="Play Cinematic Chain & Lock Launch Intro"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span className="hidden sm:inline">Launch Intro</span>
          </button>

          <div className="border border-cyan-500/40 bg-cyan-950/30 px-4 py-1.5 rounded-full text-cyan-300 font-mono text-xs tracking-wider shadow-[0_0_15px_rgba(6,182,212,0.2)] flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
            SIH 2026
          </div>
        </div>
      </header>

      {/* ==================================================================== */}
      {/* MAIN HERO CONTENT                                                    */}
      {/* ==================================================================== */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-6 py-8 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        
        {/* ---------------------------------------------------- */}
        {/* LEFT COLUMN: HERO HEADLINE & 3 FEATURE CARDS (col 6) */}
        {/* ---------------------------------------------------- */}
        <div className="lg:col-span-6 space-y-8">
          <div>
            <div className="text-[11px] font-mono tracking-[0.25em] text-cyan-400 font-bold uppercase mb-3 flex items-center gap-2">
              <span className="h-1 w-6 bg-cyan-400 rounded-full"></span>
              BEYOND ACCESS
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-[3.75rem] font-black tracking-tight text-white leading-[1.08] mb-5">
              YOUR DATA<br />
              DESERVES A<br />
              <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-indigo-400 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(6,182,212,0.4)]">
                HIGHER STANDARD.
              </span>
            </h1>

            <p className="text-zinc-400 text-sm sm:text-base leading-relaxed max-w-lg font-light">
              SecureMAX enables trusted access to sensitive data through cryptographic identity, 
              role-based control and end-to-end encryption.
            </p>
          </div>

          {/* 3 Feature Cards */}
          <div className="space-y-3.5 max-w-md pt-2">
            
            {/* Card 1: Verified Identity */}
            <div className="flex items-center gap-4 p-3.5 rounded-2xl bg-zinc-950/60 border border-cyan-500/20 backdrop-blur hover:border-cyan-500/40 transition-all group">
              <div className="w-11 h-11 rounded-xl bg-cyan-950/40 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0 group-hover:scale-105 transition-transform shadow-[0_0_12px_rgba(6,182,212,0.2)]">
                <Fingerprint className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-white font-bold text-sm tracking-wide">Verified Identity</h3>
                <p className="text-zinc-400 text-xs">Cryptographic authentication for every user.</p>
              </div>
            </div>

            {/* Card 2: Controlled Access */}
            <div className="flex items-center gap-4 p-3.5 rounded-2xl bg-zinc-950/60 border border-cyan-500/20 backdrop-blur hover:border-cyan-500/40 transition-all group">
              <div className="w-11 h-11 rounded-xl bg-cyan-950/40 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0 group-hover:scale-105 transition-transform shadow-[0_0_12px_rgba(6,182,212,0.2)]">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-white font-bold text-sm tracking-wide">Controlled Access</h3>
                <p className="text-zinc-400 text-xs">Role-based permissions and device security.</p>
              </div>
            </div>

            {/* Card 3: Protected Data */}
            <div className="flex items-center gap-4 p-3.5 rounded-2xl bg-zinc-950/60 border border-cyan-500/20 backdrop-blur hover:border-cyan-500/40 transition-all group">
              <div className="w-11 h-11 rounded-xl bg-cyan-950/40 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0 group-hover:scale-105 transition-transform shadow-[0_0_12px_rgba(6,182,212,0.2)]">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-white font-bold text-sm tracking-wide">Protected Data</h3>
                <p className="text-zinc-400 text-xs">Encrypted storage with zero-trust architecture.</p>
              </div>
            </div>

          </div>
        </div>

        {/* ---------------------------------------------------- */}
        {/* CENTER BEAM (col 1 hidden on mobile)                 */}
        {/* ---------------------------------------------------- */}
        <div className="hidden xl:flex xl:col-span-1 flex-col items-center justify-center h-full text-[9px] font-mono tracking-widest text-cyan-400/70 space-y-4 select-none">
          <div className="h-16 w-px bg-gradient-to-b from-transparent to-cyan-500/60"></div>
          <span className="hover:text-cyan-300">IDENTITY</span>
          <div className="h-6 w-px bg-cyan-500/40"></div>
          <span className="hover:text-cyan-300">ACCESS</span>
          <div className="h-6 w-px bg-cyan-500/40"></div>
          <span className="hover:text-cyan-300">ENCRYPT</span>
          <div className="h-6 w-px bg-cyan-500/40"></div>
          <span className="hover:text-cyan-300">PROTECT</span>
          <div className="h-16 w-px bg-gradient-to-t from-transparent to-cyan-500/60"></div>
        </div>

        {/* ---------------------------------------------------- */}
        {/* RIGHT COLUMN: LOGIN CARD (col 5)                     */}
        {/* ---------------------------------------------------- */}
        <div className="lg:col-span-6 xl:col-span-5 flex justify-center lg:justify-end">
          
          <div className="w-full max-w-md relative rounded-[2.2rem] p-7 sm:p-8 bg-[#0a0f18]/90 backdrop-blur-2xl border border-cyan-500/35 shadow-[0_0_60px_rgba(6,182,212,0.2)] overflow-hidden">
            
            {/* Top-Left Cyan Arc Neon Accent */}
            <div className="absolute -top-12 -left-12 w-32 h-32 rounded-full border-t-2 border-l-2 border-cyan-400/80 pointer-events-none drop-shadow-[0_0_15px_rgba(6,182,212,0.8)]"></div>
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none"></div>

            {/* Card Header */}
            <div className="text-center mb-6 relative z-10">
              <div className="flex items-center justify-center gap-2">
                <span className="text-lg font-black text-white tracking-tight">
                  Secure<span className="text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]">MAX</span>
                </span>
              </div>
              <div className="text-[8px] font-mono tracking-[0.25em] text-cyan-400/80 uppercase mt-0.5">
                IDENTITY | ACCESS | PROTECT
              </div>

              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mt-4">
                {authMode === 'ADMIN_METAMASK' 
                  ? 'Organization Admin' 
                  : authMode === 'TEAM_MEMBER' 
                    ? 'Team Member Login' 
                    : 'Enroll New Device'}
              </h2>
              <p className="text-xs text-zinc-400 mt-1 font-light">
                {authMode === 'ADMIN_METAMASK'
                  ? 'Cryptographic proof of wallet ownership (MetaMask EIP-191)'
                  : authMode === 'TEAM_MEMBER'
                    ? 'Passwordless zero-trust authentication via enrolled P-256 key'
                    : 'Establish device credential with admin-issued 15-minute code'}
              </p>
            </div>

            {/* Mode Switcher Tabs (Admin MetaMask vs Team Member P-256 vs Enroll Device) */}
            <div className="flex rounded-xl bg-zinc-950/80 p-1 border border-zinc-800/80 mb-5 relative z-10 text-[11px]">
              <button
                type="button"
                onClick={() => { setAuthMode('ADMIN_METAMASK'); setErrorMessage(''); }}
                className={`flex-1 py-2 px-1.5 rounded-lg font-semibold tracking-tight transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  authMode === 'ADMIN_METAMASK'
                    ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-400/60 shadow-[0_0_15px_rgba(6,182,212,0.25)]'
                    : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
                }`}
              >
                <Shield className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Admin (Wallet)</span>
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode('TEAM_MEMBER'); setErrorMessage(''); }}
                className={`flex-1 py-2 px-1.5 rounded-lg font-semibold tracking-tight transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  authMode === 'TEAM_MEMBER'
                    ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-400/60 shadow-[0_0_15px_rgba(6,182,212,0.25)]'
                    : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
                }`}
              >
                <Laptop className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Team Member</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('ENROLL_DEVICE');
                  setErrorMessage('');
                }}
                className={`flex-1 py-2 px-1.5 rounded-lg font-semibold tracking-tight transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  authMode === 'ENROLL_DEVICE'
                    ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-400/60 shadow-[0_0_15px_rgba(6,182,212,0.25)]'
                    : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
                }`}
              >
                <Key className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Enroll Device</span>
              </button>
            </div>

            {/* MODEL A: ORGANIZATION ADMIN (METAMASK) */}
            {authMode === 'ADMIN_METAMASK' && (
              <div className="space-y-4 relative z-10">
                {/* Admin Security Notice */}
                <div className="p-3.5 rounded-xl bg-cyan-950/25 border border-cyan-500/30 text-xs text-zinc-300 space-y-1.5">
                  <div className="flex items-center gap-2 text-cyan-300 font-mono font-semibold text-[11px] uppercase tracking-wider">
                    <ShieldCheck className="w-4 h-4 text-cyan-400" />
                    Organization Admin Authentication
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed font-light">
                    Admin access is strictly restricted to the registered Organization Administrator wallet. Authenticate by signing a server-issued challenge with MetaMask (EIP-191).
                  </p>
                </div>

                {/* MetaMask Status Banner */}
                <div className="p-3 bg-zinc-950/80 border border-zinc-800 rounded-xl flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-2.5">
                    <Wallet className="w-4 h-4 text-cyan-400" />
                    <span className="text-zinc-300">
                      {hasMetaMask ? (metaMaskAccount ? `Connected: ${metaMaskAccount.slice(0, 6)}...${metaMaskAccount.slice(-4)}` : 'MetaMask Detected') : 'MetaMask Not Detected'}
                    </span>
                  </div>
                  <span className={`text-[9px] px-2 py-0.5 rounded border uppercase tracking-wider ${
                    hasMetaMask 
                      ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40' 
                      : 'bg-amber-950/60 text-amber-300 border-amber-500/40'
                  }`}>
                    {hasMetaMask ? 'READY' : 'REQUIRED'}
                  </span>
                </div>

                {/* Status / Loading */}
                {loading && (
                  <div className="p-3 bg-zinc-900/90 border border-cyan-500/30 rounded-xl flex items-center gap-2.5 text-xs font-mono text-cyan-300 animate-in fade-in">
                    <Loader2 className="w-4 h-4 animate-spin text-cyan-400 shrink-0" />
                    <span className="truncate">{statusMessage}</span>
                  </div>
                )}

                {/* Error Message */}
                {errorMessage && (
                  <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-xl flex items-start gap-2 text-red-400 text-xs font-mono animate-in fade-in">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Authenticate with MetaMask Button */}
                {hasMetaMask ? (
                  <button
                    type="button"
                    onClick={handleMetaMaskAdminLogin}
                    disabled={loading}
                    className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-cyan-400 via-sky-500 to-blue-600 hover:from-cyan-300 hover:via-sky-400 hover:to-blue-500 text-white font-bold text-sm tracking-wide shadow-[0_0_25px_rgba(6,182,212,0.45)] hover:shadow-[0_0_35px_rgba(6,182,212,0.65)] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-[0.99]"
                  >
                    <Wallet className="w-4 h-4" />
                    <span>Authenticate with MetaMask</span>
                    <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                  </button>
                ) : (
                  <a
                    href="https://metamask.io/download/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3.5 px-6 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm tracking-wide shadow-[0_0_25px_rgba(245,158,11,0.35)] transition-all flex items-center justify-center gap-2 text-center"
                  >
                    <Wallet className="w-4 h-4" />
                    <span>Install MetaMask Extension</span>
                  </a>
                )}

                {/* State-Aware System Initialization (Strictly zero-admin state only) */}
                {!isCheckingBootstrap && !systemInitialized && adminCount === 0 && (
                  <div className="pt-4 border-t border-zinc-800/80 mt-6">
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-500/30">
                      <div className="text-left">
                        <div className="text-xs font-semibold text-cyan-300 flex items-center gap-1.5 font-mono">
                          <Settings className="w-3.5 h-3.5 text-cyan-400" />
                          SYSTEM UNINITIALIZED
                        </div>
                        <div className="text-[11px] text-zinc-400">
                          No Administrator configured yet
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowBootstrapWizard(true)}
                        className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold font-mono tracking-wider transition-all flex items-center gap-1.5 shadow-[0_0_15px_rgba(6,182,212,0.4)] cursor-pointer"
                      >
                        <Shield className="w-3.5 h-3.5" />
                        Initialize Admin
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* MODEL B: TEAM MEMBER LOGIN (ENROLLED P-256) */}
            {authMode === 'TEAM_MEMBER' && (
              <form onSubmit={handlePrimaryLogin} className="space-y-4 relative z-10">
                {/* Notice */}
                <div className="p-3.5 rounded-xl bg-cyan-950/25 border border-cyan-500/30 text-xs text-zinc-300 space-y-1.5">
                  <div className="flex items-center gap-2 text-cyan-300 font-mono font-semibold text-[11px] uppercase tracking-wider">
                    <Fingerprint className="w-4 h-4 text-cyan-400" />
                    Passwordless Device Authentication
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed font-light">
                    Authentication uses your workstation&apos;s enrolled P-256 cryptographic key. Enter your email or User ID to sign in.
                  </p>
                </div>

                {/* Email / User ID Input */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter User ID or Official Email"
                    required
                    className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-cyan-400 transition-colors"
                  />
                </div>

                {/* Status Message */}
                {loading && (
                  <div className="p-3 bg-zinc-900/90 border border-cyan-500/30 rounded-xl flex items-center gap-2.5 text-xs font-mono text-cyan-300 animate-in fade-in">
                    <Loader2 className="w-4 h-4 animate-spin text-cyan-400 shrink-0" />
                    <span className="truncate">{statusMessage}</span>
                  </div>
                )}

                {/* Error Message */}
                {errorMessage && (
                  <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-xl space-y-2 text-red-400 text-xs font-mono animate-in fade-in">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{errorMessage}</span>
                    </div>
                    {errorMessage.toLowerCase().includes('not registered') && (
                      <button
                        type="button"
                        onClick={() => {
                          setRegEmail(email);
                          setAuthMode('ENROLL_DEVICE');
                          setErrorMessage('');
                        }}
                        className="text-cyan-400 hover:text-cyan-300 underline font-semibold flex items-center gap-1.5 cursor-pointer pl-6 pt-1 text-xs"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        Enroll this device with security code now →
                      </button>
                    )}
                  </div>
                )}

                {/* Connect Button */}
                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-cyan-400 via-sky-500 to-blue-600 hover:from-cyan-300 hover:via-sky-400 hover:to-blue-500 text-white font-bold text-sm tracking-wide shadow-[0_0_25px_rgba(6,182,212,0.45)] hover:shadow-[0_0_35px_rgba(6,182,212,0.65)] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-[0.99]"
                >
                  <Fingerprint className="w-4 h-4" />
                  <span>Authenticate with Enrolled Device</span>
                  <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                </button>

                {/* Pair Device Secondary Link */}
                <div className="pt-2 flex items-center justify-between text-[11px]">
                  <span className="text-zinc-400 font-light">
                    New workstation?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        if (email) setRegEmail(email);
                        setAuthMode('ENROLL_DEVICE');
                        setErrorMessage('');
                      }}
                      className="text-cyan-400 hover:text-cyan-300 underline font-medium cursor-pointer"
                    >
                      Enroll with security code
                    </button>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowEnrollModal(true)}
                    className="text-zinc-400 hover:text-zinc-200 text-xs font-mono flex items-center gap-1 cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5 text-cyan-400" />
                    Pair Device
                  </button>
                </div>
              </form>
            )}

            {/* MODEL C: ENROLL DEVICE (15-MIN SECURITY CODE) */}
            {authMode === 'ENROLL_DEVICE' && (
              <form onSubmit={handleRegisterUser} className="space-y-4 relative z-10">
                {/* Notice */}
                <div className="p-3.5 rounded-xl bg-cyan-950/25 border border-cyan-500/30 text-xs text-zinc-300 space-y-1.5">
                  <div className="flex items-center gap-2 text-cyan-300 font-mono font-semibold text-[11px] uppercase tracking-wider">
                    <Key className="w-4 h-4 text-cyan-400" />
                    15-Minute Device Enrollment Code
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed font-light">
                    Enter the single-use enrollment code issued by your Organization Administrator. Codes expire in 15 minutes and are permanently invalidated once used.
                  </p>
                </div>

                {/* 1. Security Code Input */}
                <div>
                  <label className="text-[10px] font-mono tracking-wider text-zinc-400 uppercase block mb-1.5 flex items-center justify-between">
                    <span>15-Minute Security Code</span>
                    {codeVerifying && (
                      <span className="text-cyan-400 flex items-center gap-1 text-[9px] font-mono normal-case">
                        <Loader2 className="w-3 h-3 animate-spin" /> Verifying...
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                      <Key className="w-4 h-4 text-cyan-400" />
                    </div>
                    <input
                      type="text"
                      value={enrollCode}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase();
                        setEnrollCode(val);
                        if (val.replace(/[^A-Z0-9]/g, '').length >= 8) {
                          handleVerifyEnrollCode(val);
                        } else {
                          setVerifiedCapability(null);
                        }
                      }}
                      placeholder="e.g. 7K4M-92QP"
                      required
                      className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-500 font-mono tracking-widest uppercase focus:outline-none focus:border-cyan-400 transition-colors"
                    />
                  </div>
                </div>

                {/* Verified Capability Status Banner */}
                {verifiedCapability && (
                  <div className="p-3 bg-emerald-950/30 border border-emerald-500/40 rounded-xl flex items-center justify-between text-xs font-mono animate-in fade-in">
                    <div className="flex items-center gap-2 text-emerald-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div>
                        <div className="font-bold">Code Verified by Administrator</div>
                        <div className="text-[10px] text-zinc-400">Position: <span className="text-emerald-300 font-semibold">{verifiedCapability.positionName}</span></div>
                      </div>
                    </div>
                    <span className="text-[9px] px-2 py-0.5 rounded bg-emerald-900/50 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider">
                      ROLE LOCKED
                    </span>
                  </div>
                )}

                {/* 2. Full Name Input */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="Full Name (e.g. Vikram Singh)"
                    required
                    className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-cyan-400 transition-colors"
                  />
                </div>

                {/* 3. Email Address Input */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="Email Address (e.g. vikram@securemax.mil)"
                    required
                    className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-cyan-400 transition-colors"
                  />
                </div>

                {/* 4. Device Name Input */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                    <Laptop className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={regDeviceName}
                    onChange={(e) => setRegDeviceName(e.target.value)}
                    placeholder="Primary Workstation"
                    required
                    className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-cyan-400 transition-colors"
                  />
                </div>

                {/* Loading Status */}
                {loading && (
                  <div className="p-3 bg-zinc-900/90 border border-cyan-500/30 rounded-xl flex items-center gap-2.5 text-xs font-mono text-cyan-300 animate-in fade-in">
                    <Loader2 className="w-4 h-4 animate-spin text-cyan-400 shrink-0" />
                    <span>{statusMessage}</span>
                  </div>
                )}

                {/* Error Message */}
                {errorMessage && (
                  <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-xl flex items-start gap-2 text-red-400 text-xs font-mono animate-in fade-in">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading || !regName.trim() || !regEmail.trim() || !enrollCode.trim()}
                  className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-cyan-400 via-sky-500 to-blue-600 hover:from-cyan-300 hover:via-sky-400 hover:to-blue-500 text-white font-bold text-sm tracking-wide shadow-[0_0_25px_rgba(6,182,212,0.45)] hover:shadow-[0_0_35px_rgba(6,182,212,0.65)] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-[0.99]"
                >
                  <Key className="w-4 h-4" />
                  <span>ENROLL CRYPTOGRAPHIC DEVICE</span>
                </button>

                {/* Back to login */}
                <div className="pt-2 flex items-center justify-between text-[11px]">
                  <span className="text-zinc-400 font-light">
                    Already enrolled?{' '}
                    <button
                      type="button"
                      onClick={() => { setAuthMode('TEAM_MEMBER'); setErrorMessage(''); }}
                      className="text-cyan-400 hover:text-cyan-300 underline font-medium cursor-pointer"
                    >
                      Team member login
                    </button>
                  </span>
                  <button
                    type="button"
                    onClick={() => router.push(`/register-device${enrollCode ? `?code=${enrollCode}` : ''}`)}
                    className="text-cyan-400 hover:text-cyan-300 text-xs font-mono underline cursor-pointer"
                  >
                    Open QR Portal →
                  </button>
                </div>
              </form>
            )}

          </div>

        </div>

      </main>

      {/* ==================================================================== */}
      {/* RIGHT VERTICAL INDICATOR DOTS                                       */}
      {/* ==================================================================== */}
      <div className="hidden 2xl:flex fixed right-6 top-1/2 -translate-y-1/2 flex-col gap-6 z-0 pointer-events-none text-[9px] font-mono tracking-widest text-cyan-400/80 select-none">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#06b6d4]"></div>
          <span>SECURE PEOPLE</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#06b6d4]"></div>
          <span>SECURE DATA</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#06b6d4]"></div>
          <span>SECURE INDIA</span>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* BOTTOM FOOTER                                                        */}
      {/* ==================================================================== */}
      <footer className="relative z-20 w-full max-w-7xl mx-auto px-6 py-6 border-t border-zinc-800/60 flex flex-col sm:flex-row items-center justify-between text-[11px] text-zinc-500 font-mono tracking-wider gap-3">
        <div className="flex items-center gap-2">
          <span>A SAFER TOMORROW BUILT TOGETHER.</span>
          <span>—</span>
          <span className="text-cyan-400">SECUREMAX SIH 2026</span>
        </div>
        <div>
          &quot;TECHNOLOGY FOR A MORE TRUSTED INDIA&quot;
        </div>
      </footer>

      {/* ==================================================================== */}
      {/* SECONDARY DEVICE ENROLLMENT MODAL                                    */}
      {/* ==================================================================== */}
      {showEnrollModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0a0f18] border border-cyan-500/40 rounded-3xl p-6 relative shadow-[0_0_50px_rgba(6,182,212,0.3)]">
            <button
              onClick={() => setShowEnrollModal(false)}
              className="absolute top-5 right-5 text-zinc-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-2">
              <QrCode className="w-5 h-5 text-cyan-400" />
              <h3 className="text-lg font-bold text-white tracking-tight">Register New Device</h3>
            </div>
            <p className="text-xs text-zinc-400 mb-6 font-light">
              Enter the one-time pairing code from your primary active workstation.
            </p>

            <form onSubmit={handleCompleteEnrollment} className="space-y-4">
              <div>
                <label className="text-[10px] font-mono tracking-wider text-zinc-400 uppercase block mb-1.5">
                  Device Name / Label
                </label>
                <input
                  type="text"
                  value={enrollDeviceName}
                  onChange={(e) => setEnrollDeviceName(e.target.value)}
                  placeholder="Secondary Mobile / Tablet"
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono tracking-wider text-zinc-400 uppercase block mb-1.5">
                  Enrollment Code (e.g. SMX-XXXX-XXXX)
                </label>
                <input
                  type="text"
                  value={enrollCode}
                  onChange={(e) => setEnrollCode(e.target.value.toUpperCase())}
                  placeholder="SMX-ABCD-1234"
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-100 tracking-widest uppercase focus:outline-none focus:border-cyan-400"
                />
              </div>

              {enrollSuccess && (
                <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl flex items-center gap-2 text-emerald-400 text-xs font-mono">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Device registered! Authenticating...</span>
                </div>
              )}

              <button
                type="submit"
                disabled={enrollLoading || !enrollCode.trim()}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-600 hover:from-cyan-300 hover:to-blue-500 text-white font-bold text-xs tracking-wider shadow-[0_0_20px_rgba(6,182,212,0.4)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {enrollLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Laptop className="w-4 h-4" />}
                REGISTER CRYPTOGRAPHIC DEVICE CREDENTIAL
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => router.push(`/register-device${enrollCode ? `?code=${enrollCode}` : ''}`)}
                  className="text-cyan-400 hover:text-cyan-300 text-xs font-mono underline cursor-pointer"
                >
                  Open Full Device Passport Registration Portal →
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Bootstrap Ceremony Wizard Modal */}
      <AdminBootstrapWizard
        isOpen={showBootstrapWizard}
        onClose={() => setShowBootstrapWizard(false)}
        onSuccess={() => {
          setSystemInitialized(true);
          setAdminCount(1);
          setShowBootstrapWizard(false);
          router.push('/dashboard/admin');
        }}
      />

      {/* Emergency Recovery Ceremony Modal */}
      <EmergencyRecoveryModal
        isOpen={showRecoveryModal}
        onClose={() => setShowRecoveryModal(false)}
        onSuccess={() => {
          setShowRecoveryModal(false);
          router.push('/dashboard/admin');
        }}
      />

      {/* Cinematic Chain & Lock Launch Intro Overlay */}
      <SecureMaxChainIntro 
        isOpen={showIntro} 
        onClose={() => setShowIntro(false)} 
      />

    </div>
  );
}
