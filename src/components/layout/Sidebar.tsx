'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Shield, 
  Activity, 
  HardDrive, 
  Key, 
  List, 
  LayoutDashboard, 
  ShieldCheck, 
  Smartphone,
  Server,
  Fingerprint,
  Users
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserRole } from '@/types';

interface NavItem {
  name: string;
  href: string;
  icon: any;
  roles: UserRole[];
}

const navItems: NavItem[] = [
  // Admin & Security
  { name: 'Admin Console', href: '/dashboard/admin', icon: ShieldCheck, roles: [UserRole.ADMIN] },
  { name: 'Positions & Roles', href: '/positions', icon: Users, roles: [UserRole.ADMIN] },
  { name: 'BreachLab Adversarial', href: '/breachlab', icon: Activity, roles: [UserRole.ADMIN, UserRole.SECURITY_ANALYST] },
  { name: 'SOC Dashboard', href: '/dashboard/soc', icon: LayoutDashboard, roles: [UserRole.ADMIN, UserRole.SECURITY_ANALYST] },
  { name: 'Identity Registry', href: '/identity', icon: Fingerprint, roles: [UserRole.ADMIN] },
  { name: 'Sepolia Infra', href: '/infrastructure', icon: Server, roles: [UserRole.ADMIN, UserRole.AUDITOR] },
  { name: 'Incident Center', href: '/security/incidents', icon: Shield, roles: [UserRole.ADMIN, UserRole.SECURITY_ANALYST, UserRole.AUDITOR] },
  
  // Auditor
  { name: 'Audit Trail', href: '/audit', icon: List, roles: [UserRole.ADMIN, UserRole.AUDITOR] },
  
  // User & Assets
  { name: 'My Secure Data', href: '/assets', icon: HardDrive, roles: [UserRole.ADMIN, UserRole.USER, UserRole.MANAGER, UserRole.ENGINEER] },
  { name: 'Enrolled Devices', href: '/devices', icon: Smartphone, roles: [UserRole.ADMIN, UserRole.USER] },
  { name: 'Access Requests', href: '/access', icon: Key, roles: [UserRole.ADMIN, UserRole.USER, UserRole.MANAGER, UserRole.ENGINEER] },
];

interface SidebarProps {
  onNavigate?: () => void;
  isMobile?: boolean;
}

export function Sidebar({ onNavigate, isMobile }: SidebarProps) {
  const pathname = usePathname();
  
  const [role, setRole] = React.useState<UserRole>(UserRole.USER);
  const [userName, setUserName] = React.useState('Loading...');
  const [deviceName, setDeviceName] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        if (data?.session) {
          setRole(data.session.role || UserRole.USER);
          setUserName(data.session.name || data.session.email || 'Authorized User');
          setDeviceName(data.session.deviceName || null);
        }
      })
      .catch(console.error);
  }, []);

  const filteredNav = navItems.filter((item) => item.roles.includes(role));

  const getRoleLabel = () => {
    if (role === UserRole.ADMIN) return 'System Administrator';
    if (role === UserRole.AUDITOR) return 'Compliance Auditor';
    return 'Authorized User';
  };

  return (
    <div className={cn("flex h-full flex-col bg-[#0a0a0c] backdrop-blur-xl border-r border-zinc-800", !isMobile && "w-64")}>
      {!isMobile && (
        <div className="flex h-16 items-center px-6 border-b border-zinc-800">
          <Shield className="h-6 w-6 text-cyan-400 mr-2" />
          <span className="text-lg font-bold tracking-widest text-zinc-100">SECURE<span className="text-cyan-400">MAX</span></span>
        </div>
      )}
      
      <div className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
        <div className="mb-4 px-3 text-[10px] font-mono uppercase tracking-widest text-zinc-500">
          {role === UserRole.ADMIN ? 'Command Center' : role === UserRole.AUDITOR ? 'Audit Portal' : 'User Vault'}
        </div>
        <nav className="space-y-1">
          {filteredNav.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href + '/'));
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  'group flex items-center rounded-sm px-3 py-2 text-xs font-mono tracking-wider transition-all duration-200',
                  isActive
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-[inset_4px_0_0_0_#06b6d4]'
                    : 'text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-100'
                )}
              >
                <item.icon
                  className={cn(
                    'mr-3 h-4 w-4 flex-shrink-0 transition-colors',
                    isActive ? 'text-cyan-400' : 'text-zinc-500 group-hover:text-zinc-300'
                  )}
                  aria-hidden="true"
                />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User & Device Badge at Bottom */}
      <div className="p-4 border-t border-zinc-800 bg-zinc-950/60">
        <div className="flex items-center space-x-3 rounded-md bg-zinc-900/60 p-3 border border-zinc-800/80">
          <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono font-bold text-xs uppercase">
            {role.charAt(0)}
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-xs font-bold text-zinc-100 truncate">{userName}</span>
            <span className="text-[10px] text-cyan-400 font-mono tracking-wider">{getRoleLabel()}</span>
            {deviceName && (
              <span className="text-[9px] text-zinc-500 font-mono truncate flex items-center gap-1 mt-0.5">
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
