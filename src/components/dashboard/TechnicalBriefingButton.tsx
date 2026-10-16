'use client';
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { BookOpen, Shield, ChevronRight } from 'lucide-react';
import { TechnicalBriefing } from './TechnicalBriefing';

export function TechnicalBriefingButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div className="bg-[#0a0a0c] border border-zinc-800 rounded-lg p-6 mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 hover:border-zinc-700 transition-colors">
        <div className="flex gap-4">
          <div className="w-12 h-12 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-sm font-mono tracking-widest text-zinc-100 uppercase">How SecureMax Works</h3>
            <p className="text-[10px] font-mono text-zinc-500 mt-1 uppercase tracking-widest max-w-xl leading-relaxed">
              Explore the security architecture, authorization flow, cryptographic controls and enforcement pipeline.
            </p>
          </div>
        </div>
        <button 
          type="button"
          onClick={() => setIsOpen(true)}
          className="bg-zinc-100 hover:bg-white text-zinc-950 font-mono tracking-widest text-[10px] uppercase font-bold px-6 py-3 rounded flex items-center gap-2 shrink-0 transition-colors cursor-pointer select-none touch-manipulation active:opacity-90"
        >
          VIEW HOW SECUREMAX WORKS → <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      
      {isOpen && <TechnicalBriefing onClose={() => setIsOpen(false)} />}
    </>
  );
}
