import * as React from 'react';
import { Shield, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon: Icon = Shield,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-slate-800 bg-[#0F172A]/60',
        className
      )}
    >
      <div className="w-12 h-12 rounded-xl bg-blue-950/40 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-4 shadow-sm">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-sm font-semibold text-white tracking-tight">
        {title}
      </h3>
      <p className="text-xs text-slate-400 max-w-sm mt-1 leading-relaxed">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button
          size="sm"
          onClick={onAction}
          className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs shadow-sm"
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
