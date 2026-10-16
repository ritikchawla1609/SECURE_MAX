'use client';

import * as React from 'react';
import { 
  Smartphone, 
  Laptop, 
  Plus, 
  Trash2, 
  ShieldAlert, 
  ShieldCheck, 
  CheckCircle2, 
  Clock, 
  QrCode, 
  Copy, 
  AlertCircle,
  Key, 
  User, 
  X, 
  Loader2, 
  Sparkles,
  RefreshCw,
  Eye,
  AlertTriangle,
  History,
  Activity,
  Layers,
  Globe,
  Radio,
  Lock,
  PauseCircle,
  PlayCircle,
  UserPlus,
  ExternalLink,
  Link2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StoredPosition } from '@/types';
import { useRealtimeSync } from '@/lib/hooks/useRealtimeSync';

interface EnrolledDevicePassport {
  id: string;
  deviceId: string;
  deviceName: string;
  deviceType: string;
  os: string;
  browser: string;
  browserVersion: string;
  model: string;
  registrationRegion: string;
  credentialId: string;
  credentialType: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
  riskState: 'TRUSTED' | 'REVIEW' | 'RESTRICTED' | 'REVOKED';
  position: string;
  isAdminDevice: boolean;
  userId?: string;
  userEmail?: string;
  userName?: string;
  createdAt: string;
  registeredAt: string;
  lastUsedAt: string;
  lastAuthenticatedAt: string;
  revokedAt?: string | null;
  publicKeyFingerprint: string;
  timeline: Array<{
    id: string;
    timestamp: string;
    event: string;
    details?: string;
    severity?: 'INFO' | 'WARNING' | 'CRITICAL';
  }>;
}

interface PersonnelOption {
  id: string;
  name: string;
  email: string;
  role: string;
  position: string;
  status?: string;
}

interface ActiveSessionItem {
  sessionId: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  deviceId: string;
  deviceName?: string;
  position: string;
  createdAt: string;
  lastActivityAt: string;
  expiresAt: string;
  authenticationLevel: string;
  status: string;
}

interface CapabilityHistoryItem {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  positionName: string;
  durationMinutes: number;
  maxDevices: number;
  devicesEnrolled: number;
  createdAt: string;
  expiresAt: string;
  status: string;
  usedAt?: string | null;
}

