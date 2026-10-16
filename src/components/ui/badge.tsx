import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground shadow',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground shadow',
        outline: 'text-foreground',
        // Security severity badges
        critical: 'border-transparent bg-red-500/20 text-red-400 border-red-500/30',
        high: 'border-transparent bg-orange-500/20 text-orange-400 border-orange-500/30',
        medium: 'border-transparent bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
        low: 'border-transparent bg-blue-500/20 text-blue-400 border-blue-500/30',
        // Status badges
        active: 'border-transparent bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        pending: 'border-transparent bg-amber-500/20 text-amber-400 border-amber-500/30',
        denied: 'border-transparent bg-red-500/20 text-red-400 border-red-500/30',
        expired: 'border-transparent bg-slate-500/20 text-slate-400 border-slate-500/30',
        // Classification badges
        restricted: 'border-transparent bg-purple-500/20 text-purple-400 border-purple-500/30',
        confidential: 'border-transparent bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
