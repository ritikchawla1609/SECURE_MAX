'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useDemoStore } from '@/stores/useDemoStore';
import { Button } from '@/components/ui/button';
import { Play, Square } from 'lucide-react';
import { logPresentationAuditEventAction } from '@/app/actions/audit';

const PHASES = [
  "INITIALIZATION",
  "NORMAL OPERATION",
  "SECURITY CONTROL VALIDATION",
  "TOKEN REPLAY ATTEMPT",
  "AUTHORIZATION ≠ DECRYPTION",
  "INCIDENT INVESTIGATION",
  "AUDIT",
  "RECOVERY"
];

export function PresentationMode() {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const { 
    presentationModeActive, 
    setPresentationMode, 
    presentationStage, 
    setPresentationStage,
    startSimulation,
    advanceAttackPath,
    createIncident,
    resolvePresentationIncidents,
    resetDemo,
    setPostureScore
  } = useDemoStore();

  // Registry for active scheduled timers to guarantee deterministic cleanup
  const timersRef = useRef<NodeJS.Timeout[]>([]);
  // Safeguard: ensure exactly one audit event is logged per presentation run
  const auditEventLoggedRef = useRef<boolean>(false);

  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
  }, []);

  const addTimer = useCallback((fn: () => void, delayMs: number) => {
    const timerId = setTimeout(fn, delayMs);
    timersRef.current.push(timerId);
    return timerId;
  }, []);

  const safeNavigate = useCallback((targetPath: string) => {
    if (pathnameRef.current !== targetPath) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[PRESENTATION] Navigating from ${pathnameRef.current} to ${targetPath}`);
      }
      router.push(targetPath);
    }
  }, [router]);

  const togglePresentation = useCallback(() => {
    if (presentationModeActive) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[PRESENTATION] User stopped presentation mode');
      }
      clearAllTimers();
      auditEventLoggedRef.current = false;
      resetDemo();
      safeNavigate('/dashboard/soc');
    } else {
      if (process.env.NODE_ENV === 'development') {
        console.log('[PRESENTATION] User started presentation mode from stage 0');
      }
      clearAllTimers();
      auditEventLoggedRef.current = false;
      resetDemo();
      setPresentationMode(true);
      setPresentationStage(0);
      safeNavigate('/dashboard/soc');
    }
  }, [presentationModeActive, clearAllTimers, resetDemo, setPresentationMode, setPresentationStage, safeNavigate]);

  useEffect(() => {
    if (!presentationModeActive) {
      clearAllTimers();
      return;
    }

    // Cancel all timers from previous stage to prevent overlapping executions
    clearAllTimers();

    const phaseName = PHASES[presentationStage] || (presentationStage === 8 ? 'FINAL HEALTHY STATE' : 'COMPLETED');
    if (process.env.NODE_ENV === 'development') {
      console.log(`[PRESENTATION] stage ${presentationStage} ${phaseName}`);
    }

    switch (presentationStage) {
      case 0: { // Phase 1: INITIALIZATION
        safeNavigate('/dashboard/soc');
        setPostureScore(98);
        addTimer(() => {
          setPresentationStage(1);
        }, 5000);
        break;
      }

      case 1: { // Phase 2: NORMAL OPERATION
        safeNavigate('/dashboard/soc');
        setPostureScore(98);
        addTimer(() => {
          setPresentationStage(2);
        }, 5000);
        break;
      }

      case 2: { // Phase 3: SECURITY CONTROL VALIDATION
        safeNavigate('/security/sentinel');
        addTimer(() => {
          setPresentationStage(3);
        }, 6000);
        break;
      }

      case 3: { // Phase 4: TOKEN REPLAY ATTEMPT
        safeNavigate('/dashboard/soc');

        // Start controlled sandbox simulation
        startSimulation({
          type: 'token_replay',
          name: 'Token Replay Attempt',
          severity: 'HIGH',
          description: '[CONTROLLED SECURITY TEST] A captured token was replayed in sandbox.',
          blockedAt: 'DOMAIN2'
        });

        // Visibly advance attack path through each gate:
        // IDENTITY -> SESSION -> RBAC -> DOMAIN1 -> DOMAIN2 -> BLOCKED
        addTimer(() => {
          advanceAttackPath('SESSION');
        }, 1200);

        addTimer(() => {
          advanceAttackPath('RBAC');
        }, 2400);

        addTimer(() => {
          advanceAttackPath('DOMAIN1');
          setPostureScore(85);
        }, 3600);

        addTimer(() => {
          advanceAttackPath('DOMAIN2');
          setPostureScore(72);
        }, 4800);

        addTimer(async () => {
          advanceAttackPath('BLOCKED');
          setPostureScore(65);
          createIncident({
            threatId: 'presentation-sim-1',
            title: 'Token Replay Attempt',
            severity: 'HIGH',
            status: 'OPEN',
            detectionLayer: 'Threat Engine',
            blockedLayer: 'Domain 2 (KMS)',
            affectedAsset: 'Asset-7A',
            source: '192.168.1.100 (SANDBOX)'
          });

          // Explicitly await audit event persistence in database
          if (!auditEventLoggedRef.current) {
            auditEventLoggedRef.current = true;
            try {
              const res = await logPresentationAuditEventAction();
              if (process.env.NODE_ENV === 'development') {
                console.log('[PRESENTATION] Audit event persisted to database:', res);
              }
            } catch (err) {
              console.error('[PRESENTATION] Failed to record presentation audit event:', err);
            }
          }
        }, 6000);

        // Transition to next stage
        addTimer(() => {
          setPresentationStage(4);
        }, 7500);
        break;
      }

      case 4: { // Phase 5: AUTHORIZATION ≠ DECRYPTION
        safeNavigate('/dashboard/soc');
        // Visual focus on Second Security Gate: Domain 1 passed, Domain 2 blocked, KMS locked
        addTimer(() => {
          setPresentationStage(5);
        }, 6500);
        break;
      }

      case 5: { // Phase 6: INCIDENT INVESTIGATION
        safeNavigate('/security/incidents');
        addTimer(() => {
          setPresentationStage(6);
        }, 6000);
        break;
      }

      case 6: { // Phase 7: AUDIT
        (async () => {
          // Pre-condition: Guarantee that the audit event is persisted before navigating to /audit
          if (!auditEventLoggedRef.current) {
            auditEventLoggedRef.current = true;
            try {
              await logPresentationAuditEventAction();
            } catch (err) {
              console.error('[PRESENTATION] Error ensuring audit event persistence:', err);
            }
          }
          safeNavigate('/audit');
          router.refresh();
        })();

        addTimer(() => {
          setPresentationStage(7);
        }, 7000);
        break;
      }

      case 7: { // Phase 8: RECOVERY
        safeNavigate('/dashboard/soc');
        resolvePresentationIncidents();
        setPostureScore(98);
        addTimer(() => {
          setPresentationStage(8);
        }, 5000);
        break;
      }

      case 8: { // FINAL HEALTHY STATE
        safeNavigate('/dashboard/soc');
        // Final state reached cleanly. No further scheduled transitions.
        break;
      }

      default:
        break;
    }

    return () => {
      clearAllTimers();
    };
  }, [
    presentationModeActive,
    presentationStage,
    safeNavigate,
    clearAllTimers,
    addTimer,
    startSimulation,
    advanceAttackPath,
    createIncident,
    resolvePresentationIncidents,
    setPostureScore,
    setPresentationStage,
    router
  ]);

  return (
    <>
      {/* Top Presentation HUD Banner */}
      {presentationModeActive && (
        <div className="sticky top-0 z-50 w-full bg-[#0a0a0c] border-b border-zinc-800 shrink-0">
          <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className={`flex h-2 w-2 rounded-full ${presentationStage === 8 ? 'bg-emerald-400' : 'bg-cyan-400 animate-pulse'}`}></span>
              <span className="font-mono font-bold tracking-widest text-zinc-100 text-xs sm:text-sm">PRESENTATION MODE</span>
            </div>
            <div className="flex items-center gap-4 overflow-hidden">
              <span className="font-mono text-[10px] sm:text-xs text-zinc-500 hidden sm:inline">
                PHASE {Math.min(presentationStage + 1, 8)} / {PHASES.length}
              </span>
              <div className={`flex items-center font-mono text-[10px] sm:text-xs px-3 py-1 rounded-sm border whitespace-nowrap truncate max-w-[220px] sm:max-w-none ${
                presentationStage === 8 
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                  : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
              }`}>
                {presentationStage === 8 ? 'DEMO COMPLETED · HEALTHY' : (PHASES[presentationStage] || "COMPLETED")}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Phase 5 Callout Banner: AUTHORIZATION ≠ DECRYPTION */}
      {presentationModeActive && presentationStage === 4 && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 flex items-center justify-center pointer-events-none">
          <div className="bg-[#0a0a0c]/90 backdrop-blur-md border-2 border-red-500/50 p-8 rounded-lg shadow-2xl flex flex-col items-center animate-in zoom-in-95 duration-500">
            <h1 className="text-2xl sm:text-3xl font-bold font-mono text-red-500 mb-2">AUTHORIZATION ≠ DECRYPTION</h1>
            <p className="text-zinc-400 font-mono text-[10px] sm:text-xs tracking-widest text-center max-w-md">
              ASSET AUTHORIZATION (DOMAIN 1) PASSED · KEY AUTHORIZATION (DOMAIN 2) DENIED · DECRYPTION BLOCKED
            </p>
          </div>
        </div>
      )}

      {/* Phase 8 Callout: Recovery success */}
      {presentationModeActive && presentationStage >= 7 && (
        <div className="fixed bottom-24 right-1/2 translate-x-1/2 sm:translate-x-0 sm:right-12 z-40 flex flex-col items-end pointer-events-none animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <div className="bg-[#0a0a0c]/90 backdrop-blur-md border border-emerald-500/30 p-6 rounded-lg shadow-2xl flex flex-col items-center sm:items-end">
            <h1 className="text-xl font-bold font-mono text-zinc-100 tracking-widest">SECURE<span className="text-cyan-400">MAX</span></h1>
            <p className="text-emerald-500 font-mono text-[10px] tracking-widest mt-1">SECURITY FABRIC OPERATIONAL</p>
          </div>
        </div>
      )}

      {/* Persistent Floating Presentation Trigger / Exit Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button 
          onClick={togglePresentation} 
          variant="outline"
          className={`font-mono text-xs tracking-widest px-6 py-4 transition-all duration-300 ${
            presentationModeActive 
              ? 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border-zinc-700' 
              : 'bg-[#0a0a0c] text-zinc-100 hover:bg-zinc-900 border-zinc-800'
          }`}
        >
          {presentationModeActive ? (
            <><Square className="w-3 h-3 mr-2 text-red-400" /> EXIT PRESENTATION</>
          ) : (
            <><Play className="w-3 h-3 mr-2 text-cyan-400" /> START PRESENTATION</>
          )}
        </Button>
      </div>
    </>
  );
}
