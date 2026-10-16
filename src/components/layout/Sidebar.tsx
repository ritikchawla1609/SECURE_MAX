'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { 
  Shield, 
  HardDrive, 
  Key, 
  List, 
  LayoutDashboard, 
  ShieldCheck, 
  Smartphone,
  Server,
  Fingerprint,
  ShieldAlert,
  Cpu,
  Users,
  Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserRole } from '@/types';
import { navSections, NavItem } from '@/components/layout/AppShell';

interface SidebarProps {
  onNavigate?: () => void;
  isMobile?: boolean;
}

export function Sidebar({ onNavigate, isMobile }: SidebarProps) {
  const pathname = usePathname();
  
  const [role, setRole] = React.useState<UserRole>(UserRole.USER);
  const [userName, setUserName] = React.useState('Loading...');
  const [deviceName, setDeviceName] = React.useState<string | null>(null);
  const searchParams = useSearchParams();
  const currentQueryTab = searchParams?.get('tab') || searchParams?.get('filter') || '';

  const isItemActive = (item: NavItem) => {
    if (item.tabMatch) {
      return pathname === '/assets' && (currentQueryTab === 'shared');
    }
    if (item.href === '/assets') {
      return pathname === '/assets' && (currentQueryTab !== 'shared');
    }
    if (item.href === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href + '/'));
  };

  const getRoleLabel = () => {
    if (role === UserRole.ADMIN) return 'System Administrator';
    if (role === UserRole.AUDITOR) return 'Compliance Auditor';
    if (role === UserRole.SECURITY_ANALYST) return 'Security Analyst';
    if (role === UserRole.MANAGER) return 'Security Manager';
    if (role === UserRole.ENGINEER) return 'Systems Engineer';
    return 'Authorized User';
  };

  return (
    <div className={cn("flex h-full flex-col bg-[#0F172A] border-r border-slate-800", !isMobile && "w-64")}>
      {!isMobile && (
        <div className="flex h-16 items-center px-6 border-b border-slate-800">
          <Link href="/dashboard" className="flex items-center gap-3 group focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg">
            <div className="w-8 h-8 rounded-lg bg-blue-950/60 border border-blue-500/40 flex items-center justify-center text-blue-400 group-hover:border-blue-400 transition-colors">
              <Shield className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold tracking-tight text-white flex items-center">
                Secure<span className="text-blue-400">MAX</span>
              </span>
              <span className="text-[9px] font-mono tracking-wider text-slate-400 uppercase -mt-0.5">
                Zero-Trust Security
              </span>
            </div>
          </Link>
        </div>
      )}
      
      <div className="flex-1 py-5 px-3 space-y-6 overflow-y-auto">
        {navSections.map((section) => {
          const visibleItems = section.items.filter((item) => item.roles.includes(role));
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.title} className="space-y-1">
              <div className="px-3 mb-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
                {section.title}
              </div>
              <nav className="space-y-0.5">
                {visibleItems.map((item) => {
                  const active = isItemActive(item);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        'group flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                        active
                          ? 'bg-blue-600/10 text-blue-400 border border-blue-500/30 font-semibold'
                          : 'text-slate-300 hover:bg-slate-800/60 hover:text-white border border-transparent'
                      )}
                    >
                      <div className="flex items-center gap-3 truncate">
                        <Icon
                          className={cn(
                            'w-4 h-4 shrink-0 transition-colors',
                            active ? 'text-blue-400' : 'text-slate-400 group-hover:text-slate-200'
                          )}
                          aria-hidden="true"
                        />
                        <span className="truncate">{item.name}</span>
                      </div>
                      {item.badge && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>
          );
        })}
      </div>

      {/* User & Device Badge at Bottom */}
      <div className="p-4 border-t border-slate-800 bg-[#0B0F19]/80">
        <div className="flex items-center space-x-3 rounded-lg bg-slate-900/60 p-2.5 border border-slate-800">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white font-bold text-xs uppercase shrink-0">
            {role.charAt(0)}
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-xs font-semibold text-slate-100 truncate">{userName}</span>
            <span className="text-[10px] text-blue-400 font-mono tracking-wider truncate">{getRoleLabel()}</span>
            {deviceName && (
              <span className="text-[9px] text-slate-400 font-mono truncate flex items-center gap-1 mt-0.5">
                <Smartphone className="w-2.5 h-2.5" />
                {deviceName}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