export default function DevicesPage() {
  const [activeTab, setActiveTab] = React.useState<'REGISTRY' | 'ENROLLMENT' | 'SESSIONS' | 'EMERGENCY'>('REGISTRY');
  const [devices, setDevices] = React.useState<EnrolledDevicePassport[]>([]);
  const [positions, setPositions] = React.useState<StoredPosition[]>([]);
  const [personnel, setPersonnel] = React.useState<PersonnelOption[]>([]);
  const [sessions, setSessions] = React.useState<ActiveSessionItem[]>([]);
  const [enrollmentHistory, setEnrollmentHistory] = React.useState<CapabilityHistoryItem[]>([]);
  const [userRole, setUserRole] = React.useState<string>('USER');
  const [loading, setLoading] = React.useState(true);

  // Selected Device for Passport Modal View
  const [selectedPassport, setSelectedPassport] = React.useState<EnrolledDevicePassport | null>(null);

  // Enrollment Generator State
  const [enrollmentMode, setEnrollmentMode] = React.useState<'NEW_USER' | 'EXISTING_USER'>('NEW_USER');
  const [selectedPersonnelId, setSelectedPersonnelId] = React.useState<string>('');
  const [newUserName, setNewUserName] = React.useState<string>('');
  const [newUserEmail, setNewUserEmail] = React.useState<string>('');
  const [selectedPositionId, setSelectedPositionId] = React.useState<string>('');
  const [targetDeviceType, setTargetDeviceType] = React.useState<'any' | 'laptop' | 'phone' | 'tablet' | 'terminal'>('any');
  const [durationMinutes, setDurationMinutes] = React.useState<number>(15);
  const [maxDevices, setMaxDevices] = React.useState<number>(1);
  const [enrollmentLoading, setEnrollmentLoading] = React.useState(false);
  const [enrollmentError, setEnrollmentError] = React.useState<string | null>(null);

  // Active Generated Code Display
  const [generatedCode, setGeneratedCode] = React.useState<string | null>(null);
  const [generatedExpiresAt, setGeneratedExpiresAt] = React.useState<string | null>(null);
  const [generatedRecipient, setGeneratedRecipient] = React.useState<string | null>(null);
  const [generatedPosition, setGeneratedPosition] = React.useState<string | null>(null);
  const [generatedUrl, setGeneratedUrl] = React.useState<string | null>(null);
  const [showQrModal, setShowQrModal] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [copiedUrl, setCopiedUrl] = React.useState(false);
  const [countdown, setCountdown] = React.useState<string>('15:00');

  const fetchDevicesData = React.useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      const res = await fetch('/api/devices');
      const data = await res.json();
      if (data.success) {
        setDevices(data.devices || []);
        if (data.positions) setPositions(data.positions);
        if (data.personnel) {
          setPersonnel(data.personnel);
          const nonAdmins = data.personnel.filter((p: any) => p.role !== 'ADMIN');
          if (nonAdmins.length > 0 && !selectedPersonnelId) {
            setSelectedPersonnelId(nonAdmins[0].id);
          }
        }
        if (data.sessions) setSessions(data.sessions);
        if (data.enrollmentHistory) setEnrollmentHistory(data.enrollmentHistory);
        if (data.user) setUserRole(data.user.role);
      }
    } catch (err) {
      console.error('Failed to load devices data:', err);
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [selectedPersonnelId]);

  React.useEffect(() => {
    fetchDevicesData();
  }, [fetchDevicesData]);

  // Real-time SSE (<100ms) + 2.5s polling fallback
  useRealtimeSync(() => fetchDevicesData(true), 2500);

  // Countdown timer for active code
  React.useEffect(() => {
    if (!generatedExpiresAt) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, new Date(generatedExpiresAt).getTime() - Date.now());
      if (remaining <= 0) {
        setCountdown('EXPIRED');
        clearInterval(interval);
      } else {
        const mins = Math.floor(remaining / 60000);
        const secs = Math.floor((remaining % 60000) / 1000);
        setCountdown(`${mins}:${secs < 10 ? '0' : ''}${secs}`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [generatedExpiresAt]);

  // Admin generates 15-minute enrollment code
  const handleGenerateEnrollmentCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const isNewUser = enrollmentMode === 'NEW_USER';

    if (isNewUser) {
      if (!newUserName.trim() || !newUserEmail.trim()) {
        setEnrollmentError('Please provide both Full Name and Email Address for the new user.');
        return;
      }
    } else {
      if (!selectedPersonnelId || selectedPersonnelId === '__NEW_USER__') {
        setEnrollmentError('Please select a registered team member.');
        return;
      }
    }

    setEnrollmentLoading(true);
    setEnrollmentError(null);

    try {
      const res = await fetch('/api/devices/enrollment/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: selectedPersonnelId,
          isNewUser,
          newUserName: isNewUser ? newUserName.trim() : undefined,
          newUserEmail: isNewUser ? newUserEmail.trim() : undefined,
          positionId: selectedPositionId || undefined,
          durationMinutes,
          maxDevices,
          targetDeviceType: targetDeviceType === 'any' ? undefined : targetDeviceType,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate enrollment capability');

      setGeneratedCode(data.enrollment.code);
      setGeneratedExpiresAt(data.enrollment.expiresAt);
      setGeneratedRecipient(`${data.enrollment.targetUserName} (${data.enrollment.targetUserEmail})`);
      setGeneratedPosition(data.enrollment.positionName);
      setGeneratedUrl(data.enrollment.enrollmentUrl);
      if (isNewUser) {
        setNewUserName('');
        setNewUserEmail('');
      }
      await fetchDevicesData();
    } catch (err: any) {
      setEnrollmentError(err.message || 'Failed to generate enrollment code');
    } finally {
      setEnrollmentLoading(false);
    }
  };

  // Device Action Handler (suspend, revoke, update risk, force reauth)
  const handleDeviceAction = async (deviceId: string, action: string, extraPayload?: any) => {
    try {
      const res = await fetch('/api/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, action, ...extraPayload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to perform ${action}`);
      await fetchDevicesData();
      if (selectedPassport && (selectedPassport.id === deviceId || selectedPassport.deviceId === deviceId)) {
        const updated = await fetch('/api/devices').then(r => r.json());
        const found = updated.devices?.find((d: any) => d.id === deviceId || d.deviceId === deviceId);
        if (found) setSelectedPassport(found);
      }
    } catch (err: any) {
      alert(err.message || `Action failed`);
    }
  };

  // Session Revocation
  const handleRevokeSession = async (sessionId: string) => {
    try {
      const res = await fetch('/api/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revoke_session', sessionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to revoke session');
      await fetchDevicesData();
    } catch (err: any) {
      alert(err.message || 'Failed to revoke session');
    }
  };

  const handleCopyCode = () => {
    if (generatedCode) {
      navigator.clipboard.writeText(generatedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyUrl = () => {
    if (generatedUrl) {
      navigator.clipboard.writeText(generatedUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  const isAdmin = userRole === 'ADMIN';

  return (
    <div className="space-y-8 font-sans selection:bg-cyan-500/30 pb-20">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-100 flex items-center gap-3">
            <Smartphone className="h-7 w-7 text-cyan-400" />
            Device Trust Center &amp; Passport Registry
          </h1>
          <p className="text-xs text-zinc-400 font-mono tracking-wider mt-1">
            WebAuthn Passkeys • 15-Minute Admin Capabilities • Device Risk Telemetry
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex rounded-xl bg-zinc-950 p-1 border border-zinc-800 text-xs font-mono">
          <button
            onClick={() => setActiveTab('REGISTRY')}
            className={`py-1.5 px-3.5 rounded-lg transition-all ${
              activeTab === 'REGISTRY'
                ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            DEVICE REGISTRY ({devices.length})
          </button>
          <button
            onClick={() => setActiveTab('ENROLLMENT')}
            className={`py-1.5 px-3.5 rounded-lg transition-all ${
              activeTab === 'ENROLLMENT'
                ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            ENROLLMENT GENERATOR
          </button>
          <button
            onClick={() => setActiveTab('SESSIONS')}
            className={`py-1.5 px-3.5 rounded-lg transition-all ${
              activeTab === 'SESSIONS'
                ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            ACTIVE SESSIONS ({sessions.length})
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab('EMERGENCY')}
              className={`py-1.5 px-3.5 rounded-lg transition-all ${
                activeTab === 'EMERGENCY'
                  ? 'bg-rose-950 text-rose-300 border border-rose-500/40 shadow-[0_0_15px_rgba(244,63,94,0.2)]'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              EMERGENCY CONTROLS
            </button>
          )}
        </div>
      </div>

      {/* Admin Notice Banner */}
      {isAdmin && (
        <div className="bg-amber-950/20 border border-amber-500/30 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <ShieldAlert className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-amber-300 uppercase tracking-wide">
                Hardware-Bound Authority Active
              </h4>
              <p className="text-xs text-zinc-300 leading-relaxed font-light">
                Passwords are not used. You issue short-lived 15-minute enrollment capabilities, and the user&apos;s device converts that capability into a cryptographically registered Device Passport via WebAuthn.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => setActiveTab('ENROLLMENT')}
            className="shrink-0 bg-amber-500/15 border border-amber-500/40 text-amber-300 hover:bg-amber-500/25 text-xs font-mono"
          >
            + Generate Security Code
          </Button>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 1: DEVICE REGISTRY                                               */}
      {/* ==================================================================== */}
      {activeTab === 'REGISTRY' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-mono tracking-widest text-zinc-400 uppercase flex items-center gap-2">
              <Laptop className="w-4 h-4 text-cyan-400" />
              Authorized Device Passports ({devices.length})
            </h3>
            <span className="text-[11px] font-mono text-zinc-500">
              Risk States: 🟢 TRUSTED • 🟡 REVIEW • 🟠 RESTRICTED • 🔴 REVOKED
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-zinc-500 text-xs font-mono">
              Loading cryptographic device registry...
            </div>
          ) : devices.length === 0 ? (
            <div className="p-12 rounded-2xl border border-dashed border-zinc-800 bg-[#0a0f18]/60 text-center space-y-3">
              <Laptop className="w-10 h-10 text-zinc-600 mx-auto" />
              <div className="text-sm font-mono text-zinc-300 font-bold">No Authorized Hardware Enrolled</div>
              <p className="text-xs font-mono text-zinc-500 max-w-sm mx-auto">
                No devices enrolled yet. Use the Enrollment Generator tab to issue a 15-minute pairing code.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {devices.map((device) => {
                const isActive = device.status === 'ACTIVE';
                const isSuspended = device.status === 'SUSPENDED';
                const isRevoked = device.status === 'REVOKED';

                return (
                  <Card 
                    key={device.id} 
                    className={`bg-[#0a0f18] border transition-all rounded-2xl cursor-pointer hover:border-cyan-500/50 ${
                      isRevoked 
                        ? 'border-rose-950/60 opacity-60' 
                        : isSuspended 
                        ? 'border-amber-950/60' 
                        : 'border-zinc-800'
                    }`}
                    onClick={() => setSelectedPassport(device)}
                  >
                    <CardHeader className="pb-3 pt-5 px-5 flex flex-row items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl border ${
                          device.isAdminDevice 
                            ? 'bg-amber-950/30 border-amber-500/30 text-amber-400' 
                            : 'bg-cyan-950/30 border-cyan-500/30 text-cyan-400'
                        }`}>
                          {device.deviceType === 'phone' ? <Smartphone className="w-5 h-5" /> : <Laptop className="w-5 h-5" />}
                        </div>
                        <div>
                          <CardTitle className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                            {device.deviceName}
                          </CardTitle>
                          <div className="text-[11px] text-zinc-400 mt-0.5">
                            {device.userName || 'Field Member'} • <span className="text-cyan-400 font-mono font-semibold">{device.position}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <Badge 
                          variant="outline" 
                          className={`text-[9px] font-mono tracking-wider ${
                            isActive 
                              ? 'border-emerald-500/30 text-emerald-400 bg-emerald-950/30' 
                              : isSuspended 
                              ? 'border-amber-500/30 text-amber-400 bg-amber-950/30' 
                              : 'border-rose-500/30 text-rose-400 bg-rose-950/30'
                          }`}
                        >
                          ● {device.status}
                        </Badge>
                        <Badge 
                          variant="outline"
                          className={`text-[9px] font-mono ${
                            device.riskState === 'TRUSTED' ? 'border-emerald-500/30 text-emerald-400' :
                            device.riskState === 'REVIEW' ? 'border-amber-500/30 text-amber-400' :
                            device.riskState === 'RESTRICTED' ? 'border-orange-500/30 text-orange-400' :
                            'border-rose-500/30 text-rose-400'
                          }`}
                        >
                          {device.riskState}
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="px-5 pb-5 pt-2 space-y-2.5 font-mono text-xs">
                      <div className="flex justify-between items-center text-zinc-400 text-[11px] pb-2 border-b border-zinc-800/60">
                        <span>PLATFORM</span>
                        <span className="text-zinc-200">{device.os} • {device.browser}</span>
                      </div>

                      <div className="flex justify-between items-center text-zinc-400 text-[11px] pb-2 border-b border-zinc-800/60">
                        <span>REGION</span>
                        <span className="text-zinc-300">{device.registrationRegion}</span>
                      </div>

                      <div className="flex justify-between items-center text-zinc-400 text-[11px] pb-2 border-b border-zinc-800/60">
                        <span>CREDENTIAL</span>
                        <span className="text-cyan-400">{device.credentialType}</span>
                      </div>

                      <div className="pt-2 flex items-center justify-between text-[11px] text-cyan-400">
                        <span className="flex items-center gap-1 hover:underline">
                          <Eye className="w-3.5 h-3.5" /> View Device Passport →
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: ENROLLMENT GENERATOR                                          */}
      {/* ==================================================================== */}
      {activeTab === 'ENROLLMENT' && (
        <div className="grid gap-6 lg:grid-cols-12">
          
          {/* GENERATOR CARD (col 5) */}
          <div className="lg:col-span-5 space-y-6">
            <Card className="bg-[#0a0f18] border border-cyan-500/30 rounded-2xl shadow-[0_0_30px_rgba(6,182,212,0.1)]">
              <CardHeader className="pb-4">
                <CardTitle className="text-base text-white flex items-center gap-2">
                  <Key className="w-5 h-5 text-cyan-400" />
                  Security Code Generator
                </CardTitle>
                <CardDescription className="text-xs text-zinc-400">
                  Issue a 15-minute temporary enrollment capability for a new device.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Segmented Mode Switch: Onboard New User vs Existing Team Member */}
                <div className="flex rounded-xl bg-zinc-950 p-1 border border-zinc-800 mb-4 font-mono">
                  <button
                    type="button"
                    onClick={() => { setEnrollmentMode('NEW_USER'); setEnrollmentError(null); }}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                      enrollmentMode === 'NEW_USER'
                        ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-400/60 shadow-[0_0_15px_rgba(6,182,212,0.25)]'
                        : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
                    }`}
                  >
                    👤 Onboard New User
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEnrollmentMode('EXISTING_USER'); setEnrollmentError(null); }}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                      enrollmentMode === 'EXISTING_USER'
                        ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-400/60 shadow-[0_0_15px_rgba(6,182,212,0.25)]'
                        : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
                    }`}
                  >
                    💻 Existing User Device
                  </button>
                </div>

                <form onSubmit={handleGenerateEnrollmentCode} className="space-y-4 font-mono text-xs">
                  
                  {enrollmentMode === 'NEW_USER' ? (
                    /* Onboard New User Inputs */
                    <div className="space-y-3 p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-500/30 animate-in fade-in">
                      <div className="text-[11px] font-mono text-cyan-300 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                        <UserPlus className="w-3.5 h-3.5 text-cyan-400" />
                        New Identity Credentials
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-zinc-400 block font-mono uppercase">Full Name *</label>
                        <input
                          type="text"
                          value={newUserName}
                          onChange={(e) => setNewUserName(e.target.value)}
                          placeholder="e.g. Vikram Singh"
                          required
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-cyan-400"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-zinc-400 block font-mono uppercase">Official Email Address *</label>
                        <input
                          type="email"
                          value={newUserEmail}
                          onChange={(e) => setNewUserEmail(e.target.value)}
                          placeholder="e.g. vikram@securemax.mil"
                          required
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-cyan-400"
                        />
                      </div>
                    </div>
                  ) : (
                    /* Select Existing Non-Admin User */
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-zinc-300 block font-semibold">
                        Select Registered Team Member
                      </label>
                      {personnel.filter(p => p.role !== 'ADMIN').length === 0 ? (
                        <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-[11px] text-amber-400">
                          No non-admin personnel enrolled yet. Switch to &quot;Onboard New User&quot; above to add your first team member.
                        </div>
                      ) : (
                        <select
                          value={selectedPersonnelId}
                          onChange={(e) => setSelectedPersonnelId(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-cyan-400"
                        >
                          <option value="">-- Choose Team Member --</option>
                          {personnel.filter(p => p.role !== 'ADMIN').map(p => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.email}) — {p.position || p.role}
                            </option>
                          ))}
                        </select>
                      )}
                      <p className="text-[10px] text-zinc-500">
                        ℹ Administrator accounts are strictly single-device hardware-bound.
                      </p>
                    </div>
                  )}

                  {/* Select Position */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-zinc-300 block font-semibold">
                      Assign Organizational Position / Role
                    </label>
                    <select
                      value={selectedPositionId}
                      onChange={(e) => setSelectedPositionId(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-cyan-400"
                    >
                      <option value="">Default (From User Record)</option>
                      {positions.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} [{p.privilege_level}]
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Duration */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-zinc-300 block font-semibold">
                      Code Validity Duration
                    </label>
                    <select
                      value={durationMinutes}
                      onChange={(e) => setDurationMinutes(Number(e.target.value))}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-cyan-400"
                    >
                      <option value={15}>15 minutes (Standard Zero-Trust)</option>
                      <option value={30}>30 minutes</option>
                      <option value={60}>1 hour</option>
                    </select>
                  </div>

                  {/* Enrollment Scope & Device Binding */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-zinc-300 block font-semibold">
                      Enrollment Scope &amp; Device Binding
                    </label>
                    <select
                      value={targetDeviceType}
                      onChange={(e) => setTargetDeviceType(e.target.value as any)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-cyan-400"
                    >
                      <option value="any">Any Compatible Device (Unrestricted)</option>
                      <option value="laptop">Laptop / Workstation</option>
                      <option value="phone">Phone / Mobile Device</option>
                      <option value="tablet">Tablet / iPad</option>
                      <option value="terminal">Terminal / Hardware Station</option>
                    </select>
                  </div>

                  {enrollmentError && (
                    <div className="p-3 bg-red-950/40 border border-red-500/40 rounded-xl text-red-400 text-xs font-mono flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{enrollmentError}</span>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={enrollmentLoading || (enrollmentMode === 'EXISTING_USER' && personnel.filter(p => p.role !== 'ADMIN').length === 0)}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-600 hover:from-cyan-300 hover:to-blue-500 text-white font-bold text-xs tracking-wider shadow-[0_0_20px_rgba(6,182,212,0.3)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {enrollmentLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                    {enrollmentMode === 'NEW_USER' ? 'GENERATE NEW USER ONBOARDING CODE' : 'GENERATE DEVICE PAIRING CODE'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* ACTIVE GENERATED CODE CARD & HISTORY (col 7) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Generated Code Display Card */}
            {generatedCode ? (
              <Card className="border-cyan-500/40 bg-[#0a0f18] rounded-2xl shadow-[0_0_30px_rgba(6,182,212,0.15)] animate-in fade-in">
                <CardHeader className="pb-3 border-b border-cyan-500/20 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base text-cyan-400 flex items-center gap-2">
                      <Key className="w-5 h-5" />
                      Enrollment Capability Ready
                    </CardTitle>
                    <CardDescription className="text-xs text-zinc-300 mt-0.5">
                      Recipient: <span className="text-white font-bold">{generatedRecipient}</span> • Position: <span className="text-cyan-300 font-bold">{generatedPosition}</span>
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="border-cyan-500/30 text-cyan-400 font-mono text-[10px]">
                    ONE-TIME USE
                  </Badge>
                </CardHeader>
                <CardContent className="pt-6 pb-6 space-y-5">
                  <div className="text-center space-y-2">
                    <div className="text-4xl font-mono font-bold tracking-widest text-cyan-300 bg-black/80 py-4 px-6 rounded-2xl border border-cyan-500/40 select-all shadow-[0_0_25px_rgba(6,182,212,0.25)] inline-block">
                      {generatedCode}
                    </div>
                    <div className="flex items-center justify-center gap-2 text-xs font-mono text-amber-400 pt-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Expires in: {countdown}</span>
                    </div>
                  </div>

                  {generatedUrl && (
                    <div className="p-3 bg-cyan-950/20 border border-cyan-500/20 rounded-xl text-center space-y-1">
                      <div className="text-[10px] text-zinc-400 font-mono">One-Time Registration Link:</div>
                      <div className="text-xs text-cyan-300 font-mono break-all select-all font-semibold">
                        {generatedUrl}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-center gap-2.5">
                    <Button 
                      variant="outline" 
                      onClick={handleCopyCode}
                      className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 text-xs font-mono flex items-center gap-1.5"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {copied ? 'Copied Code!' : 'Copy Code'}
                    </Button>

                    <Button 
                      variant="outline" 
                      onClick={handleCopyUrl}
                      className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 text-xs font-mono flex items-center gap-1.5"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      {copiedUrl ? 'Copied Link!' : 'Copy Link'}
                    </Button>

                    <Button 
                      variant="outline" 
                      onClick={() => window.open(generatedUrl || `/register-device?code=${generatedCode}`, '_blank')}
                      className="border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/15 text-xs font-mono flex items-center gap-1.5"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Open Portal
                    </Button>

                    <Button 
                      variant="outline" 
                      onClick={() => setShowQrModal(true)}
                      className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 text-xs font-mono flex items-center gap-1.5"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      Show QR
                    </Button>

                    <Button 
                      variant="ghost" 
                      onClick={() => setGeneratedCode(null)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-950/20 text-xs font-mono"
                    >
                      Revoke
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="p-8 rounded-2xl border border-dashed border-zinc-800 bg-[#0a0f18]/40 text-center space-y-2 font-mono">
                <Key className="w-8 h-8 text-zinc-600 mx-auto" />
                <div className="text-xs text-zinc-300 font-bold">No Active Generated Capability</div>
                <p className="text-[11px] text-zinc-500 max-w-sm mx-auto font-light">
                  Select a recipient and position on the left to issue a cryptographically strong 15-minute pairing code.
                </p>
              </div>
            )}

            {/* Issued Capabilities History Table */}
            <Card className="bg-[#0a0f18] border border-zinc-800 rounded-2xl">
              <CardHeader className="pb-3 border-b border-zinc-800/80">
                <CardTitle className="text-xs font-mono tracking-widest text-zinc-400 uppercase flex items-center gap-2">
                  <History className="w-4 h-4 text-cyan-400" />
                  Enrollment Capability History (Audit-Safe)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {enrollmentHistory.length === 0 ? (
                  <div className="p-6 text-center text-xs font-mono text-zinc-500">
                    No capabilities issued in this session.
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-800/60 font-mono text-xs max-h-[300px] overflow-y-auto">
                    {enrollmentHistory.map((item) => (
                      <div key={item.id} className="p-3.5 flex items-center justify-between hover:bg-zinc-950/50">
                        <div className="space-y-0.5">
                          <div className="text-zinc-200 font-semibold">{item.userName || item.userId}</div>
                          <div className="text-[10px] text-zinc-500">
                            Position: <span className="text-cyan-400">{item.positionName}</span> • Issued: {new Date(item.createdAt).toLocaleTimeString()}
                          </div>
                        </div>

                        <Badge 
                          variant="outline"
                          className={`text-[9px] ${
                            item.status === 'CONSUMED' ? 'border-emerald-500/40 text-emerald-400 bg-emerald-950/20' :
                            item.status === 'ACTIVE' ? 'border-cyan-500/40 text-cyan-400 bg-cyan-950/20' :
                            'border-zinc-700 text-zinc-500'
                          }`}
                        >
                          {item.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

          </div>

        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 3: ACTIVE SESSIONS                                               */}
      {/* ==================================================================== */}
      {activeTab === 'SESSIONS' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-mono tracking-widest text-zinc-400 uppercase flex items-center gap-2">
              <Radio className="w-4 h-4 text-cyan-400" />
              Active Hardware Sessions ({sessions.length})
            </h3>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleDeviceAction('all', 'revoke_all_sessions')}
              className="border-rose-500/30 text-rose-400 hover:bg-rose-950/20 text-xs font-mono"
            >
              Revoke All Active Sessions
            </Button>
          </div>

          {sessions.length === 0 ? (
            <div className="p-12 text-center text-xs font-mono text-zinc-500 border border-dashed border-zinc-800 rounded-2xl">
              No active sessions currently recorded.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {sessions.map((s) => (
                <Card key={s.sessionId} className="bg-[#0a0f18] border border-zinc-800 rounded-xl p-4 font-mono text-xs space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-sm font-bold text-zinc-100">{s.userName || 'Authorized User'}</div>
                      <div className="text-[11px] text-zinc-400">{s.deviceName} • <span className="text-cyan-400">{s.position}</span></div>
                    </div>
                    <Badge variant="outline" className="text-[9px] border-emerald-500/30 text-emerald-400 bg-emerald-950/20">
                      ● {s.status}
                    </Badge>
                  </div>

                  <div className="text-[11px] text-zinc-500 space-y-1 pt-1 border-t border-zinc-800">
                    <div className="flex justify-between">
                      <span>SESSION ID</span>
                      <span className="text-zinc-300">{s.sessionId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>AUTHENTICATION LEVEL</span>
                      <span className="text-cyan-400">{s.authenticationLevel}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>LOGIN TIME</span>
                      <span className="text-zinc-300">{new Date(s.createdAt).toLocaleTimeString()}</span>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRevokeSession(s.sessionId)}
                    className="w-full text-rose-400 hover:text-rose-300 hover:bg-rose-950/20 text-xs border border-rose-500/20 rounded-xl mt-1"
                  >
                    Revoke Session
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* DEVICE PASSPORT MODAL (CLICKED FROM REGISTRY)                        */}
      {/* ==================================================================== */}
      {selectedPassport && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-[#0a0f18] border border-cyan-500/40 rounded-3xl p-7 relative shadow-[0_0_60px_rgba(6,182,212,0.3)] max-h-[90vh] overflow-y-auto space-y-6">
            <button
              onClick={() => setSelectedPassport(null)}
              className="absolute top-5 right-5 text-zinc-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Passport Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-400">
                  <Laptop className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-[10px] font-mono tracking-widest text-cyan-400 uppercase">
                    DEVICE PASSPORT
                  </div>
                  <h2 className="text-xl font-bold text-white tracking-tight">
                    {selectedPassport.deviceName}
                  </h2>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 font-mono text-[10px]">
                  ● {selectedPassport.status}
                </Badge>
                <Badge variant="outline" className="border-cyan-500/40 text-cyan-400 font-mono text-[10px]">
                  {selectedPassport.riskState}
                </Badge>
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 font-mono text-xs bg-zinc-950 p-4 rounded-2xl border border-zinc-800">
              <div>
                <span className="text-zinc-500 block text-[10px] uppercase">User</span>
                <span className="text-zinc-200 font-bold">{selectedPassport.userName || 'N/A'}</span>
              </div>
              <div>
                <span className="text-zinc-500 block text-[10px] uppercase">Position</span>
                <span className="text-cyan-400 font-bold">{selectedPassport.position}</span>
              </div>
              <div>
                <span className="text-zinc-500 block text-[10px] uppercase">Model</span>
                <span className="text-zinc-300">{selectedPassport.model}</span>
              </div>

              <div>
                <span className="text-zinc-500 block text-[10px] uppercase">OS &amp; Browser</span>
                <span className="text-zinc-300">{selectedPassport.os} • {selectedPassport.browser}</span>
              </div>
              <div>
                <span className="text-zinc-500 block text-[10px] uppercase">Registration Region</span>
                <span className="text-zinc-300">{selectedPassport.registrationRegion}</span>
              </div>
              <div>
                <span className="text-zinc-500 block text-[10px] uppercase">Credential Type</span>
                <span className="text-cyan-400">{selectedPassport.credentialType}</span>
              </div>

              <div>
                <span className="text-zinc-500 block text-[10px] uppercase">Registered At</span>
                <span className="text-zinc-400">{new Date(selectedPassport.registeredAt).toLocaleDateString()}</span>
              </div>
              <div>
                <span className="text-zinc-500 block text-[10px] uppercase">Last Active</span>
                <span className="text-zinc-400">{new Date(selectedPassport.lastUsedAt).toLocaleTimeString()}</span>
              </div>
              <div>
                <span className="text-zinc-500 block text-[10px] uppercase">Fingerprint</span>
                <span className="text-zinc-400 text-[10px] truncate block">{selectedPassport.publicKeyFingerprint}</span>
              </div>
            </div>

            {/* DEVICE TRUST TIMELINE */}
            <div className="space-y-3">
              <h3 className="text-xs font-mono tracking-widest text-zinc-400 uppercase flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                Device Trust Timeline
              </h3>
              <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 space-y-3 font-mono text-xs max-h-[180px] overflow-y-auto">
                {selectedPassport.timeline?.map((item, idx) => (
                  <div key={item.id || idx} className="flex items-start gap-3 relative pb-2 border-b border-zinc-900 last:border-0 last:pb-0">
                    <span className="h-2 w-2 rounded-full bg-cyan-400 mt-1 shrink-0 shadow-[0_0_8px_#06b6d4]"></span>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-200 font-bold">{item.event}</span>
                        <span className="text-[10px] text-zinc-500">{new Date(item.timestamp).toLocaleTimeString()}</span>
                      </div>
                      {item.details && <div className="text-[11px] text-zinc-400 font-light">{item.details}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* CONTROLS */}
            <div className="pt-2 border-t border-zinc-800 flex flex-wrap gap-2 justify-end font-mono">
              {selectedPassport.status === 'ACTIVE' ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDeviceAction(selectedPassport.id, 'suspend')}
                  className="border-amber-500/30 text-amber-400 hover:bg-amber-950/20 text-xs"
                >
                  <PauseCircle className="w-3.5 h-3.5 mr-1" />
                  Suspend Device
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDeviceAction(selectedPassport.id, 'reactivate')}
                  className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-950/20 text-xs"
                >
                  <PlayCircle className="w-3.5 h-3.5 mr-1" />
                  Reactivate Device
                </Button>
              )}

              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (confirm(`Initiate recovery for lost device "${selectedPassport.deviceName}"? This will permanently revoke the device and generate a new 15-minute pairing code for ${selectedPassport.userName}.`)) {
                    handleDeviceAction(selectedPassport.id, 'recover_device', { lostDeviceId: selectedPassport.id });
                    setSelectedPassport(null);
                    setActiveTab('ENROLLMENT');
                  }
                }}
                className="border-amber-500/40 text-amber-400 hover:bg-amber-950/30 text-xs"
              >
                <ShieldAlert className="w-3.5 h-3.5 mr-1" />
                Recover Lost Device
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDeviceAction(selectedPassport.id, 'force_reauth')}
                className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 text-xs"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1" />
                Force Re-auth
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDeviceAction(selectedPassport.id, 'revoke')}
                className="border-rose-500/30 text-rose-400 hover:bg-rose-950/20 text-xs"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Revoke Device
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 4: EMERGENCY CONTROLS & PERSONNEL RECOVERY                      */}
      {/* ==================================================================== */}
      {activeTab === 'EMERGENCY' && (
        <div className="space-y-6">
          <div className="bg-rose-950/20 border border-rose-500/40 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <ShieldAlert className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-rose-300 uppercase tracking-wide">
                  Emergency Security &amp; Identity Controls
                </h4>
                <p className="text-xs text-zinc-300 leading-relaxed font-light">
                  Executing user suspension terminates all active sessions, blocks all enrolled device access, and prevents all cryptographic asset operations.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleDeviceAction('all', 'revoke_all_sessions')}
              className="border-rose-500/40 text-rose-400 hover:bg-rose-950/40 text-xs font-mono shrink-0"
            >
              Revoke All System Sessions
            </Button>
          </div>

          {/* Personnel Table with Suspension Controls */}
          <Card className="bg-[#0a0f18] border border-zinc-800 rounded-2xl">
            <CardHeader className="pb-3 border-b border-zinc-800/80">
              <CardTitle className="text-xs font-mono tracking-widest text-zinc-400 uppercase flex items-center gap-2">
                <User className="w-4 h-4 text-cyan-400" />
                Organizational Personnel &amp; Access Status ({personnel.length})
              </CardTitle>
              <CardDescription className="text-xs text-zinc-500 font-mono">
                Administrator can suspend compromised users, restore active status, or initiate device recovery.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-zinc-800/60 font-mono text-xs">
                {personnel.map((p) => {
                  const isSuspended = p.status === 'SUSPENDED';
                  const isAdminUser = p.role === 'ADMIN';

                  return (
                    <div key={p.id} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-zinc-950/40">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-100 font-bold">{p.name}</span>
                          <Badge
                            variant="outline"
                            className={`text-[9px] ${
                              p.status === 'ACTIVE' ? 'border-emerald-500/40 text-emerald-400 bg-emerald-950/20' :
                              p.status === 'SUSPENDED' ? 'border-rose-500/40 text-rose-400 bg-rose-950/30' :
                              'border-zinc-700 text-zinc-400'
                            }`}
                          >
                            ● {p.status || 'ACTIVE'}
                          </Badge>
                          <Badge variant="outline" className="text-[9px] border-cyan-500/30 text-cyan-400">
                            {p.position}
                          </Badge>
                        </div>
                        <div className="text-[11px] text-zinc-500">
                          ID: {p.id} • Email: {p.email} • Role: {p.role}
                        </div>
                      </div>

                      {!isAdminUser && (
                        <div className="flex items-center gap-2">
                          {isSuspended ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeviceAction('', 'reactivate_user', { targetUserId: p.id })}
                              className="border-emerald-500/40 text-emerald-400 hover:bg-emerald-950/30 text-xs font-mono"
                            >
                              <PlayCircle className="w-3.5 h-3.5 mr-1" />
                              Reactivate User
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeviceAction('', 'suspend_user', { targetUserId: p.id })}
                              className="border-rose-500/40 text-rose-400 hover:bg-rose-950/30 text-xs font-mono"
                            >
                              <PauseCircle className="w-3.5 h-3.5 mr-1" />
                              Disable User
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeviceAction(p.id, 'revoke_all_sessions', { targetUserId: p.id })}
                            className="border-zinc-700 text-zinc-400 hover:text-white text-xs font-mono"
                          >
                            Revoke Sessions
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* QR MODAL */}
      {showQrModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#0a0f18] border border-cyan-500/40 rounded-3xl p-6 text-center space-y-4 shadow-[0_0_50px_rgba(6,182,212,0.3)]">
            <div className="flex justify-between items-center">
              <span className="text-xs font-mono text-cyan-400 uppercase font-bold">QR Enrollment Code</span>
              <button onClick={() => setShowQrModal(false)} className="text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* High-Tech QR Code Graphic */}
            <div className="bg-white p-4 rounded-2xl inline-block shadow-[0_0_25px_rgba(6,182,212,0.4)]">
              <div className="w-44 h-44 border-4 border-black flex flex-col justify-between p-2 relative">
                <div className="flex justify-between">
                  <div className="w-10 h-10 border-4 border-black bg-black"></div>
                  <div className="w-10 h-10 border-4 border-black bg-black"></div>
                </div>
                <div className="text-center font-mono font-black text-black text-[10px] tracking-widest">
                  SECUREMAX
                  <div className="text-[8px] font-normal">{generatedCode}</div>
                </div>
                <div className="flex justify-between">
                  <div className="w-10 h-10 border-4 border-black bg-black"></div>
                  <div className="w-8 h-8 border-2 border-black flex items-center justify-center">
                    <div className="w-4 h-4 bg-black"></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-xs font-mono text-zinc-400 space-y-1">
              <div>Scan with mobile device camera to open:</div>
              <div className="text-[10px] text-cyan-400 break-all">{generatedUrl}</div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
