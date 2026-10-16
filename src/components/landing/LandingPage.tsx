'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Shield, 
  Lock, 
  Key, 
  Database, 
  Fingerprint, 
  ArrowRight, 
  Sparkles, 
  CheckCircle2, 
  Server, 
  Cpu, 
  Layers, 
  FileText, 
  ShieldCheck, 
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  Zap,
  Eye,
  RefreshCw
} from 'lucide-react';
import SecureMaxChainIntro from '@/components/ui/SecureMaxChainIntro';

export default function LandingPage() {
  const router = useRouter();
  const [showIntro, setShowIntro] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<'architecture' | 'crypto' | 'audit'>('architecture');
  const [networkStatus, setNetworkStatus] = React.useState<{ sepolia: boolean; db: boolean }>({
    sepolia: true,
    db: true,
  });

  React.useEffect(() => {
    // Check if user already saw intro in this session or explicitly requested via ?intro=1
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const forceIntro = urlParams.get('intro') === '1' || urlParams.get('intro') === 'true';
      const hasSeen = sessionStorage.getItem('securemax_intro_seen');
      if (forceIntro || !hasSeen) {
        setShowIntro(true);
        sessionStorage.setItem('securemax_intro_seen', 'true');
      }
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#050816] text-[#F8FAFC] selection:bg-cyan-500/30 font-sans relative overflow-x-hidden">
      {/* Background Cybernetic Ambient Glows */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[20%] w-[55vw] h-[55vw] rounded-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-600/15 via-cyan-900/10 to-transparent blur-3xl" />
        <div className="absolute top-[40%] right-[-10%] w-[45vw] h-[45vw] rounded-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-violet-600/10 via-blue-900/5 to-transparent blur-3xl" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[40vw] h-[40vw] rounded-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cyan-600/10 via-transparent to-transparent blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:48px_48px]" />
      </div>

      {/* TOP NAVBAR */}
      <header className="relative z-30 w-full max-w-7xl mx-auto px-6 h-20 flex items-center justify-between border-b border-cyan-500/15 backdrop-blur-md bg-[#050816]/70">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-cyan-950/40 border border-cyan-500/40 shadow-[0_0_20px_rgba(6,182,212,0.3)] group-hover:border-cyan-400 transition-colors">
            <Shield className="w-5 h-5 text-cyan-400 group-hover:scale-110 transition-transform" />
            <div className="absolute inset-0 rounded-xl border border-cyan-400/20 animate-pulse" />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-black tracking-tight text-white flex items-center">
              Secure<span className="text-cyan-400 drop-shadow-[0_0_12px_rgba(6,182,212,0.8)]">MAX</span>
            </span>
            <span className="text-[9px] font-mono tracking-[0.25em] text-cyan-300/70 uppercase -mt-0.5">
              ZERO-TRUST DATA SHARING
            </span>
          </div>
        </Link>

        {/* Desktop Nav Links */}
        <nav className="hidden md:flex items-center gap-8 text-xs font-mono tracking-wider text-zinc-400">
          <a href="#core-concept" className="hover:text-cyan-300 transition-colors">
            CORE PRINCIPLE
          </a>
          <a href="#architecture" className="hover:text-cyan-300 transition-colors">
            SECURITY MODEL
          </a>
          <a href="#capabilities" className="hover:text-cyan-300 transition-colors">
            CAPABILITIES
          </a>
        </nav>

        {/* Action CTAs */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowIntro(true)}
            className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-950/30 hover:bg-cyan-900/40 text-cyan-300 font-mono text-xs tracking-wider transition-all cursor-pointer shadow-[0_0_15px_rgba(6,182,212,0.2)]"
            title="Replay cinematic shield intro"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>Launch Intro</span>
          </button>

          <Link
            href="/login"
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs tracking-wider shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)] transition-all flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <span>Sign In</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative z-10 w-full max-w-7xl mx-auto px-6 pt-16 pb-20 lg:pt-24 lg:pb-32 flex flex-col items-center text-center">
        
        {/* Top Innovation Pill */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-950/50 border border-cyan-500/30 text-cyan-300 text-xs font-mono tracking-wider mb-8 shadow-[0_0_20px_rgba(6,182,212,0.2)] animate-in fade-in slide-in-from-top-4 duration-700">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span className="font-semibold text-emerald-400">CRYPTOGRAPHIC GUARANTEE:</span>
          <span className="text-zinc-300">AUTHORIZATION ≠ DECRYPTION</span>
        </div>

        {/* Main Headline */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white max-w-4xl leading-[1.08] mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
          Your Files.{' '}
          <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400 bg-clip-text text-transparent drop-shadow-[0_0_35px_rgba(6,182,212,0.4)]">
            Your Keys.
          </span>{' '}
          Your Control.
        </h1>

        {/* Supporting Message */}
        <p className="text-zinc-400 text-base sm:text-lg max-w-2xl font-light leading-relaxed mb-10 animate-in fade-in slide-in-from-bottom-5 duration-700 delay-100">
          Secure document sharing with controlled access and verifiable integrity.
        </p>

        {/* Hero Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-4 mb-16 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-200">
          <Link
            href="/login"
            className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-600 hover:from-blue-500 hover:to-cyan-400 text-white font-bold text-sm tracking-wider shadow-[0_0_30px_rgba(6,182,212,0.45)] hover:shadow-[0_0_40px_rgba(6,182,212,0.7)] transition-all flex items-center justify-center gap-2.5 cursor-pointer active:scale-95 group"
          >
            <span>Get Started</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>

          <a
            href="#core-concept"
            className="w-full sm:w-auto px-7 py-4 rounded-xl border border-cyan-500/30 bg-[#0A1020]/80 hover:bg-[#0D172A] text-zinc-200 hover:text-white font-mono text-xs tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:border-cyan-500/60"
          >
            <Shield className="w-4 h-4 text-cyan-400" />
            <span>Explore Security</span>
          </a>
        </div>

        {/* 3D HOLOGRAPHIC SHIELD & ORBITING DOCUMENTS ILLUSTRATION (Panel 1) */}
        <div className="relative w-full max-w-3xl aspect-[16/9] sm:aspect-[2/1] rounded-3xl border border-cyan-500/25 bg-[#0a1020]/60 backdrop-blur-xl p-6 sm:p-10 flex items-center justify-center overflow-hidden shadow-[0_0_80px_rgba(6,182,212,0.15)] group">
          
          {/* Radial Center Glow */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-72 h-72 rounded-full bg-cyan-500/20 blur-3xl animate-pulse" />
            <div className="w-48 h-48 rounded-full bg-blue-600/20 blur-2xl" />
          </div>

          {/* SVG Connecting Lines & Security Network */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-0 opacity-40">
            <line x1="15%" y1="20%" x2="50%" y2="50%" stroke="url(#lineGrad1)" strokeWidth="1.5" strokeDasharray="4 4" className="animate-[pulse_3s_ease-in-out_infinite]" />
            <line x1="85%" y1="20%" x2="50%" y2="50%" stroke="url(#lineGrad2)" strokeWidth="1.5" strokeDasharray="4 4" className="animate-[pulse_3.5s_ease-in-out_infinite]" />
            <line x1="15%" y1="80%" x2="50%" y2="50%" stroke="url(#lineGrad3)" strokeWidth="1.5" strokeDasharray="4 4" className="animate-[pulse_4s_ease-in-out_infinite]" />
            <line x1="85%" y1="80%" x2="50%" y2="50%" stroke="url(#lineGrad4)" strokeWidth="1.5" strokeDasharray="4 4" className="animate-[pulse_3.2s_ease-in-out_infinite]" />
            <defs>
              <linearGradient id="lineGrad1" x1="15%" y1="20%" x2="50%" y2="50%">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.1" />
              </linearGradient>
              <linearGradient id="lineGrad2" x1="85%" y1="20%" x2="50%" y2="50%">
                <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.1" />
              </linearGradient>
              <linearGradient id="lineGrad3" x1="15%" y1="80%" x2="50%" y2="50%">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.1" />
              </linearGradient>
              <linearGradient id="lineGrad4" x1="85%" y1="80%" x2="50%" y2="50%">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.1" />
              </linearGradient>
            </defs>
          </svg>

          {/* Concentric Rotating Cyber Rings */}
          <div className="absolute w-80 h-80 rounded-full border border-cyan-500/20 animate-[spin_30s_linear_infinite] pointer-events-none" />
          <div className="absolute w-[26rem] h-[26rem] rounded-full border border-dashed border-cyan-400/15 animate-[spin_45s_linear_infinite_reverse] pointer-events-none" />
          <div className="absolute w-[32rem] h-[32rem] rounded-full border border-cyan-500/10 pointer-events-none" />

          {/* Central Shield with Padlock and Tracing Light */}
          <div className="relative z-10 flex flex-col items-center justify-center">
            <div className="relative w-32 h-36 flex items-center justify-center">
              {/* SVG Shield with Stroke Glow */}
              <svg 
                className="w-32 h-36 drop-shadow-[0_0_25px_rgba(6,182,212,0.8)]"
                viewBox="0 0 100 120" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <linearGradient id="shieldGrad" x1="0" y1="0" x2="100" y2="120" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#06b6d4" stopOpacity="0.4" />
                    <stop offset="1" stopColor="#1e40af" stopOpacity="0.8" />
                  </linearGradient>
                  <linearGradient id="strokeGrad" x1="0" y1="0" x2="100" y2="120" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#38bdf8" />
                    <stop offset="0.5" stopColor="#06b6d4" />
                    <stop offset="1" stopColor="#818cf8" />
                  </linearGradient>
                </defs>
                <path 
                  d="M50 5 L88 22 V58 C88 88 50 115 50 115 C50 115 12 88 12 58 V22 L50 5 Z" 
                  fill="url(#shieldGrad)"
                  stroke="url(#strokeGrad)" 
                  strokeWidth="2.5"
                  className="transition-all duration-500 group-hover:stroke-cyan-300"
                />
              </svg>

              {/* Padlock Icon in Center */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-12 h-12 rounded-xl bg-black/60 border border-cyan-400/50 flex items-center justify-center text-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.6)]">
                  <Lock className="w-6 h-6 stroke-[2.2]" />
                </div>
              </div>
            </div>

            {/* Shield State Indicator */}
            <div className="mt-4 px-3.5 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/40 text-[10px] font-mono tracking-widest text-cyan-300 flex items-center gap-1.5 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
              AES-256-GCM ENCRYPTED
            </div>
          </div>

          {/* Orbiting Satellite Badges */}
          {/* Badge 1: Top-Left */}
          <div className="absolute top-6 left-6 sm:top-10 sm:left-12 flex items-center gap-2 p-2.5 rounded-xl bg-[#0d172a]/90 border border-cyan-500/30 text-left shadow-xl backdrop-blur-md animate-[bounce_5s_ease-in-out_infinite] z-10">
            <div className="w-7 h-7 rounded-lg bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-white">Hardware P-256</div>
              <div className="text-[9px] font-mono text-zinc-400">Device Passport</div>
            </div>
          </div>

          {/* Badge 2: Top-Right */}
          <div className="absolute top-6 right-6 sm:top-10 sm:right-12 flex items-center gap-2 p-2.5 rounded-xl bg-[#0d172a]/90 border border-violet-500/30 text-left shadow-xl backdrop-blur-md animate-[bounce_6s_ease-in-out_infinite_1s] z-10">
            <div className="w-7 h-7 rounded-lg bg-violet-950/80 border border-violet-500/40 flex items-center justify-center text-violet-400 shrink-0">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-white">Sepolia Testnet</div>
              <div className="text-[9px] font-mono text-zinc-400">On-Chain Ledger</div>
            </div>
          </div>

          {/* Badge 3: Bottom-Left */}
          <div className="absolute bottom-6 left-6 sm:bottom-10 sm:left-12 flex items-center gap-2 p-2.5 rounded-xl bg-[#0d172a]/90 border border-emerald-500/30 text-left shadow-xl backdrop-blur-md animate-[bounce_7s_ease-in-out_infinite_0.5s] z-10">
            <div className="w-7 h-7 rounded-lg bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-white">SHA-256 Chained</div>
              <div className="text-[9px] font-mono text-zinc-400">Tamper Evident</div>
            </div>
          </div>

          {/* Badge 4: Bottom-Right */}
          <div className="absolute bottom-6 right-6 sm:bottom-10 sm:right-12 flex items-center gap-2 p-2.5 rounded-xl bg-[#0d172a]/90 border border-blue-500/30 text-left shadow-xl backdrop-blur-md animate-[bounce_6.5s_ease-in-out_infinite_1.5s] z-10">
            <div className="w-7 h-7 rounded-lg bg-blue-950/80 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-white">KMS Enclave</div>
              <div className="text-[9px] font-mono text-zinc-400">Envelope Keys</div>
            </div>
          </div>
        </div>

      </section>

      {/* CORE CONCEPT SECTION: AUTHORIZATION ≠ DECRYPTION */}
      <section id="core-concept" className="relative z-10 w-full max-w-7xl mx-auto px-6 py-20 border-t border-cyan-500/15">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="text-[10px] font-mono tracking-[0.25em] text-cyan-400 uppercase font-bold mb-3 flex items-center justify-center gap-2">
            <span className="w-6 h-0.5 bg-cyan-400" />
            THE SECUREMAX PARADIGM
            <span className="w-6 h-0.5 bg-cyan-400" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-4">
            Authorization ≠ Decryption
          </h2>
          <p className="text-zinc-400 text-sm sm:text-base leading-relaxed font-light">
            In standard platforms, having access to a document means the server delivers decrypted bytes immediately. In SecureMAX, user authorization grants policy rights, but cryptographic decryption requires an unrevoked, hardware-bound credential validated through our Key Management Service.
          </p>
        </div>

        {/* Comparative 2-Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Traditional Insecure Model */}
          <div className="p-8 rounded-2xl bg-[#0a0e1a]/70 border border-red-500/25 relative overflow-hidden">
            <div className="absolute top-0 right-0 px-3 py-1 bg-red-950/60 border-b border-l border-red-500/30 text-red-400 text-[10px] font-mono uppercase tracking-wider">
              Traditional Systems (Vulnerable)
            </div>
            <div className="w-12 h-12 rounded-xl bg-red-950/30 border border-red-500/30 flex items-center justify-center text-red-400 mb-6">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Conflated Access & Keys</h3>
            <p className="text-xs text-zinc-400 leading-relaxed mb-6 font-light">
              Server stores files in plaintext or decrypts automatically whenever a session cookie is present. If the database leaks or session token is intercepted, all files are compromised instantly.
            </p>
            <ul className="space-y-3 text-xs font-mono text-zinc-400">
              <li className="flex items-center gap-2 text-red-400">
                <span className="text-red-500">✕</span> Plaintext database storage
              </li>
              <li className="flex items-center gap-2 text-red-400">
                <span className="text-red-500">✕</span> Session token equals file decryption
              </li>
              <li className="flex items-center gap-2 text-red-400">
                <span className="text-red-500">✕</span> Non-tamper-evident audit logs
              </li>
            </ul>
          </div>

          {/* SecureMAX Zero-Trust Model */}
          <div className="p-8 rounded-2xl bg-[#0A1020]/90 border border-cyan-500/40 relative overflow-hidden shadow-[0_0_40px_rgba(6,182,212,0.15)]">
            <div className="absolute top-0 right-0 px-3 py-1 bg-cyan-950/80 border-b border-l border-cyan-500/40 text-cyan-300 text-[10px] font-mono uppercase tracking-wider">
              SecureMAX Zero-Trust
            </div>
            <div className="w-12 h-12 rounded-xl bg-cyan-950/40 border border-cyan-500/40 flex items-center justify-center text-cyan-400 mb-6 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Decoupled Cryptographic Enclaves</h3>
            <p className="text-xs text-zinc-400 leading-relaxed mb-6 font-light">
              Files are encrypted with unique AES-256-GCM data encryption keys (DEK). The DEK is sealed under a master key. Decryption requires live validation of device posture, role, and single-use challenge.
            </p>
            <ul className="space-y-3 text-xs font-mono text-zinc-300">
              <li className="flex items-center gap-2 text-cyan-400">
                <span className="text-cyan-400">✓</span> AES-256-GCM envelope encryption
              </li>
              <li className="flex items-center gap-2 text-cyan-400">
                <span className="text-cyan-400">✓</span> Hardware-bound ECDSA P-256 device key
              </li>
              <li className="flex items-center gap-2 text-cyan-400">
                <span className="text-cyan-400">✓</span> Immutable Sepolia hash anchoring
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* FACTUAL CAPABILITIES SECTION */}
      <section id="capabilities" className="relative z-10 w-full max-w-7xl mx-auto px-6 py-20 border-t border-cyan-500/15">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="text-[10px] font-mono tracking-[0.25em] text-cyan-400 uppercase font-bold mb-3 flex items-center justify-center gap-2">
            <span className="w-6 h-0.5 bg-cyan-400" />
            IMPLEMENTED ARCHITECTURE
            <span className="w-6 h-0.5 bg-cyan-400" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-4">
            Built for High-Stakes Environments
          </h2>
          <p className="text-zinc-400 text-sm font-light">
            Every feature shown is backed by active backend code, cryptographic key derivation, or smart contract verification.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1 */}
          <div className="p-6 rounded-2xl bg-[#0F172A] border border-slate-800 hover:border-slate-700 transition-colors enterprise-card">
            <div className="w-10 h-10 rounded-xl bg-blue-950/40 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-4">
              <Fingerprint className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-white mb-2">Device Passports</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-light">
              Passwordless authentication via Web Crypto ECDSA P-256 keys generated in the browser enclave. No passwords to leak or brute-force.
            </p>
          </div>

          {/* Card 2 */}
          <div className="p-6 rounded-2xl bg-[#0F172A] border border-slate-800 hover:border-slate-700 transition-colors enterprise-card">
            <div className="w-10 h-10 rounded-xl bg-blue-950/40 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-4">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-white mb-2">Envelope Encryption</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-light">
              Multi-tiered key management ensures file contents remain encrypted at rest in storage. Decryption is performed in-memory only upon strict policy check.
            </p>
          </div>

          {/* Card 3 */}
          <div className="p-6 rounded-2xl bg-[#0F172A] border border-slate-800 hover:border-slate-700 transition-colors enterprise-card">
            <div className="w-10 h-10 rounded-xl bg-blue-950/40 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-4">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-white mb-2">Blockchain Audit Trail</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-light">
              Audit events are cryptographically chained with SHA-256 hashes and anchored on Ethereum Sepolia for non-repudiation and forensic verification.
            </p>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-6 py-10 border-t border-zinc-800/80 flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-500 font-mono tracking-wider gap-4">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-cyan-400" />
          <span className="text-zinc-300 font-bold">SECUREMAX</span>
          <span>•</span>
          <span>SIH 2026 ZERO-TRUST PLATFORM</span>
        </div>
        <div className="flex items-center gap-6">
          <Link href="/login" className="text-cyan-400 hover:underline">
            Enter Application Vault →
          </Link>
        </div>
      </footer>

      {/* Replayable Cinematic Intro Modal */}
      <SecureMaxChainIntro
        isOpen={showIntro}
        onClose={() => setShowIntro(false)}
        onComplete={() => setShowIntro(false)}
      />
    </div>
  );
}
