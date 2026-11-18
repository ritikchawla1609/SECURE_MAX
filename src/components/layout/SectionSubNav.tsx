'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export interface SubNavTab {
  label: string;
  href: string;
  badge?: string | number;
}

export function SectionSubNav({ 
  tabs, 
  title, 
  description 
}: { 
  tabs: SubNavTab[]; 
  title?: string; 
  description?: string; 
}) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 mb-6 border-b border-zinc-800/80">
      {title && (
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{title}</h1>
          {description && <p className="text-xs text-zinc-400 font-mono mt-0.5">{description}</p>}
        </div>
      )}
      <div className="flex items-center gap-1.5 p-1 bg-zinc-900/80 border border-zinc-800 rounded-xl overflow-x-auto max-w-full">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'px-3.5 py-1.5 text-xs font-mono font-medium rounded-lg transition-all duration-150 whitespace-nowrap flex items-center gap-2',
                isActive
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
              )}
            >
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span className={cn(
                  'text-[10px] px-1.5 py-0.2 rounded-full font-bold',
                  isActive ? 'bg-cyan-500/20 text-cyan-300' : 'bg-zinc-800 text-zinc-400'
                )}>
                  {tab.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
