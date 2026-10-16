'use client';

import * as React from 'react';
import { 
  Folder, 
  Layers, 
  Briefcase, 
  DollarSign, 
  Users, 
  Cpu, 
  Scale, 
  Plus, 
  Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface FolderNavigationProps {
  folderCounts: Record<string, number>;
  totalCount: number;
  activeFolder: string;
  onSelectFolder: (folder: string) => void;
  activeFilter: 'ALL' | 'AUTHORIZED' | 'PENDING' | 'RESTRICTED';
  onSelectFilter: (filter: 'ALL' | 'AUTHORIZED' | 'PENDING' | 'RESTRICTED') => void;
  onOpenUpload: () => void;
}

export function VaultFolderNavigation({
  folderCounts,
  totalCount,
  activeFolder,
  onSelectFolder,
  activeFilter,
  onSelectFilter,
  onOpenUpload,
}: FolderNavigationProps) {
  const folders = [
    { id: 'ALL', name: 'All Files', icon: Layers, count: totalCount },
    { id: 'Projects', name: 'Projects', icon: Briefcase, count: folderCounts['Projects'] || 0 },
    { id: 'Finance', name: 'Finance', icon: DollarSign, count: folderCounts['Finance'] || 0 },
    { id: 'HR', name: 'HR', icon: Users, count: folderCounts['HR'] || 0 },
    { id: 'Engineering', name: 'Engineering', icon: Cpu, count: folderCounts['Engineering'] || 0 },
    { id: 'Legal', name: 'Legal', icon: Scale, count: folderCounts['Legal'] || 0 },
  ];

  const filters = [
    { id: 'ALL', label: 'All' },
    { id: 'AUTHORIZED', label: 'Authorized' },
    { id: 'PENDING', label: 'Pending Review' },
    { id: 'RESTRICTED', label: 'Restricted' },
  ] as const;

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
      {/* Folder Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
        {folders.map((f) => {
          const Icon = f.icon;
          const isActive = activeFolder === f.id;
          return (
            <button
              key={f.id}
              onClick={() => onSelectFolder(f.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors shrink-0 ${
                isActive
                  ? 'bg-blue-600/10 text-blue-400 border border-blue-500/30'
                  : 'bg-slate-900/40 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-400' : 'text-slate-500'}`} />
              <span>{f.name}</span>
              <Badge 
                variant="outline" 
                className={`text-[10px] px-1.5 py-0 rounded-full font-mono ${
                  isActive ? 'border-blue-500/40 text-blue-300 bg-blue-950/40' : 'border-slate-800 text-slate-500'
                }`}
              >
                {f.count}
              </Badge>
            </button>
          );
        })}
      </div>

      {/* Action Strip: Status Filter & Upload Button */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Status Filter Pills */}
        <div className="flex items-center bg-slate-900/60 border border-slate-800 rounded-lg p-1 text-[11px] font-mono">
          <Filter className="w-3 h-3 text-slate-500 ml-2 mr-1" />
          {filters.map((flt) => (
            <button
              key={flt.id}
              onClick={() => onSelectFilter(flt.id)}
              className={`px-2 py-1 rounded transition-colors ${
                activeFilter === flt.id
                  ? 'bg-blue-600/20 text-blue-300 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {flt.label}
            </button>
          ))}
        </div>

        {/* Upload Button */}
        <Button
          onClick={onOpenUpload}
          className="bg-blue-600 text-white hover:bg-blue-700 font-medium text-xs shadow-sm flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          Upload file
        </Button>
      </div>
    </div>
  );
}
