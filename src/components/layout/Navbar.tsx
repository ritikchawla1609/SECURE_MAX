'use client';

import * as React from 'react';
import { Menu, LogOut, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Navbar() {
  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-800 bg-[#0F172A]/90 px-6 backdrop-blur-md">
      <div className="flex items-center lg:hidden">
        <Button variant="ghost" size="icon" className="mr-2 text-slate-400 hover:text-white hover:bg-slate-800">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle Sidebar</span>
        </Button>
      </div>
      
      <div className="flex flex-1 items-center justify-between lg:justify-end space-x-4">
        {/* Network Status Indicator */}
        <div className="hidden lg:flex items-center space-x-3 text-xs font-mono">
          <div className="flex items-center px-3 py-1 rounded-full bg-emerald-950/40 border border-emerald-500/30 text-emerald-400">
            <span className="relative flex h-2 w-2 mr-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Sepolia Connected
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="icon" className="relative text-slate-400 hover:text-white hover:bg-slate-800">
            <Bell className="h-4 w-4" />
            <span className="sr-only">Notifications</span>
          </Button>
          
          <div className="h-6 w-px bg-slate-800 mx-2"></div>
          
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-slate-400 hover:text-red-400 hover:bg-red-950/20 text-xs"
            onClick={async () => {
              await fetch('/api/auth/logout', { method: 'POST' });
              window.location.href = '/login';
            }}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Disconnect
          </Button>
        </div>
      </div>
    </header>
  );
}
