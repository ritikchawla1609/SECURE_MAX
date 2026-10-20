'use client';

import * as React from 'react';
import { Menu, LogOut, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Navbar() {
  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-[#0a0a0c] px-6 backdrop-blur-xl">
      <div className="flex items-center lg:hidden">
        <Button variant="ghost" size="icon" className="mr-2">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle Sidebar</span>
        </Button>
      </div>
      
      <div className="flex flex-1 items-center justify-between lg:justify-end space-x-4">
        {/* Status Indicators */}
        <div className="hidden lg:flex items-center space-x-4 text-xs font-medium">
          <div className="flex items-center text-emerald-400">
            <span className="relative flex h-2 w-2 mr-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Sepolia Connected
          </div>
          <div className="flex items-center text-emerald-400">
            <span className="relative flex h-2 w-2 mr-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Sepolia Connected
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="icon" className="relative text-muted-foreground">
            <Bell className="h-5 w-5" />
            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-destructive"></span>
            <span className="sr-only">Notifications</span>
          </Button>
          
          <div className="h-6 w-px bg-border mx-2"></div>
          
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-muted-foreground hover:text-destructive"
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
