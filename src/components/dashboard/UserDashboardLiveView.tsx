'use client';

import * as React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Key, Clock, FileText, CheckCircle2, Smartphone, HardDrive, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useRealtimeSync } from '@/lib/hooks/useRealtimeSync';

interface UserDashboardProps {
  initialSession: {
    userId: string;
    name?: string;
    email?: string;
    role?: string;
    deviceName?: string;
  };
  initialAssignedAssets: any[];
  initialEnrolledDevices: any[];
}

export function UserDashboardLiveView({
  initialSession,
  initialAssignedAssets,
  initialEnrolledDevices,
}: UserDashboardProps) {
  const [assignedAssets, setAssignedAssets] = React.useState<any[]>(initialAssignedAssets);
  const [enrolledDevices, setEnrolledDevices] = React.useState<any[]>(initialEnrolledDevices);
  const [syncing, setSyncing] = React.useState(false);

  const refreshData = React.useCallback(async (isBackground = true) => {
    try {
      if (!isBackground) setSyncing(true);
      const [assetsRes, devicesRes] = await Promise.all([
        fetch('/api/assets/list?scope=MY_DATA'),
        fetch('/api/devices'),
      ]);

      if (assetsRes.ok) {
        const assetsData = await assetsRes.json();
        if (assetsData.success && Array.isArray(assetsData.assets)) {
          setAssignedAssets(
            assetsData.assets.map((a: any) => ({
              asset: {
                id: a.id,
                name: a.name,
                classification: a.classification,
                asset_code: a.code || a.asset_code,
              },
              can_decrypt: a.canDecrypt,
              can_read: a.canRead,
            }))
          );
        }
      }

      if (devicesRes.ok) {
        const devicesData = await devicesRes.json();
        if (devicesData.success && Array.isArray(devicesData.devices)) {
          setEnrolledDevices(
            devicesData.devices.map((d: any) => ({
              id: d.id || d.deviceId,
              device_name: d.deviceName || d.device_name,
              algorithm: d.algorithm || 'ECDSA_P256',
              status: d.status || 'ACTIVE',
            }))
          );
        }
      }
    } catch (err) {
      console.error('[UserDashboardLiveView] Refresh error:', err);
    } finally {
      if (!isBackground) setSyncing(false);
    }
  }, []);

  // Real-time synchronization (<100ms SSE + 2.5s fallback polling)
  useRealtimeSync(() => refreshData(true), 2500);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-100 uppercase flex items-center gap-3">
            <Shield className="w-7 h-7 text-cyan-400" />
            User Security Vault
          </h2>
          <p className="text-xs text-zinc-500 font-mono tracking-widest mt-1 uppercase">
            Hardware Enclave &amp; P-256 Authenticated Session
          </p>
        </div>
        <div className="flex items-center gap-3 mt-4 sm:mt-0">
          <Badge variant="outline" className="border-cyan-500/50 text-cyan-400 px-4 py-1.5 font-mono text-xs">
            ROLE: {initialSession.role}
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left 2 Cols: Authorized Data */}
        <div className="md:col-span-2 space-y-6">
          <Card className="border-zinc-800 bg-[#0a0a0c]">
            <CardHeader className="border-b border-zinc-800 pb-4">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base text-zinc-100">
                    <HardDrive className="w-5 h-5 text-cyan-400" /> Authorized Assets &amp; Clearance
                  </CardTitle>
                  <CardDescription className="text-xs text-zinc-400 font-mono mt-1">
                    Encrypted files you have cryptographic authorization to read or decrypt.
                  </CardDescription>
                </div>
                <Link href="/assets">
                  <Button variant="outline" size="sm" className="border-zinc-800 text-xs font-mono">
                    Open Vault
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {assignedAssets.length > 0 ? (
                <div className="space-y-3">
                  {assignedAssets.map((item) => (
                    <div
                      key={item.asset.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-md bg-zinc-900/40 border border-zinc-800 hover:border-cyan-500/40 transition-colors gap-3"
                    >
                      <div className="space-y-1">
                        <h4 className="font-bold text-sm text-zinc-100">{item.asset.name}</h4>
                        <div className="flex items-center gap-2 text-xs font-mono">
                          <Badge variant="outline" className="text-[10px] text-zinc-400 border-zinc-800">
                            {item.asset.classification}
                          </Badge>
                          <span className="text-zinc-500">CODE: {item.asset.asset_code}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <Badge
                          className={`text-[10px] font-mono border ${
                            item.can_decrypt
                              ? 'border-cyan-500/40 text-cyan-400 bg-cyan-950/20'
                              : 'border-zinc-700 text-zinc-400 bg-zinc-900'
                          }`}
                        >
                          {item.can_decrypt ? 'READ + DECRYPT' : 'READ ONLY'}
                        </Badge>
                        <Link href="/assets">
                          <Button
                            size="sm"
                            className="bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 border border-cyan-500/30 text-xs font-mono"
                          >
                            <Key className="w-3.5 h-3.5 mr-1.5" /> Access
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center text-zinc-500">
                  <FileText className="h-10 w-10 text-zinc-600 mb-3" />
                  <p className="text-xs font-mono">No assets assigned yet.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right 1 Col: Active Devices & Session */}
        <div className="space-y-6">
          {/* Active Device Context */}
          <Card className="border-zinc-800 bg-[#0a0a0c]">
            <CardHeader className="pb-3 border-b border-zinc-800">
              <div className="flex justify-between items-center">
                <CardTitle className="text-sm text-zinc-200 flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-cyan-400" />
                  Enrolled Devices
                </CardTitle>
                <Link href="/devices" className="text-[11px] font-mono text-cyan-400 hover:underline">
                  Manage ({enrolledDevices.length})
                </Link>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-3 font-mono text-xs">
              {enrolledDevices.map((d) => (
                <div
                  key={d.id}
                  className="p-2.5 rounded bg-zinc-900/60 border border-zinc-800 flex justify-between items-center"
                >
                  <div>
                    <div className="font-bold text-zinc-200 text-xs">{d.device_name}</div>
                    <div className="text-[10px] text-zinc-500">{d.algorithm}</div>
                  </div>
                  <Badge variant="outline" className="text-[9px] border-emerald-500/30 text-emerald-400">
                    {d.status}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Active Session Status */}
          <Card className="border-zinc-800 bg-gradient-to-b from-[#0a0a0c] to-zinc-950">
            <CardHeader className="pb-3 border-b border-zinc-800">
              <CardTitle className="text-sm text-zinc-200">Session Integrity</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-2.5 font-mono text-xs">
              <div className="p-3 rounded border border-emerald-500/20 bg-emerald-500/5 space-y-1.5">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>P-256 Cryptographic Session</span>
                </div>
                <div className="text-[10px] text-zinc-400">
                  Hardware Bound: {initialSession.deviceName || 'Local Terminal'}
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-cyan-400 pt-1">
                  <Clock className="w-3 h-3" />
                  <span>TTL: 8 hours (Standard)</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
