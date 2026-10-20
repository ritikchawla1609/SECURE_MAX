'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import { Shield, ArrowRight } from 'lucide-react';

interface SecureMaxChainIntroProps {
  onComplete?: () => void;
  isOpen: boolean;
  onClose: () => void;
}

// Easing
function easeOutQuart(t: number) { return 1 - Math.pow(1 - t, 4); }
function easeInQuart(t: number) { return t * t * t * t; }
function easeOutBack(t: number) { const c = 2.70158; return 1 + (c+1)*Math.pow(t-1,3) + c*Math.pow(t-1,2); }
function clamp(v: number, lo = 0, hi = 1) { return Math.max(lo, Math.min(hi, v)); }
function lerp(a: number, b: number, t: number) { return a + (b-a) * t; }

export default function SecureMaxChainIntro({ onComplete, isOpen, onClose }: SecureMaxChainIntroProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);

  const dismiss = useCallback(() => {
    if (onComplete) onComplete();
    onClose();
  }, [onComplete, onClose]);

  useEffect(() => {
    if (!isOpen) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    if (!ctx) return;

    let W: number, H: number;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    startRef.current = 0;

    // Timeline (seconds)
    const T = {
      darkIn:   [0.0, 0.8],
      wordmark: [0.4, 1.2],
      lockIn:   [1.5, 2.8],
      final:    [2.8, 3.6],
      autoDone: 5.5,
    };

    function phaseProg(t: number, phase: number[]): number {
      return clamp((t - phase[0]) / (phase[1] - phase[0]));
    }

    // Draw subtle grid
    function drawGrid(alpha: number) {
      if (alpha < 0.005) return;
      ctx.save();
      ctx.globalAlpha = alpha * 0.04;
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 0.5;
      const step = 50;
      for (let x = 0; x < W; x += step) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = 0; y < H; y += step) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
      ctx.restore();
    }

    // Draw lock icon
    function drawLock(cx: number, cy: number, scale: number, alpha: number) {
      if (alpha < 0.005) return;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      ctx.globalAlpha = alpha;

      // HUD ring
      ctx.beginPath();
      ctx.arc(0, 8, 55, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(34,211,238,0.12)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 6]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Shackle
      ctx.beginPath();
      ctx.arc(0, -10, 18, Math.PI, 0);
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.shadowColor = '#22d3ee';
      ctx.shadowBlur = 15;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Body
      const bw = 46, bh = 38, br = 8;
      ctx.beginPath();
      ctx.moveTo(-bw/2 + br, 4);
      ctx.lineTo(bw/2 - br, 4);
      ctx.arcTo(bw/2, 4, bw/2, 4 + br, br);
      ctx.lineTo(bw/2, 4 + bh - br);
      ctx.arcTo(bw/2, 4 + bh, bw/2 - br, 4 + bh, br);
      ctx.lineTo(-bw/2 + br, 4 + bh);
      ctx.arcTo(-bw/2, 4 + bh, -bw/2, 4 + bh - br, br);
      ctx.lineTo(-bw/2, 4 + br);
      ctx.arcTo(-bw/2, 4, -bw/2 + br, 4, br);
      ctx.closePath();

      const bodyGrad = ctx.createLinearGradient(0, 4, 0, 4 + bh);
      bodyGrad.addColorStop(0, 'rgba(10,20,35,0.95)');
      bodyGrad.addColorStop(1, 'rgba(5,10,18,0.98)');
      ctx.fillStyle = bodyGrad;
      ctx.fill();
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#22d3ee';
      ctx.shadowBlur = 20;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Inner border
      ctx.beginPath();
      ctx.roundRect(-bw/2 + 4, 8, bw - 8, bh - 8, 5);
      ctx.strokeStyle = 'rgba(34,211,238,0.2)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Hexagonal shield
      const hexR = 10;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 2;
        const hx = Math.cos(a) * hexR;
        const hy = 17 + Math.sin(a) * hexR;
        i === 0 ? ctx.moveTo(hx, hy) : ctx.lineTo(hx, hy);
      }
      ctx.closePath();
      ctx.strokeStyle = 'rgba(34,211,238,0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = 'rgba(34,211,238,0.1)';
      ctx.fill();

      // Center dot
      ctx.beginPath();
      ctx.arc(0, 17, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#22d3ee';
      ctx.shadowColor = '#22d3ee';
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Keyhole
      ctx.beginPath();
      ctx.moveTo(-2, 24);
      ctx.lineTo(2, 24);
      ctx.lineTo(1.5, 32);
      ctx.lineTo(-1.5, 32);
      ctx.closePath();
      ctx.fillStyle = '#22d3ee';
      ctx.fill();

      ctx.restore();
    }

    // Main loop
    function frame(ts: number) {
      if (!startRef.current) startRef.current = ts;
      const elapsed = (ts - startRef.current) / 1000;

      ctx.fillStyle = '#030508';
      ctx.fillRect(0, 0, W, H);

      const cx = W / 2;
      const cy = H / 2;

      const pDark = phaseProg(elapsed, T.darkIn);
      const pWord = phaseProg(elapsed, T.wordmark);
      const pLock = phaseProg(elapsed, T.lockIn);
      const pFinal = phaseProg(elapsed, T.final);

      // Grid
      drawGrid(easeOutQuart(pDark));

      // Lock
      if (pLock > 0) {
        const lockScale = easeOutBack(clamp(pLock));
        const lockAlpha = easeOutQuart(clamp(pLock * 1.3));
        drawLock(cx, cy, lerp(0.3, 1, lockScale), lockAlpha);
      }

      // DOM updates
      const wordEl = document.getElementById('sm-wordmark');
      const bannerEl = document.getElementById('sm-banner');
      const btnEl = document.getElementById('sm-enter-btn');

      if (wordEl) {
        const wordAlpha = easeOutQuart(pWord);
        const wordFade = pLock > 0.2 ? 1 - easeInQuart(clamp((pLock - 0.2) / 0.5)) : 1;
        const wordReappear = pFinal > 0 ? easeOutQuart(pFinal) : 0;
        wordEl.style.opacity = String(Math.max(wordAlpha * wordFade, wordReappear));
        if (pFinal > 0) {
          wordEl.style.transform = `translateY(-50px) scale(0.7)`;
        } else {
          wordEl.style.transform = `scale(1)`;
        }
      }

      if (bannerEl) {
        bannerEl.style.opacity = String(pFinal > 0 ? easeOutQuart(pFinal) : 0);
        bannerEl.style.transform = pFinal > 0 ? `translateY(0) scale(1)` : `translateY(20px) scale(0.9)`;
      }

      if (btnEl) {
        btnEl.style.opacity = String(pFinal > 0.3 ? easeOutQuart(clamp((pFinal - 0.3) / 0.7)) : 0);
      }

      if (elapsed > T.autoDone) {
        dismiss();
        return;
      }

      rafRef.current = requestAnimationFrame(frame);
    }

    rafRef.current = requestAnimationFrame(frame);

    return () => {
      window.removeEventListener('resize', resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isOpen, dismiss]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-[#030508] flex flex-col items-center justify-center select-none overflow-hidden">

      <canvas ref={canvasRef} className="absolute inset-0 z-0" />

      {/* Wordmark */}
      <div id="sm-wordmark" className="relative z-10 text-center opacity-0 transition-none">
        <div className="text-[10px] font-mono tracking-[0.45em] text-cyan-400/80 uppercase font-bold mb-2 flex items-center justify-center gap-2">
          <span className="w-6 h-px bg-cyan-400/50" />
          ZERO-TRUST FORTRESS
          <span className="w-6 h-px bg-cyan-400/50" />
        </div>
        <h1 className="text-5xl sm:text-7xl lg:text-8xl font-black tracking-tight text-white uppercase">
          SECURE<span className="text-cyan-400">MAX</span>
        </h1>
        <div className="text-[10px] font-mono text-zinc-500 tracking-[0.3em] uppercase mt-2">
          PEOPLE • DATA • TRUST • SIH 2026
        </div>
      </div>

      {/* Bottom banner */}
      <div id="sm-banner" className="absolute bottom-8 z-10 flex flex-col items-center text-center opacity-0 transition-none">
        <div className="px-5 py-2.5 rounded-2xl border border-cyan-400/70 bg-[#06101e]/90 backdrop-blur-xl shadow-[0_0_30px_rgba(6,182,212,0.4)] flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-400/60 flex items-center justify-center">
            <Shield className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-left">
            <div className="text-[11px] sm:text-xs font-black tracking-wide text-white uppercase flex items-center gap-2">
              ZERO-TRUST SECURITY ENCLAVE ARMED
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399] animate-pulse" />
            </div>
            <div className="text-[9px] font-mono text-cyan-400/80 tracking-wider">
              DUAL-CHAIN VALIDATED • DEVICE PASSPORT • KMS LOCKED
            </div>
          </div>
        </div>

        <button
          id="sm-enter-btn"
          type="button"
          onClick={dismiss}
          className="mt-3 px-5 py-1.5 rounded-full bg-gradient-to-r from-cyan-400 to-blue-600 hover:from-cyan-300 hover:to-blue-500 text-black font-mono font-bold text-[11px] tracking-wider shadow-[0_0_20px_rgba(6,182,212,0.35)] cursor-pointer transition-all flex items-center gap-2 active:scale-95 opacity-0"
        >
          ENTER SECURE VAULT
          <ArrowRight className="w-3 h-3 stroke-[2.5]" />
        </button>
      </div>

      {/* Skip */}
      <button
        type="button"
        onClick={dismiss}
        className="fixed top-5 right-5 z-50 px-3 py-1.5 rounded-lg bg-zinc-900/70 border border-zinc-700/50 text-[10px] font-mono text-zinc-400 hover:text-white hover:border-cyan-500/40 transition-all cursor-pointer tracking-wider uppercase"
      >
        Skip ›
      </button>

    </div>
  );
}
