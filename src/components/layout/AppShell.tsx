'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut, Hexagon, Smartphone, Menu, X } from 'lucide-react';
import { UserRole } from '@/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useDisconnect } from 'wagmi';

interface TopNavItem {
  name: string;
  href: string;
  roles: UserRole[];
}

const navItems: TopNavItem[] = [
  // Admin Command Center & Operations
  { name: 'COMMAND CENTER', href: '/dashboard/admin', roles: [UserRole.ADMIN] },
  { name: 'MY ACCESS', href: '/access', roles: [UserRole.ADMIN, UserRole.USER, UserRole.MANAGER, UserRole.ENGINEER, UserRole.AUDITOR] },
  { name: 'POSITIONS', href: '/positions', roles: [UserRole.ADMIN] },
  { name: 'SOC', href: '/dashboard/soc', roles: [UserRole.ADMIN, UserRole.SECURITY_ANALYST] },
  { name: 'BREACHLAB', href: '/breachlab', roles: [UserRole.ADMIN, UserRole.SECURITY_ANALYST, UserRole.MANAGER] },
  { name: 'IDENTITY', href: '/identity', roles: [UserRole.ADMIN] },
  { name: 'INFRASTRUCTURE', href: '/infrastructure', roles: [UserRole.ADMIN, UserRole.AUDITOR] },
  
  // Shared / User / Auditor tabs
  { name: 'MY DATA', href: '/assets', roles: [UserRole.ADMIN, UserRole.USER, UserRole.MANAGER, UserRole.ENGINEER] },
  { name: 'DEVICES', href: '/devices', roles: [UserRole.ADMIN] },
  { name: 'AUDIT', href: '/audit', roles: [UserRole.ADMIN, UserRole.AUDITOR] },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [role, setRole] = React.useState<UserRole | null>(null);
  const [userName, setUserName] = React.useState<string>('');
  const [deviceName, setDeviceName] = React.useState<string>('');
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  React.useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        if (data?.session) {
          setRole(data.session.role || UserRole.USER);
          setUserName(data.session.name || data.session.email || 'User');
          setDeviceName(data.session.deviceName || 'Verified Terminal');
        } else {
          // If no session, fallback to User mode
          setRole(UserRole.USER);
        }
      })
      .catch(() => {
        setRole(UserRole.USER);
      });
  }, []);

  const activeRole = role || UserRole.USER;
  const filteredNav = navItems.filter((item) => item.roles.includes(activeRole));

  const { disconnect } = useDisconnect();

  const handleDisconnect = async () => {
    try {
      disconnect();
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    window.location.href = '/login';
  };

  return (
    <div className="flex min-h-[100dvh] w-full flex-col bg-zinc-950 text-zinc-100 font-sans">
      {/* Top Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-800 bg-[#0a0a0c] px-6">
        
        {/* LEFT: Logo & Env */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 group">
            <Hexagon className="h-6 w-6 text-cyan-400 group-hover:text-cyan-300 transition-colors" />
            <span className="text-lg font-bold tracking-widest text-zinc-100">SECURE<span className="text-cyan-400">MAX</span></span>
          </Link>
          <div className="hidden md:flex items-center gap-2 border-l border-zinc-800 pl-6 text-[10px] font-mono tracking-widest text-zinc-400">
            <div className="h-1.5 w-1.5 rounded-full bg-cyan-500"></div>
            CRYPTOGRAPHIC IDENTITY SYSTEM
          </div>
        </div>
        
        {/* CENTER: Role-filtered Navigation */}
        <nav className="hidden lg:flex flex-1 items-center justify-center gap-1 px-6">
          {filteredNav.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href + '/'));
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'px-3.5 py-1 text-xs font-mono tracking-wider transition-colors rounded-sm',
                  isActive 
                    ? 'bg-zinc-900 text-cyan-400 border border-cyan-500/30' 
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
                )}
              >
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* RIGHT: Session, Device & Disconnect */}
        <div className="flex items-center gap-5 text-[10px] font-mono tracking-widest">
          {deviceName && (
            <div className="hidden sm:flex items-center gap-1.5 text-zinc-400 border border-zinc-800 px-2.5 py-1 rounded bg-zinc-900/50">
              <Smartphone className="w-3 h-3 text-cyan-400" />
              <span className="max-w-[120px] truncate">{deviceName}</span>
            </div>
          )}

          <div className="flex flex-col items-end">
            <span className="text-zinc-500 text-[9px]">ROLE</span>
            <span className={cn(
              "font-bold",
              activeRole === UserRole.ADMIN ? "text-cyan-400" : activeRole === UserRole.AUDITOR ? "text-emerald-400" : "text-zinc-200"
            )}>
              {activeRole}
            </span>
          </div>

          <div className="h-6 w-px bg-zinc-800"></div>

          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleDisconnect}
            className="text-zinc-400 hover:text-red-400 hover:bg-red-500/10 text-[10px] font-mono tracking-widest h-8 px-2.5"
          >
            <LogOut className="h-3.5 w-3.5 mr-1.5" />
            DISCONNECT
          </Button>

          {/* Mobile menu hamburger toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 h-8 w-8 p-0 ml-1"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      {/* Mobile Navigation Dropdown */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-b border-zinc-800 bg-[#0a0a0c]/98 backdrop-blur-md px-6 py-4 flex flex-col gap-2 z-50">
          {filteredNav.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href + '/'));
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  'px-3.5 py-2 text-xs font-mono tracking-wider transition-colors rounded-sm flex items-center justify-between',
                  isActive 
                    ? 'bg-zinc-900 text-cyan-400 border border-cyan-500/30' 
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
                )}
              >
                <span>{item.name}</span>
                {isActive && <span className="h-1.5 w-1.5 rounded-full bg-cyan-400"></span>}
              </Link>
            );
          })}
        </div>
      )}
      
      {/* Main Content Area */}
      <main className="flex-1 bg-zinc-950 relative">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-zinc-900/50 via-transparent to-transparent"></div>
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 relative z-10">
          {children}
        </div>
      </main>
    </div>
  );
}
