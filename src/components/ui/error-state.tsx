'use client';

import * as React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './button';
import { cn } from '@/lib/utils';

interface ErrorStateProps {
  title?: string;
  description?: string;
  error?: string | Error;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = 'An error occurred',
  description = 'Something went wrong while processing your cryptographic request.',
  error,
  onRetry,
  className,
}: ErrorStateProps) {
  const errorMessage = typeof error === 'string' ? error : error?.message;

  return (
    <div
      className={cn(
        'p-8 sm:p-12 rounded-2xl border border-red-500/30 bg-[#160b0e]/70 backdrop-blur-xl text-center space-y-4 max-w-lg mx-auto my-6 font-sans',
        className
      )}
    >
      <div className="w-14 h-14 rounded-2xl bg-red-950/60 border border-red-500/40 flex items-center justify-center mx-auto text-red-400 shadow-[0_0_20px_rgba(244,63,94,0.25)]">
        <AlertCircle className="w-7 h-7" />
      </div>

      <div>
        <h3 className="text-base font-bold text-white tracking-tight">{title}</h3>
        <p className="text-xs text-zinc-400 font-light mt-1 max-w-sm mx-auto leading-relaxed">
          {description}
        </p>
      </div>

      {errorMessage && (
        <div className="p-3 bg-black/60 rounded-xl border border-red-950 text-red-300 font-mono text-[11px] break-words text-left">
          {errorMessage}
        </div>
      )}

      {onRetry && (
        <div className="pt-2">
          <Button
            onClick={onRetry}
            variant="outline"
            size="sm"
            className="border-red-500/40 text-red-300 hover:bg-red-950/40 font-mono text-xs flex items-center gap-2 mx-auto"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </Button>
        </div>
      )}
    </div>
  );
}
