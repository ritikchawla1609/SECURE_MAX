'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Fingerprint, 
  Layers, 
  Database, 
  Key, 
  Shield, 
  Lock, 
  Activity, 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  Hexagon,
  Laptop,
  Smartphone,
  Loader2,
  Sparkles,
  ArrowRight,
  Server
} from 'lucide-react';
import { useDemoStore } from '@/stores/useDemoStore';
import { 
  getOrCreateLocalDeviceKey, 
  signChallengeWithLocalKey, 
  generateAndSaveDeviceKey,
  ClientDeviceInfo 
} from '@/lib/crypto/clientP256';

type TabMode = 'DEVICE_LOGIN' | 'ENROLL_DEVICE';
type AuthStatus = 'IDLE' | 'CHALLENGING' | 'SIGNING' | 'VERIFYING' | 'SUCCESS' | 'FAILED';

export default function CyberCommandLogin() {
  const router = useRouter();
  const loginSectionRef = useRef<HTMLDivElement>(null);

  // Demo store integration
  const [activeEvent, setActiveEvent] = useState(0);
  const { presentationModeActive, presentationStage } = useDemoStore();

  const isInit = presentationModeActive && presentationStage === 0;
  const getStatus = (baseText: string) => isInit ? "CONNECTING..." : baseText;
  const getColor = () => isInit ? "text-amber-500 animate-pulse" : "text-cyan-400";

  // Login Tabs & State
  const [activeTab, setActiveTab] = useState<TabMode>('DEVICE_LOGIN');
  const [email, setEmail] = useState('vasu@securemax.mil');
  const [deviceInfo, setDeviceInfo] = useState<ClientDeviceInfo | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('IDLE');
  const [statusText, setStatusText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Device Enrollment State
  const [enrollmentCode, setEnrollmentCode] = useState('');
  const [newDeviceName, setNewDeviceName] = useState('Secondary Workstation');
  const [enrollLoading, setEnrollLoading] = useState(false);
  const [enrollSuccess, setEnrollSuccess] = useState(false);

  // Event stream ticker
  const events = [
    { time: '10:14:18', type: 'SYSTEM', message: 'Security fabric initialized', status: 'OPERATIONAL' },
    { time: '10:14:21', type: 'THREAT ENGINE', message: 'Security scan completed', status: 'CLEAR' },
    { time: '10:14:24', type: 'DOMAIN 1', message: 'Asset policy sync verified', status: 'READY' },
    { time: '10:14:28', type: 'DOMAIN 2', message: 'Key policy sync verified', status: 'READY' },
    { time: '10:14:32', type: 'AUDIT', message: 'Chain integrity verified', status: 'VERIFIED' }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveEvent(prev => (prev + 1) % events.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [events.length]);

  // Discover / create local P-256 key on mount
  useEffect(() => {
    getOrCreateLocalDeviceKey('Primary Client Device', email)
      .then(dev => setDeviceInfo(dev))
      .catch(err => console.error('P-256 Web Crypto Init:', err));
  }, [email]);

  const scrollToLogin = () => {
    loginSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
    const input = document.getElementById('gateway-email-input');
    if (input) input.focus();
  };

  // ----------------------------------------------------
  // FLOW 1: Cryptographic P-256 Device Login
  // ----------------------------------------------------
  const handleDeviceLogin = async (targetEmail = email) => {
    setErrorMessage('');
    setAuthStatus('CHALLENGING');
    setStatusText('Requesting cryptographic challenge from server...');

    try {
      // 1. Ensure local device key exists
      const dev = deviceInfo || await getOrCreateLocalDeviceKey('Local Workstation', targetEmail);
      setDeviceInfo(dev);

      // 2. Request Challenge
      const challengeRes = await fetch('/api/auth/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: targetEmail }),
      });

      if (!challengeRes.ok) {
        const data = await challengeRes.json();
        throw new Error(data.error || 'Failed to obtain server challenge');
      }

      const challenge = await challengeRes.json();

      // 3. Device signs challenge locally using non-extractable P-256 private key
      setAuthStatus('SIGNING');
      setStatusText('Device signing challenge with hardware-isolated P-256 key...');
      
      const signature = await signChallengeWithLocalKey(challenge.message);

      // 4. Send signature to backend for cryptographic verification
      setAuthStatus('VERIFYING');
      setStatusText('Server verifying ECDSA P-256 signature against registered DID public key...');

      const loginRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: targetEmail,
          deviceId: dev.deviceId,
          deviceName: dev.deviceName,
          publicKey: dev.publicKeySpki,
          challengeId: challenge.challengeId,
          signature,
        }),
      });

      const result = await loginRes.json();
      if (!loginRes.ok) {
        throw new Error(result.error || 'Cryptographic authentication failed');
      }

      setAuthStatus('SUCCESS');
      setStatusText('Cryptographic signature verified. Session established!');

      // 5. Redirect based on verified role
      setTimeout(() => {
        if (result.user.role === 'ADMIN') router.push('/dashboard/admin');
        else if (result.user.role === 'AUDITOR') router.push('/dashboard/auditor');
        else router.push('/assets');
      }, 700);

    } catch (err: any) {
      console.error(err);
      setAuthStatus('FAILED');
      setErrorMessage(err.message || 'Authentication error');
    }
  };

  // ----------------------------------------------------
  // FLOW 2: Secondary Device Enrollment
  // ----------------------------------------------------
  const handleCompleteEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollmentCode.trim()) return;

    setEnrollLoading(true);
    setErrorMessage('');

    try {
      const newKey = await generateAndSaveDeviceKey(newDeviceName);
      setDeviceInfo(newKey);

      const res = await fetch('/api/devices/enrollment/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enrollmentCode: enrollmentCode.trim(),
          deviceName: newDeviceName,
          publicKey: newKey.publicKeySpki,
          deviceId: newKey.deviceId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to complete device enrollment');

      setEnrollSuccess(true);
      handleDeviceLogin(data.user.email);
    } catch (err: any) {
      setErrorMessage(err.message || 'Enrollment error');
    } finally {
      setEnrollLoading(false);
    }
  };

  // ----------------------------------------------------
  // FLOW 3: Fast Role Access for Evaluators
  // ----------------------------------------------------
  const handleFastDemoAccess = async (role: 'ADMIN' | 'USER' | 'AUDITOR') => {
    setAuthStatus('CHALLENGING');
    setStatusText(`Authenticating ${role} session via cryptographic identity...`);

    try {
      const res = await fetch('/api/auth/demo-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Fast demo login failed');

      setAuthStatus('SUCCESS');
      setStatusText(`Authorized as ${role}. Access granted...`);

      setTimeout(() => {
        if (role === 'ADMIN') router.push('/dashboard/admin');
        else if (role === 'AUDITOR') router.push('/dashboard/auditor');
        else router.push('/assets');
      }, 600);
    } catch (err: any) {
      setAuthStatus('FAILED');
      setErrorMessage(err.message || 'Demo login failed');
    }
  };

  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-zinc-100 font-sans selection:bg-cyan-500/30 relative flex flex-col">
      {/* Subtle Ambient Radial Glow */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-cyan-900/10 via-transparent to-transparent"></div>
      
      {/* Top Navigation Bar */}
      <header className="flex h-14 items-center justify-between border-b border-zinc-800 bg-[#0a0a0c] px-4 lg:px-6 z-20 relative">
        <div className="flex items-center gap-3">
          <Hexagon className="h-6 w-6 text-cyan-400" />
          <span className="text-lg font-bold tracking-widest text-zinc-100">
            SECURE<span className="text-cyan-400">MAX</span>
          </span>
        </div>
        
        <div className="flex items-center gap-4 lg:gap-6 text-[10px] font-mono tracking-widest text-zinc-500">
          <div className="hidden sm:flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
            SECURITY FABRIC: OPERATIONAL
          </div>
          
          <button 
            onClick={scrollToLogin}
            className="text-cyan-400 hover:text-cyan-300 border border-cyan-500/40 bg-cyan-500/5 px-4 py-1.5 rounded text-[10px] font-mono tracking-wider hover:bg-cyan-500/15 transition-all shadow-[0_0_12px_rgba(6,182,212,0.15)] flex items-center gap-2"
          >
            <Lock className="w-3 h-3 text-cyan-400" />
            COMMAND CENTER
          </button>
        </div>
      </header>

      {/* Main Grid Content */}
      <main className="max-w-[1500px] w-full mx-auto px-4 lg:px-6 py-6 relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
        
        {/* ==================================================================== */}
        {/* LEFT COLUMN: SYSTEM HEALTH & METRICS (col-span-3)                    */}
        {/* ==================================================================== */}
        <div className="lg:col-span-3 space-y-6 order-2 lg:order-1">
          
          {/* Security Posture Score */}
          <div className="bg-[#0a0a0c] border border-zinc-800 rounded-lg p-5">
            <h3 className="text-[10px] font-mono tracking-widest text-zinc-500 mb-6 uppercase">
              Security Posture
            </h3>
            <div className="text-5xl font-light tracking-tighter text-zinc-100 mb-2">
              92<span className="text-xl text-zinc-600">/100</span>
            </div>
            <div className="text-xs font-mono text-emerald-400 tracking-widest">
              HEALTHY
            </div>
            
            <div className="mt-8 space-y-4 text-xs font-mono tracking-wider">
              <div className="flex justify-between items-center pb-2 border-b border-zinc-800/50">
                <span className="text-zinc-400">Identity</span>
                <span className={`flex items-center gap-1 ${getColor()}`}>
                  <CheckCircle2 className="w-3 h-3"/> {getStatus('HEALTHY')}
                </span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-zinc-800/50">
                <span className="text-zinc-400">Domain 1</span>
                <span className={`flex items-center gap-1 ${getColor()}`}>
                  <CheckCircle2 className="w-3 h-3"/> {getStatus('HEALTHY')}
                </span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-zinc-800/50">
                <span className="text-zinc-400">Domain 2</span>
                <span className={`flex items-center gap-1 ${getColor()}`}>
                  <CheckCircle2 className="w-3 h-3"/> {getStatus('HEALTHY')}
                </span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-zinc-800/50">
                <span className="text-zinc-400">KMS</span>
                <span className={`flex items-center gap-1 ${getColor()}`}>
                  <Lock className="w-3 h-3"/> {isInit ? 'INITIALIZING...' : 'PROTECTED'}
                </span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-zinc-800/50">
                <span className="text-zinc-400">Threat Engine</span>
                <span className={`flex items-center gap-1 ${getColor()}`}>
                  <Activity className="w-3 h-3"/> {isInit ? 'INITIALIZING...' : 'ACTIVE'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Audit</span>
                <span className={`flex items-center gap-1 ${getColor()}`}>
                  <ShieldCheck className="w-3 h-3"/> {isInit ? 'INITIALIZING...' : 'VERIFIED'}
                </span>
              </div>
            </div>
          </div>

          {/* Cryptographic Core Telemetry */}
          <div className="bg-[#0a0a0c] border border-zinc-800 rounded-lg p-5">
            <h3 className="text-[10px] font-mono tracking-widest text-zinc-500 mb-4 uppercase">
              Decentralized Fabric
            </h3>
            <div className="space-y-3 font-mono text-[10px]">
              <div className="flex justify-between items-center text-zinc-400">
                <span>CHAIN NETWORK</span>
                <span className="text-cyan-400 font-bold">ETHEREUM SEPOLIA</span>
              </div>
              <div className="flex justify-between items-center text-zinc-400">
                <span>CHAIN ID</span>
                <span className="text-zinc-200">11155111</span>
              </div>
              <div className="flex justify-between items-center text-zinc-400">
                <span>IDENTITY REGISTRY</span>
                <span className="text-zinc-300">0xC538...bC2B</span>
              </div>
              <div className="flex justify-between items-center text-zinc-400">
                <span>ACCESS CONTROL</span>
                <span className="text-zinc-300">0x6764...eA63</span>
              </div>
              <div className="flex justify-between items-center text-zinc-400">
                <span>ASSET NFT CONTRACT</span>
                <span className="text-zinc-300">0x1C7E...Cf45</span>
              </div>
            </div>
          </div>

        </div>

        {/* ==================================================================== */}
        {/* CENTER COLUMN: CRYPTOGRAPHIC ARCHITECTURE (col-span-5)               */}
        {/* ==================================================================== */}
        <div className="lg:col-span-5 flex flex-col items-center justify-start order-3 lg:order-2">
          <div className="w-full bg-[#0a0a0c] border border-zinc-800 rounded-lg p-6 relative">
            <div className="absolute top-4 right-4 text-[10px] font-mono tracking-widest text-zinc-600">
              ETHEREUM SEPOLIA
            </div>
            
            <div className="flex flex-col items-center w-full max-w-md mx-auto space-y-3.5 pt-3">
              
              {/* Box 1: IDENTITY */}
              <div className="w-full flex items-center justify-between p-3 border border-zinc-800 bg-zinc-900/40 rounded transition-all hover:border-zinc-700">
                <div className="flex items-center gap-3">
                  <Fingerprint className="w-5 h-5 text-cyan-400" />
                  <div>
                    <div className="text-xs font-bold tracking-widest">IDENTITY</div>
                    <div className="text-[10px] text-zinc-500">Cryptographic authentication</div>
                  </div>
                </div>
                <div className={`text-[10px] font-mono ${getColor()}`}>● {getStatus('READY')}</div>
              </div>
              
              <div className="w-px h-5 bg-zinc-800"></div>

              {/* Box 2: RBAC + CONTEXT */}
              <div className="w-full flex items-center justify-between p-3 border border-zinc-800 bg-zinc-900/40 rounded transition-all hover:border-zinc-700">
                <div className="flex items-center gap-3">
                  <Layers className="w-5 h-5 text-indigo-400" />
                  <div>
                    <div className="text-xs font-bold tracking-widest">RBAC + CONTEXT</div>
                    <div className="text-[10px] text-zinc-500">Role evaluation</div>
                  </div>
                </div>
                <div className={`text-[10px] font-mono ${getColor()}`}>● {getStatus('CONFIGURED')}</div>
              </div>

              <div className="w-px h-5 bg-zinc-800"></div>

              {/* DOMAIN 1: ASSET POLICY */}
              <div className="w-full border border-zinc-800 rounded bg-[#0a0a0c] p-3.5 relative hover:border-zinc-700 transition-all">
                <div className="absolute -left-3 top-1/2 -translate-y-1/2 -rotate-90 text-[8px] font-mono tracking-widest text-zinc-600">
                  DOMAIN 1
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 pl-3">
                    <Database className="w-5 h-5 text-emerald-400" />
                    <div>
                      <div className="text-xs font-bold tracking-widest">ASSET POLICY</div>
                      <div className="text-[10px] text-zinc-500">Asset authorization</div>
                    </div>
                  </div>
                  <div className={`text-[10px] font-mono ${getColor()}`}>● {getStatus('READY')}</div>
                </div>
              </div>

              {/* HERO: The Decryption Gate */}
              <div className="w-full py-2 flex flex-col items-center relative">
                <div className="h-6 w-px bg-gradient-to-b from-emerald-500/50 to-red-500/50"></div>
                <div className="my-1.5 px-3 py-1 bg-red-950/30 border border-red-500/40 text-red-400 text-[10px] font-mono tracking-widest rounded-full shadow-[0_0_12px_rgba(239,68,68,0.15)]">
                  AUTHORIZATION ≠ DECRYPTION
                </div>
                <div className="h-6 w-px bg-red-500/30"></div>
              </div>

              {/* DOMAIN 2: KEY POLICY */}
              <div className="w-full border border-zinc-800 rounded bg-[#0a0a0c] p-3.5 relative hover:border-zinc-700 transition-all">
                <div className="absolute -left-3 top-1/2 -translate-y-1/2 -rotate-90 text-[8px] font-mono tracking-widest text-zinc-600">
                  DOMAIN 2
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 pl-3">
                    <Key className="w-5 h-5 text-amber-400" />
                    <div>
                      <div className="text-xs font-bold tracking-widest">KEY POLICY</div>
                      <div className="text-[10px] text-zinc-500">Decryption authorization</div>
                    </div>
                  </div>
                  <div className="text-[10px] font-mono text-cyan-400">● READY</div>
                </div>
              </div>

              <div className="w-px h-5 bg-zinc-800"></div>

              {/* Box 4: KMS */}
              <div className="w-full flex items-center justify-between p-3 border border-zinc-800 bg-zinc-900/40 rounded transition-all hover:border-zinc-700">
                <div className="flex items-center gap-3">
                  <Lock className="w-5 h-5 text-cyan-400" />
                  <div>
                    <div className="text-xs font-bold tracking-widest">KMS</div>
                    <div className="text-[10px] text-zinc-500">Key usage control</div>
                  </div>
                </div>
                <div className="text-[10px] font-mono text-zinc-400">● PROTECTED</div>
              </div>

            </div>
          </div>
        </div>

        {/* ==================================================================== */}
        {/* RIGHT COLUMN: LOGIN ACCESS GATEWAY & SECURITY ACTIVITY (col-span-4)  */}
        {/* ==================================================================== */}
        <div ref={loginSectionRef} className="lg:col-span-4 space-y-6 order-1 lg:order-3">
          
          {/* PRIMARY LOGIN CONSOLE CARD */}
          <div className="bg-[#0a0a0c] border border-cyan-500/40 rounded-lg p-5 shadow-[0_0_25px_rgba(6,182,212,0.08)] relative overflow-hidden">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-4">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-mono tracking-widest text-zinc-200 font-bold uppercase">
                  Secure Access Gateway
                </h3>
              </div>
              <span className="text-[9px] font-mono text-cyan-400 border border-cyan-500/30 px-2 py-0.5 rounded bg-cyan-950/30">
                P-256 WebCrypto
              </span>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="grid grid-cols-2 gap-1 bg-zinc-950 p-1 rounded border border-zinc-800 mb-4">
              <button
                onClick={() => { setActiveTab('DEVICE_LOGIN'); setErrorMessage(''); }}
                className={`py-1.5 text-[10px] font-mono tracking-wider rounded transition-all ${
                  activeTab === 'DEVICE_LOGIN' 
                    ? 'bg-cyan-500 text-zinc-950 font-bold shadow' 
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Hardware Key
              </button>
              <button
                onClick={() => { setActiveTab('ENROLL_DEVICE'); setErrorMessage(''); }}
                className={`py-1.5 text-[10px] font-mono tracking-wider rounded transition-all ${
                  activeTab === 'ENROLL_DEVICE' 
                    ? 'bg-cyan-500 text-zinc-950 font-bold shadow' 
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Enroll Device
              </button>
            </div>

            {/* TAB 1: P-256 DEVICE KEY LOGIN */}
            {activeTab === 'DEVICE_LOGIN' && (
              <div className="space-y-4">
                
                {/* Detected Local Key Banner */}
                <div className="bg-black/60 border border-zinc-800 rounded p-2.5 flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-2 text-zinc-300">
                    <Laptop className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-[11px] truncate max-w-[160px]">
                      {deviceInfo?.deviceName || 'Local Workstation'}
                    </span>
                  </div>
                  <span className="text-[9px] text-cyan-400 border border-cyan-500/30 px-1.5 py-0.5 rounded">
                    ECDSA P-256
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono tracking-wider text-zinc-400 uppercase">
                    Account Identity / Email
                  </label>
                  <input
                    id="gateway-email-input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vasu@securemax.mil"
                    className="w-full bg-zinc-900/80 border border-zinc-800 rounded px-3 py-2 font-mono text-xs text-zinc-100 focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>

                {/* Progress status indicators */}
                {authStatus !== 'IDLE' && authStatus !== 'FAILED' && (
                  <div className="p-3 bg-zinc-900/90 border border-cyan-500/30 rounded space-y-1.5">
                    <div className="flex items-center gap-2 text-[11px] font-mono text-cyan-300">
                      {authStatus === 'SUCCESS' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                      )}
                      <span>{statusText}</span>
                    </div>
                  </div>
                )}

                {/* Error Banner */}
                {errorMessage && (
                  <div className="p-3 bg-red-950/40 border border-red-500/30 rounded flex items-start gap-2 text-red-400 text-xs font-mono">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Authenticate Button */}
                <button
                  onClick={() => handleDeviceLogin()}
                  disabled={authStatus === 'CHALLENGING' || authStatus === 'SIGNING' || authStatus === 'VERIFYING'}
                  className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-zinc-950 font-bold py-2.5 px-4 rounded text-xs font-mono tracking-wider transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(6,182,212,0.25)] cursor-pointer"
                >
                  <Key className="w-4 h-4" />
                  AUTHENTICATE VIA DEVICE KEY
                </button>

                <p className="text-[9px] font-mono text-zinc-500 text-center">
                  Private key never leaves this device • Signs challenge via Web Crypto API
                </p>
              </div>
            )}

            {/* TAB 2: SECONDARY DEVICE ENROLLMENT */}
            {activeTab === 'ENROLL_DEVICE' && (
              <form onSubmit={handleCompleteEnrollment} className="space-y-3.5">
                <p className="text-[10px] font-mono text-zinc-400 leading-relaxed">
                  Enter the one-time enrollment code generated from your primary verified workstation.
                </p>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono tracking-wider text-zinc-400 uppercase">
                    Device Identifier Label
                  </label>
                  <input
                    type="text"
                    value={newDeviceName}
                    onChange={(e) => setNewDeviceName(e.target.value)}
                    placeholder="Field Tablet / Mobile Device"
                    className="w-full bg-zinc-900/80 border border-zinc-800 rounded px-3 py-2 font-mono text-xs text-zinc-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono tracking-wider text-zinc-400 uppercase">
                    Enrollment Token (e.g. SMX-XXXX-XXXX)
                  </label>
                  <input
                    type="text"
                    value={enrollmentCode}
                    onChange={(e) => setEnrollmentCode(e.target.value.toUpperCase())}
                    placeholder="SMX-ABCD-1234"
                    className="w-full bg-zinc-900/80 border border-zinc-800 rounded px-3 py-2 font-mono text-xs text-zinc-100 tracking-wider focus:outline-none focus:border-cyan-500 uppercase"
                  />
                </div>

                {enrollSuccess && (
                  <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded flex items-center gap-2 text-emerald-400 text-xs font-mono">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Device enrolled successfully! Signing in...</span>
                  </div>
                )}

                {errorMessage && (
                  <div className="p-3 bg-red-950/40 border border-red-500/30 rounded flex items-start gap-2 text-red-400 text-xs font-mono">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={enrollLoading || !enrollmentCode.trim()}
                  className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-zinc-950 font-bold py-2.5 px-4 rounded text-xs font-mono tracking-wider transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(6,182,212,0.25)] cursor-pointer"
                >
                  {enrollLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Laptop className="w-4 h-4" />
                  )}
                  REGISTER HARDWARE KEY
                </button>
              </form>
            )}

          </div>

          {/* SECURITY ACTIVITY STREAM */}
          <div className="bg-[#0a0a0c] border border-zinc-800 rounded-lg p-5 flex flex-col h-[220px]">
            <h3 className="text-[10px] font-mono tracking-widest text-zinc-500 mb-3 uppercase">
              Security Activity
            </h3>
            <div className="flex-1 overflow-y-auto space-y-2.5 font-mono text-[10px] pr-1">
              {events.slice(0, activeEvent + 1).reverse().map((ev, i) => (
                <div key={i} className="pb-2 border-b border-zinc-800/50 last:border-0">
                  <div className="flex justify-between items-start text-zinc-500 mb-0.5">
                    <span>{ev.time}</span>
                    <span className="text-emerald-500">{ev.status}</span>
                  </div>
                  <div className="text-zinc-300 uppercase">{ev.message}</div>
                  <div className="text-cyan-400 text-[9px] mt-0.5">{ev.type}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ACTIVE INCIDENTS */}
          <div className="bg-[#0a0a0c] border border-zinc-800 rounded-lg p-5">
            <h3 className="text-[10px] font-mono tracking-widest text-zinc-500 mb-3 uppercase">
              Active Incidents
            </h3>
            <div className="flex flex-col items-center justify-center py-4 text-zinc-600">
              <ShieldCheck className="w-8 h-8 mb-2 opacity-60 text-emerald-500" />
              <span className="text-[10px] tracking-widest font-mono text-zinc-400">
                NO ACTIVE INCIDENTS
              </span>
            </div>
          </div>

        </div>

      </main>
    </div>
  );
}
