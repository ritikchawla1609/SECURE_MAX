'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Lock, ArrowRight, Cpu, Key, Database } from 'lucide-react';

interface SecureMaxChainIntroProps {
  onComplete?: () => void;
  isOpen: boolean;
  onClose: () => void;
}

// Particle interface for canvas simulation
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  baseAlpha: number;
}

export default function SecureMaxChainIntro({ onComplete, isOpen, onClose }: SecureMaxChainIntroProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const isDismissingRef = useRef<boolean>(false);
  const dismissFallbackRef = useRef<NodeJS.Timeout | null>(null);

  const [isVisible, setIsVisible] = useState(isOpen);
  const [phase, setPhase] = useState<'opening' | 'emergence' | 'identity' | 'signature' | 'settled'>('opening');
  const [isReducedMotion, setIsReducedMotion] = useState(false);
  const [telemetryIndex, setTelemetryIndex] = useState(0);

  const TOTAL_DURATION = 4.6; // Total choreographed cinematic duration in seconds

  // Check reduced motion preference
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      setIsReducedMotion(mediaQuery.matches);
      const listener = (e: MediaQueryListEvent) => setIsReducedMotion(e.matches);
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, []);

  // Sync internal visibility when isOpen prop changes
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      isDismissingRef.current = false;
      startTimeRef.current = 0;
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  // Graceful exit transition
  const dismiss = useCallback(() => {
    if (isDismissingRef.current) return;
    isDismissingRef.current = true;
    setIsVisible(false);

    // Fail-safe cleanup: guarantees onClose callback fires even if Framer Motion is suppressed
    if (dismissFallbackRef.current) clearTimeout(dismissFallbackRef.current);
    dismissFallbackRef.current = setTimeout(() => {
      if (onComplete) onComplete();
      onClose();
    }, 600);
  }, [onComplete, onClose]);

  // Handle Framer Motion exit animation completion
  const handleExitComplete = useCallback(() => {
    if (dismissFallbackRef.current) {
      clearTimeout(dismissFallbackRef.current);
      dismissFallbackRef.current = null;
    }
    if (onComplete) onComplete();
    onClose();
    isDismissingRef.current = false;
  }, [onComplete, onClose]);

  // Clean up any pending fallback timer on unmount
  useEffect(() => {
    return () => {
      if (dismissFallbackRef.current) {
        clearTimeout(dismissFallbackRef.current);
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  // Handle ESC key to dismiss immediately
  useEffect(() => {
    if (!isOpen || !isVisible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        dismiss();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isVisible, dismiss]);

  // Choreographed Phase Lifecycle Management (with 100% leak-free timer cleanup)
  useEffect(() => {
    if (!isOpen || !isVisible) return;

    // In reduced motion, present a serene settled posture and auto-dismiss gracefully at 2.4s
    if (isReducedMotion) {
      setPhase('settled');
      const rmTimer = setTimeout(() => {
        dismiss();
      }, 2400);
      return () => clearTimeout(rmTimer);
    }

    setPhase('opening');
    const phaseTimers: NodeJS.Timeout[] = [];

    // Scene 2: Brand Emergence (0.9s)
    phaseTimers.push(setTimeout(() => setPhase('emergence'), 900));
    // Scene 3: Product Identity & Architectural Principle Reveal (2.0s)
    phaseTimers.push(setTimeout(() => setPhase('identity'), 2000));
    // Scene 4: Signature Visual Moment — Key Shackle Engagement & Optical Laser Scan (2.9s)
    phaseTimers.push(setTimeout(() => setPhase('signature'), 2900));
    // Scene 5: Settled Security Posture (3.9s)
    phaseTimers.push(setTimeout(() => setPhase('settled'), 3900));
    // Auto-dismiss transition into the live application (4.6s)
    phaseTimers.push(setTimeout(() => dismiss(), 4600));

    return () => {
      phaseTimers.forEach(clearTimeout);
    };
  }, [isOpen, isVisible, isReducedMotion, dismiss]);

  // Telemetry ticker rotation
  useEffect(() => {
    if (!isOpen || !isVisible) return;
    const interval = setInterval(() => {
      setTelemetryIndex((prev) => (prev + 1) % 4);
    }, 1100);
    return () => clearInterval(interval);
  }, [isOpen, isVisible]);

  // Canvas-based cinematic simulation: Dual-chain orbital rings, laser sweep, and quantum data mesh
  useEffect(() => {
    if (!isOpen || !isVisible) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;

    // Handle high-DPI scaling safely capped at 2 for optimal 60fps on mobile & retina
    const handleResize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    const cx = width / 2;
    const cy = height / 2;

    // If user prefers reduced motion, draw a single elegant static atmospheric frame and stop
    if (isReducedMotion) {
      ctx.fillStyle = '#020409';
      ctx.fillRect(0, 0, width, height);

      const glowGrad = ctx.createRadialGradient(cx, cy, 20, cx, cy, Math.max(width, height) * 0.65);
      glowGrad.addColorStop(0, 'rgba(6, 182, 212, 0.12)');
      glowGrad.addColorStop(0.35, 'rgba(14, 116, 144, 0.05)');
      glowGrad.addColorStop(0.7, 'rgba(2, 6, 23, 0.6)');
      glowGrad.addColorStop(1, 'rgba(2, 4, 9, 1)');
      ctx.fillStyle = glowGrad;
      ctx.fillRect(0, 0, width, height);

      return () => {
        window.removeEventListener('resize', handleResize);
      };
    }

    // Initialize quantum data particles
    const particleCount = 32;
    const particles: Particle[] = [];
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        radius: Math.random() * 1.4 + 0.8,
        alpha: Math.random() * 0.5 + 0.2,
        baseAlpha: Math.random() * 0.4 + 0.2,
      });
    }

    startTimeRef.current = 0;

    const render = (timestamp: number) => {
      if (isDismissingRef.current) {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        return;
      }

      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = (timestamp - startTimeRef.current) / 1000;

      const centerCurrentX = width / 2;
      const centerCurrentY = height / 2;

      // 1. Deep Obsidian Clear & Atmospheric Radial Lighting
      ctx.fillStyle = '#020409';
      ctx.fillRect(0, 0, width, height);

      // Subtle atmospheric radial glow centered on the cryptographic core
      const glowGrad = ctx.createRadialGradient(
        centerCurrentX,
        centerCurrentY,
        20,
        centerCurrentX,
        centerCurrentY,
        Math.max(width, height) * 0.65
      );
      glowGrad.addColorStop(0, 'rgba(6, 182, 212, 0.12)');
      glowGrad.addColorStop(0.35, 'rgba(14, 116, 144, 0.05)');
      glowGrad.addColorStop(0.7, 'rgba(2, 6, 23, 0.6)');
      glowGrad.addColorStop(1, 'rgba(2, 4, 9, 1)');
      ctx.fillStyle = glowGrad;
      ctx.fillRect(0, 0, width, height);

      // 2. High-Tech Precision Alignment Grid & Reticles
      const gridAlpha = Math.min(elapsed * 0.8, 1) * 0.04;
      if (gridAlpha > 0.005) {
        ctx.save();
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 0.5;
        ctx.globalAlpha = gridAlpha;
        const gridSize = 56;
        for (let x = (centerCurrentX % gridSize); x < width; x += gridSize) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
        }
        for (let y = (centerCurrentY % gridSize); y < height; y += gridSize) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }
        ctx.restore();
      }

      // 3. Cryptographic Data Particle Mesh
      ctx.save();
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;

        // Wrap around borders
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(34, 211, 238, ${p.alpha * Math.min(elapsed, 1)})`;
        ctx.fill();

        // Connect nearby particles with subtle fiber-optic filaments
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 85) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(34, 211, 238, ${0.08 * (1 - dist / 85) * Math.min(elapsed, 1)})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }
      ctx.restore();

      // 4. Concentric Dual-Chain Orbital Rings & HUD Geometry
      const ringAlpha = Math.min(Math.max((elapsed - 0.4) * 0.9, 0), 1);
      if (ringAlpha > 0.01) {
        ctx.save();
        ctx.translate(centerCurrentX, centerCurrentY);

        // Chain 1: Sepolia Ethereum Outer Orbital Ring (Clockwise)
        ctx.save();
        ctx.rotate(elapsed * 0.22);
        ctx.beginPath();
        ctx.arc(0, 0, 155, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(6, 182, 212, ${0.18 * ringAlpha})`;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 8]);
        ctx.stroke();

        // Chain 1 Satellite Validation Nodes
        for (let i = 0; i < 4; i++) {
          const angle = (i * Math.PI) / 2;
          const nx = Math.cos(angle) * 155;
          const ny = Math.sin(angle) * 155;
          ctx.beginPath();
          ctx.arc(nx, ny, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(34, 211, 238, ${0.65 * ringAlpha})`;
          ctx.fill();
        }
        ctx.restore();

        // Chain 2: Local KMS Enclave Inner Orbital Ring (Counter-Clockwise)
        ctx.save();
        ctx.rotate(-elapsed * 0.35);
        ctx.beginPath();
        ctx.arc(0, 0, 115, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(59, 130, 246, ${0.22 * ringAlpha})`;
        ctx.lineWidth = 1.2;
        ctx.setLineDash([12, 16, 2, 16]);
        ctx.stroke();

        // Inner Reticle Crosshairs at Cardinal Angles
        ctx.setLineDash([]);
        ctx.strokeStyle = `rgba(34, 211, 238, ${0.28 * ringAlpha})`;
        ctx.lineWidth = 1;
        const tickLen = 6;
        for (let i = 0; i < 4; i++) {
          const a = (i * Math.PI) / 2;
          const r1 = 109;
          const r2 = r1 + tickLen;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
          ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
          ctx.stroke();
        }
        ctx.restore();

        // 5. Signature Visual Moment: Cryptographic Shockwave Pulse & Optical Laser Sweep
        if (elapsed > 2.8) {
          const shockElapsed = elapsed - 2.8;
          const shockRadius = 40 + shockElapsed * 260;
          const shockAlpha = Math.max(0, 1 - shockElapsed / 1.1) * 0.5;

          if (shockAlpha > 0.01) {
            ctx.beginPath();
            ctx.arc(0, 0, shockRadius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(34, 211, 238, ${shockAlpha})`;
            ctx.lineWidth = 2;
            ctx.shadowColor = '#22d3ee';
            ctx.shadowBlur = 14;
            ctx.stroke();
            ctx.shadowBlur = 0;
          }

          // Optical Laser Sweep Line across the fortress shield
          const sweepY = -120 + shockElapsed * 240;
          if (sweepY > -130 && sweepY < 130) {
            const sweepGrad = ctx.createLinearGradient(-140, sweepY, 140, sweepY);
            sweepGrad.addColorStop(0, 'rgba(6, 182, 212, 0)');
            sweepGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.9)');
            sweepGrad.addColorStop(1, 'rgba(6, 182, 212, 0)');

            ctx.beginPath();
            ctx.moveTo(-130, sweepY);
            ctx.lineTo(130, sweepY);
            ctx.strokeStyle = sweepGrad;
            ctx.lineWidth = 1.5;
            ctx.shadowColor = '#67e8f9';
            ctx.shadowBlur = 10;
            ctx.stroke();
            ctx.shadowBlur = 0;
          }
        }

        ctx.restore();
      }

      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isOpen, isVisible, isReducedMotion]);

  const telemetryLines = [
    'PROTOCOL: ZERO-TRUST ENCLAVE • INITIALIZING HARNESS',
    'POSTURE: CLIENT HARDWARE P-256 PASSPORT VALIDATED',
    'ORACLE: DUAL-CHAIN KMS & SEPOLIA LEDGER SYNCHRONIZED',
    'STATUS: CRYPTOGRAPHIC VAULT ARMED • AUTHORIZATION ≠ DECRYPTION',
  ];

  return (
    <AnimatePresence onExitComplete={handleExitComplete}>
      {isOpen && isVisible && (
        <motion.div
          key="securemax-cinematic-intro"
          role="dialog"
          aria-modal="true"
          aria-label="SecureMAX Cinematic Introduction"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.04, filter: 'blur(8px)' }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-[9999] bg-[#020409] flex flex-col items-center justify-between select-none overflow-y-auto overflow-x-hidden min-h-screen cursor-pointer"
          onClick={dismiss}
        >
          {/* Background Canvas Layer */}
          <canvas ref={canvasRef} className="absolute inset-0 z-0 pointer-events-none" />

          {/* Ambient Corner Tactical Crosshairs */}
          <div className="absolute top-6 left-6 pointer-events-none z-10 flex flex-col gap-1">
            <div className="w-4 h-4 border-t-2 border-l-2 border-cyan-500/40" />
            <span className="font-mono text-[9px] text-cyan-400/60 tracking-widest pl-1">SM//SEC-ENCLAVE</span>
          </div>
          <div className="absolute top-6 right-20 pointer-events-none z-10 hidden sm:flex flex-col items-end gap-1">
            <div className="w-4 h-4 border-t-2 border-r-2 border-cyan-500/40" />
            <span className="font-mono text-[9px] text-zinc-500 tracking-widest">SYS_REF: 0x7A9B4F</span>
          </div>
          <div className="absolute bottom-6 left-6 pointer-events-none z-10 hidden sm:flex items-center gap-2">
            <div className="w-4 h-4 border-b-2 border-l-2 border-cyan-500/40" />
            <span className="font-mono text-[9px] text-zinc-500 tracking-widest">SIH 2026 PRIME</span>
          </div>
          <div className="absolute bottom-6 right-6 pointer-events-none z-10 hidden sm:flex items-center gap-2">
            <span className="font-mono text-[9px] text-cyan-400/60 tracking-widest">AES-256-GCM SEALED</span>
            <div className="w-4 h-4 border-b-2 border-r-2 border-cyan-500/40" />
          </div>

          {/* ==================================================================== */}
          {/* TOP HUD BAR: BRAND BEACON & SKIP CONTROLS                             */}
          {/* ==================================================================== */}
          <header className="relative z-20 w-full max-w-7xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6 flex items-center justify-between">
            {/* Left Live Status Beacon */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-950/40 border border-cyan-500/30 backdrop-blur-md shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                </span>
                <span className="font-mono text-[10px] tracking-wider text-cyan-300 uppercase font-semibold">
                  ENCLAVE BOOT SEQUENCE
                </span>
              </div>
            </div>

            {/* Right Skip Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                dismiss();
              }}
              className="group px-4 py-1.5 rounded-full bg-zinc-950/80 hover:bg-cyan-950/60 border border-zinc-800 hover:border-cyan-500/50 text-[11px] font-mono tracking-wider text-zinc-400 hover:text-white transition-all duration-200 cursor-pointer shadow-lg hover:shadow-[0_0_15px_rgba(6,182,212,0.3)] flex items-center gap-2 active:scale-95 focus:outline-none focus:ring-2 focus:ring-cyan-400"
              aria-label="Skip cinematic introduction"
            >
              <span>SKIP INTRO</span>
              <kbd className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-[9px] text-zinc-400 group-hover:text-cyan-300">
                ESC
              </kbd>
            </button>
          </header>

          {/* ==================================================================== */}
          {/* CENTER HERO CHOREOGRAPHY: EMBLEM, WORDMARK & PROPOSITION             */}
          {/* ==================================================================== */}
          <main className="relative z-10 w-full max-w-3xl mx-auto px-4 sm:px-6 py-2 sm:py-4 flex flex-col items-center justify-center text-center my-auto">
            {/* Micro Telemetry Ticker */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mb-4 sm:mb-6 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/60 border border-cyan-500/20 backdrop-blur-md"
            >
              <Cpu className="w-3 h-3 text-cyan-400 animate-pulse" />
              <span className="font-mono text-[10px] tracking-[0.2em] text-cyan-300/80 uppercase">
                {telemetryLines[telemetryIndex]}
              </span>
            </motion.div>

            {/* Central Holographic Emblem: Multi-Layered Cryptographic Shield */}
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ 
                scale: phase === 'opening' ? 0.92 : phase === 'signature' || phase === 'settled' ? 1.05 : 1, 
                opacity: 1 
              }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-28 h-32 sm:w-36 sm:h-40 flex items-center justify-center mb-4 sm:mb-6"
            >
              {/* Ambient Radial Core Glow */}
              <div className="absolute inset-0 rounded-full bg-cyan-500/25 blur-3xl animate-pulse" />
              <div className="absolute inset-2 rounded-full bg-blue-600/20 blur-xl" />

              {/* Precision SVG Shield */}
              <svg 
                className="w-full h-full drop-shadow-[0_0_30px_rgba(6,182,212,0.65)]" 
                viewBox="0 0 100 120" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <linearGradient id="shieldFill" x1="50" y1="5" x2="50" y2="115" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#081426" stopOpacity="0.95" />
                    <stop offset="0.6" stopColor="#040b17" stopOpacity="0.98" />
                    <stop offset="1" stopColor="#020409" stopOpacity="1" />
                  </linearGradient>
                  <linearGradient id="shieldStroke" x1="0" y1="0" x2="100" y2="120" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#67e8f9" />
                    <stop offset="0.4" stopColor="#06b6d4" />
                    <stop offset="0.8" stopColor="#2563eb" />
                    <stop offset="1" stopColor="#0891b2" />
                  </linearGradient>
                  <linearGradient id="coreGlow" x1="50" y1="35" x2="50" y2="85" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#22d3ee" stopOpacity="0.3" />
                    <stop offset="1" stopColor="#06b6d4" stopOpacity="0.05" />
                  </linearGradient>
                </defs>

                {/* Main Outer Shield Path */}
                <motion.path
                  d="M50 5 L88 22 V58 C88 88 50 115 50 115 C50 115 12 88 12 58 V22 L50 5 Z"
                  fill="url(#shieldFill)"
                  stroke="url(#shieldStroke)"
                  strokeWidth="2.5"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1.4, ease: 'easeInOut' }}
                />

                {/* Inner Faceted Contour Lines */}
                <path
                  d="M50 15 L80 28 V56 C80 82 50 104 50 104 C50 104 20 82 20 56 V28 L50 15 Z"
                  stroke="rgba(34, 211, 238, 0.25)"
                  strokeWidth="1"
                  fill="url(#coreGlow)"
                />

                {/* Hexagonal Enclave Chamber */}
                <polygon
                  points="50,42 66,51 66,69 50,78 34,69 34,51"
                  stroke="rgba(34, 211, 238, 0.7)"
                  strokeWidth="1.5"
                  fill="rgba(6, 182, 212, 0.15)"
                />
              </svg>

              {/* Hardware Key Shackle: Precision Slide & Lock Engagement */}
              <motion.div
                initial={{ y: -16, opacity: 0 }}
                animate={{ 
                  y: phase === 'opening' || phase === 'emergence' ? -8 : 0, 
                  opacity: 1 
                }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
              >
                <div className="w-10 h-10 rounded-xl bg-cyan-950/80 border border-cyan-400/80 flex items-center justify-center text-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.8)]">
                  <Lock className="w-5 h-5 stroke-[2.5]" />
                </div>
              </motion.div>
            </motion.div>

            {/* Typography: Category Kicker */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="flex items-center justify-center gap-3 mb-2"
            >
              <span className="w-8 h-px bg-gradient-to-r from-transparent to-cyan-400/70" />
              <span className="text-[10px] sm:text-xs font-mono tracking-[0.35em] text-cyan-400 font-bold uppercase">
                ZERO-TRUST CRYPTOGRAPHIC FABRIC
              </span>
              <span className="w-8 h-px bg-gradient-to-l from-transparent to-cyan-400/70" />
            </motion.div>

            {/* Main Title Wordmark: SECUREMAX */}
            <motion.h1
              initial={{ opacity: 0, scale: 0.94, letterSpacing: '0.12em' }}
              animate={{ opacity: 1, scale: 1, letterSpacing: '0.02em' }}
              transition={{ duration: 0.8, delay: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="text-4xl sm:text-6xl lg:text-7xl font-black text-white tracking-tight uppercase leading-none mb-3 sm:mb-4 select-none"
            >
              SECURE<span className="bg-gradient-to-r from-cyan-300 via-cyan-400 to-blue-500 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(6,182,212,0.85)]">MAX</span>
            </motion.h1>

            {/* The Distinctive Architectural Principle */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1.0 }}
              className="mb-4 sm:mb-5 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-950/40 border border-cyan-400/50 backdrop-blur-md shadow-[0_0_20px_rgba(6,182,212,0.25)]"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse" />
              <span className="text-xs sm:text-sm font-mono font-bold tracking-wider text-white">
                AUTHORIZATION ≠ DECRYPTION
              </span>
            </motion.div>

            {/* Concise Sub-Tagline */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 1.3 }}
              className="text-xs sm:text-sm text-zinc-400 font-light max-w-lg leading-relaxed mb-4 sm:mb-6"
            >
              Decoupled cryptographic enclaves, hardware-bound device passports, and immutable dual-chain verifiable audit trails.
            </motion.p>

            {/* Enterprise Security Pillar Chips */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1.6 }}
              className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 mb-6 sm:mb-8 text-[10px] sm:text-[11px] font-mono text-zinc-400"
            >
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-zinc-900/80 border border-zinc-800 text-zinc-300">
                <Key className="w-3 h-3 text-cyan-400" />
                <span>ECDSA P-256</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-zinc-900/80 border border-zinc-800 text-zinc-300">
                <Shield className="w-3 h-3 text-cyan-400" />
                <span>AES-256-GCM</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-zinc-900/80 border border-zinc-800 text-zinc-300">
                <Database className="w-3 h-3 text-cyan-400" />
                <span>SEPOLIA DUAL-CHAIN</span>
              </div>
            </motion.div>

            {/* Primary Call to Action: ENTER SECURE VAULT */}
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 1.9 }}
              className="flex flex-col items-center gap-2"
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  dismiss();
                }}
                className="px-7 py-3 rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 hover:from-cyan-300 hover:to-indigo-500 text-white font-bold font-mono text-xs sm:text-sm tracking-wider shadow-[0_0_25px_rgba(6,182,212,0.4)] hover:shadow-[0_0_35px_rgba(6,182,212,0.7)] transition-all duration-200 flex items-center gap-2.5 cursor-pointer active:scale-95 group focus:outline-none focus:ring-2 focus:ring-cyan-400"
              >
                <span>ENTER SECURE VAULT</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
              <span className="text-[10px] font-mono text-zinc-500">
                Click anywhere or press Esc to enter immediately
              </span>
            </motion.div>
          </main>

          {/* ==================================================================== */}
          {/* BOTTOM HUD: SEQUENCE PROGRESS BAR & FOOTER METADATA                  */}
          {/* ==================================================================== */}
          <footer className="relative z-20 w-full max-w-7xl mx-auto px-4 sm:px-6 pb-4 sm:pb-6 flex flex-col gap-2.5">
            {/* Visual Sequence Progress Hairline (GPU Composited Animation) */}
            <div className="w-full h-1 bg-zinc-900/80 rounded-full overflow-hidden border border-zinc-800/60">
              <motion.div 
                key={`progress-indicator-${isOpen ? 'open' : 'closed'}`}
                className="h-full bg-gradient-to-r from-cyan-500 via-teal-400 to-blue-500 shadow-[0_0_12px_#06b6d4]"
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: isReducedMotion ? 2.4 : TOTAL_DURATION, ease: 'linear' }}
              />
            </div>

            <div className="flex items-center justify-between text-[9px] font-mono text-zinc-500">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                SECUREMAX PLATFORM ARCHITECTURE
              </span>
              <span>VERIFIABLE AUDIT & ENCRYPTED FILE SHARING</span>
            </div>
          </footer>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
