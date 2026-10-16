'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { 
  Shield, 
  Hexagon, 
  HardDrive, 
  Key, 
  List, 
  LayoutDashboard, 
  ShieldCheck, 
  Smartphone, 
  Server, 
  Fingerprint, 
  LogOut, 
  Bell, 
  Search, 
  Menu, 
  X, 
  User, 
  Settings, 
  HelpCircle, 
  Moon, 
  CheckCircle2, 
  AlertTriangle,
  ChevronDown,
  Sparkles,
  ExternalLink,
  ShieldAlert,
  Cpu,
  Users
} from 'lucide-react';
import { UserRole } from '@/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDisconnect } from 'wagmi';

export interface NavItem {
  name: string;
  href: string;
  icon: any;
  roles: UserRole[];
  badge?: string;
  tabMatch?: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const navSections: NavSection[] = [
  {
    title: 'Workspace',
    items: [
      { 
        name: 'Dashboard', 
        href: '/dashboard', 
        icon: LayoutDashboard, 
        roles: [UserRole.ADMIN, UserRole.USER, UserRole.MANAGER, UserRole.ENGINEER, UserRole.AUDITOR, UserRole.SECURITY_ANALYST] 
      },
      { 
        name: 'My Files', 
        href: '/assets', 
        icon: HardDrive, 
        roles: [UserRole.ADMIN, UserRole.USER, UserRole.MANAGER, UserRole.ENGINEER, UserRole.AUDITOR, UserRole.SECURITY_ANALYST] 
      },
      { 
        name: 'Shared With Me', 
        href: '/assets?tab=shared', 
        icon: Shield, 
        roles: [UserRole.ADMIN, UserRole.USER, UserRole.MANAGER, UserRole.ENGINEER, UserRole.AUDITOR, UserRole.SECURITY_ANALYST], 
        tabMatch: 'shared' 
      },
    ],
  },
  {
    title: 'Security',
    items: [
      { 
        name: 'Access Management', 
        href: '/access', 
        icon: Key, 
        roles: [UserRole.ADMIN, UserRole.USER, UserRole.MANAGER, UserRole.ENGINEER, UserRole.AUDITOR, UserRole.SECURITY_ANALYST] 
      },
      { 
        name: 'Audit Logs', 
        href: '/audit', 
        icon: List, 
        roles: [UserRole.ADMIN, UserRole.AUDITOR, UserRole.SECURITY_ANALYST] 
      },
      { 
        name: 'Incident Center', 
        href: '/security/incidents', 
        icon: ShieldAlert, 
        roles: [UserRole.ADMIN, UserRole.SECURITY_ANALYST, UserRole.AUDITOR] 
      },
      { 
        name: 'Security Posture', 
        href: '/dashboard/security', 
        icon: ShieldCheck, 
        roles: [UserRole.ADMIN, UserRole.SECURITY_ANALYST, UserRole.AUDITOR] 
      },
    ],
  },
  {
    title: 'Operations',
    items: [
      { 
        name: 'Admin Console', 
        href: '/dashboard/admin', 
        icon: ShieldCheck, 
        roles: [UserRole.ADMIN] 
      },
      { 
        name: 'Enrolled Devices', 
        href: '/devices', 
        icon: Smartphone, 
        roles: [UserRole.ADMIN, UserRole.USER, UserRole.MANAGER, UserRole.ENGINEER, UserRole.AUDITOR, UserRole.SECURITY_ANALYST] 
      },
      { 
        name: 'SOC Telemetry', 
        href: '/dashboard/soc', 
        icon: Server, 
        roles: [UserRole.ADMIN, UserRole.SECURITY_ANALYST] 
      },
      { 
        name: 'Identity Registry', 
        href: '/identity', 
        icon: Fingerprint, 
        roles: [UserRole.ADMIN] 
      },
      { 
        name: 'Positions & Roles', 
        href: '/positions', 
        icon: Users, 
        roles: [UserRole.ADMIN] 
      },
      { 
        name: 'Blockchain Infrastructure', 
        href: '/infrastructure', 
        icon: Cpu, 
        roles: [UserRole.ADMIN, UserRole.AUDITOR, UserRole.SECURITY_ANALYST, UserRole.MANAGER, UserRole.ENGINEER, UserRole.USER] 
      },
    ],
  },
  {
    title: 'Preferences',
    items: [
      { 
        name: 'Settings', 
        href: '/settings', 
        icon: Settings, 
        roles: [UserRole.ADMIN, UserRole.USER, UserRole.MANAGER, UserRole.ENGINEER, UserRole.AUDITOR, UserRole.SECURITY_ANALYST] 
      },
    ],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const searchParams = useSearchParams();
  const currentQueryTab = searchParams?.get('tab') || searchParams?.get('filter') || '';

  const [role, setRole] = React.useState<UserRole>(UserRole.USER);
  const [userName, setUserName] = React.useState<string>('Alex Johnson');
  const [userEmail, setUserEmail] = React.useState<string>('alex@securemax.mil');
  const [deviceName, setDeviceName] = React.useState<string>('Primary Workstation');
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [systemStatus, setSystemStatus] = React.useState<{ db: string; status: string } | null>(null);

  // Dropdown States
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);
  const [notificationsOpen, setNotificationsOpen] = React.useState(false);
  const [unreadNotifications, setUnreadNotifications] = React.useState(2);

  // Search input state
  const [searchQuery, setSearchQuery] = React.useState('');
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  const userMenuRef = React.useRef<HTMLDivElement>(null);
  const notificationsRef = React.useRef<HTMLDivElement>(null);

  // Keyboard shortcut: ⌘K or Ctrl+K to focus search
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/assets?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  // Check health status
  React.useEffect(() => {
    fetch('/api/health')
      .then(res => res.json())
      .then(data => {
        if (data?.data) {
          setSystemStatus(data.data);
        }
      })
      .catch(() => {});
  }, []);

  // Close menus when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch session data
  React.useEffect(() => {
    fetch('/api/auth/session')
      .then((res) => res.json())
      .then((data) => {
        if (data?.session) {
          setRole(data.session.role || UserRole.USER);
          setUserName(data.session.name || data.session.email || 'Authorized User');
          setUserEmail(data.session.email || 'user@securemax.mil');
          setDeviceName(data.session.deviceName || 'Verified Terminal');
        }
      })
      .catch(() => {});
  }, []);

  const { disconnect } = useDisconnect();

  const handleDisconnect = async () => {
    try {
      disconnect();
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    window.location.href = '/login';
  };

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

  const getRoleBadge = () => {
    if (role === UserRole.ADMIN) return { label: 'System Admin', color: 'border-blue-500/40 text-blue-300 bg-blue-950/40' };
    if (role === UserRole.AUDITOR) return { label: 'Compliance Auditor', color: 'border-emerald-500/40 text-emerald-300 bg-emerald-950/40' };
    if (role === UserRole.SECURITY_ANALYST) return { label: 'Security Analyst', color: 'border-cyan-500/40 text-cyan-300 bg-cyan-950/40' };
    if (role === UserRole.MANAGER) return { label: 'Security Manager', color: 'border-purple-500/40 text-purple-300 bg-purple-950/40' };
    if (role === UserRole.ENGINEER) return { label: 'Systems Engineer', color: 'border-amber-500/40 text-amber-300 bg-amber-950/40' };
    return { label: 'Authorized Member', color: 'border-slate-700 text-slate-300 bg-slate-900/60' };
  };

  const roleInfo = getRoleBadge();

  return (
    <div className="flex min-h-screen bg-[#0B0F19] text-[#F8FAFC] font-sans antialiased selection:bg-blue-600/30">
      
      {/* ==================================================================== */}
      {/* 1. PERSISTENT LEFT SIDEBAR (Desktop)                                  */}
      {/* ==================================================================== */}
      <aside className="hidden lg:flex w-64 flex-col fixed inset-y-0 left-0 z-40 bg-[#0F172A] border-r border-slate-800">
        
        {/* Brand Header */}
        <div className="h-16 flex items-center px-6 border-b border-slate-800">
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

        {/* Navigation Sections */}
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

        {/* User Card at Bottom of Sidebar */}
        <div className="p-4 border-t border-slate-800 bg-[#0B0F19]/80">
          <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-900/60 border border-slate-800">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs uppercase shrink-0">
              {userName.charAt(0)}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs font-semibold text-slate-100 truncate">{userName}</span>
              <span className="text-[10px] text-blue-400 font-mono truncate">{roleInfo.label}</span>
              {deviceName && (
                <span className="text-[9px] text-slate-400 font-mono truncate flex items-center gap-1 mt-0.5">
                  <Smartphone className="w-2.5 h-2.5 text-slate-400" />
                  {deviceName}
                </span>
              )}
            </div>
          </div>
        </div>

      </aside>

      {/* ==================================================================== */}
      {/* 2. MAIN CONTAINER & TOP NAVIGATION BAR                                */}
      {/* ==================================================================== */}
      <div className="flex-1 lg:pl-64 flex flex-col min-h-screen">
        
        {/* TOP NAVIGATION BAR */}
        <header className="sticky top-0 z-30 h-16 bg-[#0F172A]/90 backdrop-blur-md border-b border-slate-800 px-4 sm:px-8 flex items-center justify-between">
          
          {/* Left: Mobile Toggle + Quick Search */}
          <div className="flex items-center gap-4 flex-1 max-w-md">
            {/* Mobile Hamburger */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            {/* Quick Search Input */}
            <form onSubmit={handleSearchSubmit} className="relative w-full hidden sm:block">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search files... (⌘K)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearchSubmit(e);
                  }
                }}
                className="w-full bg-[#0B0F19] border border-slate-700/80 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              />
            </form>
          </div>

          {/* Right: Network Status + Notifications + User Menu */}
          <div className="flex items-center gap-3 sm:gap-4">
            
            {/* System Status Pill */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 text-xs font-mono">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span>{systemStatus?.db === 'CONNECTED' ? 'System & DB Operational' : 'Zero-Trust Node Active'}</span>
            </div>

            {/* Notifications Dropdown */}
            <div className="relative" ref={notificationsRef}>
              <button
                type="button"
                onClick={() => {
                  setNotificationsOpen(!notificationsOpen);
                  if (!notificationsOpen) setUnreadNotifications(0);
                }}
                className="relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadNotifications > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-500" />
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 rounded-xl bg-[#0F172A] border border-slate-800 shadow-xl p-4 text-xs font-sans z-50 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
                    <span className="font-semibold text-white uppercase tracking-wider text-[11px] font-mono">
                      Security Alerts
                    </span>
                    <span className="text-[10px] text-blue-400 font-mono">Live</span>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-slate-200 font-semibold text-[11px]">Audit Ledger Chained</div>
                        <div className="text-slate-400 text-[10px] mt-0.5">SHA-256 block anchored on Sepolia contract.</div>
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 flex items-start gap-2.5">
                      <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-slate-200 font-semibold text-[11px]">Hardware Enclave Active</div>
                        <div className="text-slate-400 text-[10px] mt-0.5">ECDSA P-256 device key verified.</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="h-6 w-px bg-slate-800 hidden sm:block" />

            {/* USER MENU DROPDOWN */}
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 p-1 sm:px-2 sm:py-1 rounded-lg hover:bg-slate-800 border border-transparent hover:border-slate-700 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs uppercase">
                  {userName.charAt(0)}
                </div>
                <div className="hidden sm:flex flex-col text-left">
                  <span className="text-xs font-semibold text-slate-100 truncate max-w-[100px]">{userName}</span>
                  <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider">{roleInfo.label}</span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-xl bg-[#0F172A] border border-slate-800 shadow-xl p-3 text-xs font-sans z-50 animate-in fade-in duration-150">
                  {/* User Profile Header */}
                  <div className="flex items-center gap-3 border-b border-slate-800 pb-3 mb-2">
                    <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs uppercase">
                      {userName.charAt(0)}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold text-white text-xs truncate">{userName}</span>
                      <span className="text-[10px] text-slate-400 truncate">{userEmail}</span>
                      <span className={cn('text-[9px] font-mono px-1.5 py-0.5 rounded border w-fit mt-1 uppercase', roleInfo.color)}>
                        {roleInfo.label}
                      </span>
                    </div>
                  </div>

                  {/* Menu Options */}
                  <div className="space-y-0.5">
                    <Link
                      href="/settings"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                    >
                      <Settings className="w-4 h-4 text-slate-400" />
                      <span>Settings</span>
                    </Link>

                    <Link
                      href="/devices"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                    >
                      <Smartphone className="w-4 h-4 text-slate-400" />
                      <span>Enrolled Devices</span>
                    </Link>

                    <Link
                      href="/access"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                    >
                      <Key className="w-4 h-4 text-slate-400" />
                      <span>Access Management</span>
                    </Link>
                  </div>

                  <div className="border-t border-slate-800 pt-1.5 mt-1.5">
                    <button
                      type="button"
                      onClick={handleDisconnect}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-red-400 hover:bg-red-950/30 hover:text-red-300 text-xs transition-colors cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Log out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        </header>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col p-6 animate-in fade-in">
            <div 
              className="absolute inset-0 -z-10" 
              onClick={() => setMobileMenuOpen(false)} 
              aria-hidden="true" 
            />
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <span className="font-bold text-white text-base">SecureMAX Navigation</span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 py-4 space-y-5 overflow-y-auto">
              {navSections.map((section) => {
                const visibleItems = section.items.filter((item) => item.roles.includes(role));
                if (visibleItems.length === 0) return null;

                return (
                  <div key={section.title} className="space-y-1">
                    <div className="px-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
                      {section.title}
                    </div>
                    <div className="space-y-0.5">
                      {visibleItems.map((item) => {
                        const Icon = item.icon;
                        const active = isItemActive(item);
                        return (
                          <Link
                            key={item.name}
                            href={item.href}
                            onClick={() => setMobileMenuOpen(false)}
                            className={cn(
                              'flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium',
                              active
                                ? 'bg-blue-600/10 text-blue-400 border border-blue-500/30'
                                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                            )}
                          >
                            <Icon className={cn('w-4 h-4', active ? 'text-blue-400' : 'text-slate-400')} />
                            <span>{item.name}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </nav>
            <div className="pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={handleDisconnect}
                className="w-full py-2.5 rounded-lg bg-red-950/50 border border-red-500/40 text-red-400 text-xs font-medium"
              >
                Log out
              </button>
            </div>
          </div>
        )}

        {/* MAIN PAGE CONTENT */}
        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>

      </div>

    </div>
  );
}
