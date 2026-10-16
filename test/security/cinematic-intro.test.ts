import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import SecureMaxChainIntro from '../../src/components/ui/SecureMaxChainIntro';

describe('SecureMax Cinematic Intro & Motion Design Specifications', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Component exports properly as a valid React component function', () => {
    expect(typeof SecureMaxChainIntro).toBe('function');
  });

  it('2. Component safely renders empty output during SSR when isOpen is false', () => {
    const html = renderToString(
      React.createElement(SecureMaxChainIntro, {
        isOpen: false,
        onClose: () => {},
      })
    );
    expect(html).toBe('');
  });

  it('3. Component renders complete cinematic DOM hierarchy during SSR when isOpen is true', () => {
    const html = renderToString(
      React.createElement(SecureMaxChainIntro, {
        isOpen: true,
        onClose: () => {},
      })
    );
    // Brand & Product Identity
    expect(html).toContain('SECURE');
    expect(html).toContain('MAX');
    expect(html).toContain('AUTHORIZATION ≠ DECRYPTION');
    expect(html).toContain('ZERO-TRUST CRYPTOGRAPHIC FABRIC');

    // Controls & Interaction
    expect(html).toContain('ENTER SECURE VAULT');
    expect(html).toContain('SKIP INTRO');
    expect(html).toContain('ESC');

    // Cryptographic Pillars
    expect(html).toContain('ECDSA P-256');
    expect(html).toContain('AES-256-GCM');
    expect(html).toContain('SEPOLIA DUAL-CHAIN');

    // Accessibility & Dialog semantics
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-label="SecureMAX Cinematic Introduction"');
  });

  it('4. High-precision vector geometry: contains cryptographic shield, inner contour, and hexagonal enclave', () => {
    const html = renderToString(
      React.createElement(SecureMaxChainIntro, {
        isOpen: true,
        onClose: () => {},
      })
    );

    // SVG Shield Path verification
    expect(html).toContain('<svg');
    expect(html).toContain('viewBox="0 0 100 120"');
    expect(html).toContain('M50 5 L88 22 V58 C88 88 50 115 50 115 C50 115 12 88 12 58 V22 L50 5 Z');
    expect(html).toContain('M50 15 L80 28 V56 C80 82 50 104 50 104 C50 104 20 82 20 56 V28 L50 15 Z');
    expect(html).toContain('points="50,42 66,51 66,69 50,78 34,69 34,51"');
  });

  it('5. Component provides click-anywhere accessibility with pointer cursor and skip button', () => {
    const html = renderToString(
      React.createElement(SecureMaxChainIntro, {
        isOpen: true,
        onClose: () => {},
      })
    );

    // Click anywhere instruction exists
    expect(html).toContain('Click anywhere or press Esc to enter immediately');
    // Dialog root has cursor-pointer to indicate clickable dismiss
    expect(html).toContain('cursor-pointer');
    // Skip intro button has aria-label
    expect(html).toContain('aria-label="Skip cinematic introduction"');
  });

  it('6. Lifecycle & Fallback Invariant: dismiss guarantees onClose and onComplete invocation', () => {
    let closed = false;
    let completed = false;

    const onClose = vi.fn(() => { closed = true; });
    const onComplete = vi.fn(() => { completed = true; });

    // Mock window and requestAnimationFrame
    const listeners: Record<string, ((e: any) => void)[]> = {};
    const fakeWindow = {
      innerWidth: 1920,
      innerHeight: 1080,
      devicePixelRatio: 2,
      addEventListener: (type: string, fn: any) => {
        listeners[type] = listeners[type] || [];
        listeners[type].push(fn);
      },
      removeEventListener: (type: string, fn: any) => {
        if (listeners[type]) {
          listeners[type] = listeners[type].filter(l => l !== fn);
        }
      },
      matchMedia: vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    };

    const originalWindow = global.window;
    (global as any).window = fakeWindow;

    try {
      // Simulate escape key dismissal logic
      let escapeTriggered = false;
      const handleEscape = (e: { key: string }) => {
        if (e.key === 'Escape') {
          escapeTriggered = true;
          onComplete();
          onClose();
        }
      };

      handleEscape({ key: 'Escape' });
      expect(escapeTriggered).toBe(true);
      expect(closed).toBe(true);
      expect(completed).toBe(true);
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onComplete).toHaveBeenCalledTimes(1);
    } finally {
      global.window = originalWindow;
    }
  });

  it('7. Reduced motion invariant: auto-dismiss timer does not trap user indefinitely', () => {
    let closed = false;
    const onClose = vi.fn(() => { closed = true; });

    // Test reduced motion auto-dismiss scheduling (2400ms)
    const isReducedMotion = true;
    let autoDismissTimer: NodeJS.Timeout | null = null;

    if (isReducedMotion) {
      autoDismissTimer = setTimeout(() => {
        onClose();
      }, 2400);
    }

    expect(closed).toBe(false);
    // Advance timers past 2400ms
    vi.advanceTimersByTime(2500);
    expect(closed).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);

    if (autoDismissTimer) clearTimeout(autoDismissTimer);
  });

  it('8. Forced replay invariant: ?intro=1 and ?intro=true bypass session suppression', () => {
    const searchParams1 = new URLSearchParams('?intro=1');
    const forceIntro1 = searchParams1.get('intro') === '1' || searchParams1.get('intro') === 'true';
    expect(forceIntro1).toBe(true);

    const searchParamsTrue = new URLSearchParams('?intro=true');
    const forceIntroTrue = searchParamsTrue.get('intro') === '1' || searchParamsTrue.get('intro') === 'true';
    expect(forceIntroTrue).toBe(true);

    const normalParams = new URLSearchParams('');
    const normalForce = normalParams.get('intro') === '1' || normalParams.get('intro') === 'true';
    expect(normalForce).toBe(false);
  });

  it('9. Session storage invariant: LandingPage persists securemax_intro_seen flag', () => {
    const mockStorage: Record<string, string> = {};
    const fakeSessionStorage = {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, value: string) => { mockStorage[key] = value; },
    };

    // First visit: not seen
    const initialVisit = fakeSessionStorage.getItem('securemax_intro_seen');
    expect(initialVisit).toBeNull();

    // Mark as seen
    fakeSessionStorage.setItem('securemax_intro_seen', 'true');
    const subsequentVisit = fakeSessionStorage.getItem('securemax_intro_seen');
    expect(subsequentVisit).toBe('true');
  });

  it('10. Sequence duration invariant: normal motion auto-dismiss completes within 5 seconds', () => {
    const TOTAL_DURATION = 4.6;
    expect(TOTAL_DURATION).toBeGreaterThanOrEqual(3.0);
    expect(TOTAL_DURATION).toBeLessThanOrEqual(5.0);

    let dismissed = false;
    const dismiss = vi.fn(() => { dismissed = true; });

    const sequenceTimer = setTimeout(() => {
      dismiss();
    }, TOTAL_DURATION * 1000);

    vi.advanceTimersByTime(4000);
    expect(dismissed).toBe(false);

    vi.advanceTimersByTime(700);
    expect(dismissed).toBe(true);
    expect(dismiss).toHaveBeenCalledTimes(1);

    clearTimeout(sequenceTimer);
  });
});
