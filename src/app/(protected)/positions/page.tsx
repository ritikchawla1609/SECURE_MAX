'use client';

import * as React from 'react';
import { 
  Shield, 
  ShieldAlert, 
  ShieldCheck, 
  Plus, 
  Check, 
  AlertTriangle, 
  X, 
  Users, 
  Key, 
  Database, 
  FileText, 
  Activity, 
  Loader2,
  Lock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StoredPosition, PositionPermissions } from '@/types';

export default function PositionsPage() {
  const [positions, setPositions] = React.useState<StoredPosition[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showModal, setShowModal] = React.useState(false);
  const [submitLoading, setSubmitLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  // Form State
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [privilegeLevel, setPrivilegeLevel] = React.useState<'STANDARD' | 'ELEVATED' | 'ADMINISTRATIVE'>('STANDARD');
  const [adminConfirmed, setAdminConfirmed] = React.useState(false);

  const [permissions, setPermissions] = React.useState<PositionPermissions>({
    identity: { register: false, suspend: false, revoke: false },
    users: { create: false, suspend: false },
    assets: { view: true, allocate: false, transfer: false, delete: false },
    access: { approve: false, revoke: false },
    audit: { view: false, export: false },
    security: { view_alerts: false, manage_devices: false },
  });

  const fetchPositions = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/positions');
      const data = await res.json();
      if (data.success && data.positions) {
        setPositions(data.positions);
      }
    } catch (err) {
      console.error('Failed to load positions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchPositions();
  }, [fetchPositions]);

  const handlePermissionToggle = (category: keyof PositionPermissions, perm: string) => {
    setPermissions(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [perm]: !(prev[category] as any)[perm],
      },
    }));
  };

  const isHighPrivilege = privilegeLevel === 'ADMINISTRATIVE' || privilegeLevel === 'ELEVATED' ||
    permissions.identity.revoke || permissions.users.create || permissions.access.approve || permissions.security.manage_devices;

  const handleCreatePosition = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (isHighPrivilege && !adminConfirmed) {
      setErrorMessage('Please acknowledge the High Privilege Confirmation before creating this position.');
      return;
    }

    setSubmitLoading(true);
    try {
      const res = await fetch('/api/positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          privilege_level: privilegeLevel,
          permissions,
          adminConfirmed,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create position');

      setSuccessMessage(`Position "${data.position.name}" successfully established.`);
      setShowModal(false);
      resetForm();
      await fetchPositions();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error creating position');
    } finally {
      setSubmitLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setPrivilegeLevel('STANDARD');
    setAdminConfirmed(false);
    setPermissions({
      identity: { register: false, suspend: false, revoke: false },
      users: { create: false, suspend: false },
      assets: { view: true, allocate: false, transfer: false, delete: false },
      access: { approve: false, revoke: false },
      audit: { view: false, export: false },
      security: { view_alerts: false, manage_devices: false },
    });
  };

  return (
    <div className="space-y-8 font-sans selection:bg-cyan-500/30 pb-20">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-100 flex items-center gap-3">
            <Shield className="h-7 w-7 text-cyan-400" />
            Organizational Positions &amp; Role Permissions
          </h1>
          <p className="text-xs text-zinc-400 font-mono tracking-wider mt-1">
            Permissions attached to Positions, not manually to individual users • Role-Based Access Control
          </p>
        </div>

        <Button
          onClick={() => { setShowModal(true); setErrorMessage(null); }}
          className="bg-gradient-to-r from-cyan-400 to-blue-600 hover:from-cyan-300 hover:to-blue-500 text-white font-bold text-xs shadow-[0_0_20px_rgba(6,182,212,0.3)] flex items-center gap-2"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          + Create Position
        </Button>
      </div>

      {/* Security Rule Card */}
      <div className="bg-[#0a0a0c] border border-cyan-500/30 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <ShieldCheck className="w-6 h-6 text-cyan-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-zinc-200 uppercase tracking-wide">
              Position-Based Access Principle
            </h4>
            <p className="text-xs text-zinc-400 leading-relaxed font-light">
              In SecureMAX, <strong>Position ≠ Device ≠ Identity</strong>. A user can possess an organizational position (e.g. Manager) and access data through multiple cryptographically registered devices (Laptop, Phone) with independent hardware credentials.
            </p>
          </div>
        </div>
      </div>

      {successMessage && (
        <div className="p-4 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-emerald-400 text-xs font-mono flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* POSITIONS LIST */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-mono tracking-widest text-zinc-400 uppercase">
            Active Organizational Positions ({positions.length})
          </h3>
          <span className="text-[11px] font-mono text-zinc-500">
            Standard • Elevated • Administrative
          </span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-zinc-500 text-xs font-mono">
            Loading position hierarchy...
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {positions.map(pos => {
              const isAdmin = pos.privilege_level === 'ADMINISTRATIVE';
              const isElevated = pos.privilege_level === 'ELEVATED';

              return (
                <Card 
                  key={pos.id} 
                  className={`bg-[#0a0f18] border transition-all rounded-2xl ${
                    isAdmin 
                      ? 'border-rose-500/40 shadow-[0_0_20px_rgba(244,63,94,0.1)]' 
                      : isElevated 
                      ? 'border-amber-500/30' 
                      : 'border-zinc-800 hover:border-cyan-500/30'
                  }`}
                >
                  <CardHeader className="pb-3 pt-5 px-5">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-base font-bold text-zinc-100 flex items-center gap-2">
                          {pos.name}
                          {pos.is_predefined && (
                            <Badge variant="outline" className="text-[9px] font-mono border-zinc-700 text-zinc-400">
                              PREDEFINED
                            </Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="text-xs text-zinc-400 mt-1 font-light">
                          {pos.description}
                        </CardDescription>
                      </div>

                      <Badge 
                        variant="outline"
                        className={`text-[10px] font-mono tracking-wider ${
                          isAdmin 
                            ? 'border-rose-500/40 text-rose-400 bg-rose-950/30' 
                            : isElevated 
                            ? 'border-amber-500/40 text-amber-400 bg-amber-950/30' 
                            : 'border-cyan-500/40 text-cyan-400 bg-cyan-950/30'
                        }`}
                      >
                        {pos.privilege_level}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="px-5 pb-5 pt-2 space-y-3 font-mono text-xs">
                    <div className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wider pb-1 border-b border-zinc-800/80">
                      Permission Matrix
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <span className={pos.permissions.identity?.register ? 'text-emerald-400' : 'text-zinc-600'}>
                          {pos.permissions.identity?.register ? '✓' : '✗'}
                        </span>
                        <span className="text-zinc-300">Register Identity</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className={pos.permissions.assets?.view ? 'text-emerald-400' : 'text-zinc-600'}>
                          {pos.permissions.assets?.view ? '✓' : '✗'}
                        </span>
                        <span className="text-zinc-300">View Assets</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className={pos.permissions.assets?.allocate ? 'text-emerald-400' : 'text-zinc-600'}>
                          {pos.permissions.assets?.allocate ? '✓' : '✗'}
                        </span>
                        <span className="text-zinc-300">Allocate Assets</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className={pos.permissions.access?.approve ? 'text-emerald-400' : 'text-zinc-600'}>
                          {pos.permissions.access?.approve ? '✓' : '✗'}
                        </span>
                        <span className="text-zinc-300">Approve Access</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className={pos.permissions.audit?.view ? 'text-emerald-400' : 'text-zinc-600'}>
                          {pos.permissions.audit?.view ? '✓' : '✗'}
                        </span>
                        <span className="text-zinc-300">View Audit</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className={pos.permissions.security?.manage_devices ? 'text-emerald-400' : 'text-zinc-600'}>
                          {pos.permissions.security?.manage_devices ? '✓' : '✗'}
                        </span>
                        <span className="text-zinc-300">Manage Devices</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* CREATE POSITION MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-[#0a0f18] border border-cyan-500/40 rounded-3xl p-7 relative shadow-[0_0_60px_rgba(6,182,212,0.25)] max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="absolute top-5 right-5 text-zinc-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-400">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white tracking-tight">
                  Create Organizational Position
                </h3>
                <p className="text-xs text-zinc-400 font-light">
                  Define roles with granular permissions attached to the position.
                </p>
              </div>
            </div>

            <form onSubmit={handleCreatePosition} className="space-y-5 mt-5">
              
              {/* Position Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300 block">
                  Position Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Security Manager, Compliance Officer, Asset Custodian"
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-cyan-400"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300 block">
                  Description
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Responsible for operational security, device trust, and audit"
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-cyan-400"
                />
              </div>

              {/* Privilege Level */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-300 block">
                  Privilege Level
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPrivilegeLevel('STANDARD')}
                    className={`py-2 px-3 rounded-xl text-xs font-mono border transition-all ${
                      privilegeLevel === 'STANDARD'
                        ? 'border-cyan-400 bg-cyan-950/40 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                        : 'border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    ○ Standard
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrivilegeLevel('ELEVATED')}
                    className={`py-2 px-3 rounded-xl text-xs font-mono border transition-all ${
                      privilegeLevel === 'ELEVATED'
                        ? 'border-amber-400 bg-amber-950/40 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                        : 'border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    ○ Elevated
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrivilegeLevel('ADMINISTRATIVE')}
                    className={`py-2 px-3 rounded-xl text-xs font-mono border transition-all ${
                      privilegeLevel === 'ADMINISTRATIVE'
                        ? 'border-rose-400 bg-rose-950/40 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.2)]'
                        : 'border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    ○ Administrative
                  </button>
                </div>
              </div>

              {/* Permissions Matrix */}
              <div className="space-y-3 pt-2">
                <label className="text-xs font-semibold text-zinc-200 block uppercase tracking-wider font-mono">
                  Granular Permissions Matrix
                </label>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-zinc-950 p-4 rounded-2xl border border-zinc-800">
                  
                  {/* Identity */}
                  <div className="space-y-2">
                    <div className="text-[11px] font-bold text-cyan-400 font-mono">Identity</div>
                    <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={permissions.identity.register}
                        onChange={() => handlePermissionToggle('identity', 'register')}
                        className="rounded border-zinc-700 text-cyan-500"
                      />
                      Register identity
                    </label>
                    <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={permissions.identity.suspend}
                        onChange={() => handlePermissionToggle('identity', 'suspend')}
                        className="rounded border-zinc-700 text-cyan-500"
                      />
                      Suspend identity
                    </label>
                    <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={permissions.identity.revoke}
                        onChange={() => handlePermissionToggle('identity', 'revoke')}
                        className="rounded border-zinc-700 text-cyan-500"
                      />
                      Revoke identity
                    </label>
                  </div>

                  {/* Users */}
                  <div className="space-y-2">
                    <div className="text-[11px] font-bold text-cyan-400 font-mono">Users</div>
                    <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={permissions.users.create}
                        onChange={() => handlePermissionToggle('users', 'create')}
                        className="rounded border-zinc-700 text-cyan-500"
                      />
                      Create users
                    </label>
                    <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={permissions.users.suspend}
                        onChange={() => handlePermissionToggle('users', 'suspend')}
                        className="rounded border-zinc-700 text-cyan-500"
                      />
                      Suspend users
                    </label>
                  </div>

                  {/* Assets */}
                  <div className="space-y-2">
                    <div className="text-[11px] font-bold text-cyan-400 font-mono">Assets</div>
                    <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={permissions.assets.view}
                        onChange={() => handlePermissionToggle('assets', 'view')}
                        className="rounded border-zinc-700 text-cyan-500"
                      />
                      View assets
                    </label>
                    <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={permissions.assets.allocate}
                        onChange={() => handlePermissionToggle('assets', 'allocate')}
                        className="rounded border-zinc-700 text-cyan-500"
                      />
                      Allocate assets
                    </label>
                    <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={permissions.assets.transfer}
                        onChange={() => handlePermissionToggle('assets', 'transfer')}
                        className="rounded border-zinc-700 text-cyan-500"
                      />
                      Transfer ownership
                    </label>
                    <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={permissions.assets.delete}
                        onChange={() => handlePermissionToggle('assets', 'delete')}
                        className="rounded border-zinc-700 text-cyan-500"
                      />
                      Delete assets
                    </label>
                  </div>

                  {/* Access & Audit */}
                  <div className="space-y-2">
                    <div className="text-[11px] font-bold text-cyan-400 font-mono">Access &amp; Audit</div>
                    <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={permissions.access.approve}
                        onChange={() => handlePermissionToggle('access', 'approve')}
                        className="rounded border-zinc-700 text-cyan-500"
                      />
                      Approve access
                    </label>
                    <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={permissions.access.revoke}
                        onChange={() => handlePermissionToggle('access', 'revoke')}
                        className="rounded border-zinc-700 text-cyan-500"
                      />
                      Revoke access
                    </label>
                    <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={permissions.audit.view}
                        onChange={() => handlePermissionToggle('audit', 'view')}
                        className="rounded border-zinc-700 text-cyan-500"
                      />
                      View audit
                    </label>
                    <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={permissions.audit.export}
                        onChange={() => handlePermissionToggle('audit', 'export')}
                        className="rounded border-zinc-700 text-cyan-500"
                      />
                      Export audit
                    </label>
                  </div>

                  {/* Security */}
                  <div className="space-y-2 md:col-span-2">
                    <div className="text-[11px] font-bold text-cyan-400 font-mono">Security</div>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={permissions.security.view_alerts}
                          onChange={() => handlePermissionToggle('security', 'view_alerts')}
                          className="rounded border-zinc-700 text-cyan-500"
                        />
                        View security alerts
                      </label>
                      <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={permissions.security.manage_devices}
                          onChange={() => handlePermissionToggle('security', 'manage_devices')}
                          className="rounded border-zinc-700 text-cyan-500"
                        />
                        Manage devices
                      </label>
                    </div>
                  </div>

                </div>
              </div>

              {/* HIGH PRIVILEGE WARNING & CONFIRMATION */}
              {isHighPrivilege && (
                <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-500/40 text-xs space-y-3 animate-in fade-in">
                  <div className="flex items-center gap-2 text-rose-400 font-bold font-mono">
                    <AlertTriangle className="w-4 h-4" />
                    <span>⚠ HIGH PRIVILEGE POSITION WARNING</span>
                  </div>
                  <p className="text-zinc-300 leading-relaxed font-light">
                    This position will be granted elevated capabilities within the organization, such as assigning organizational roles, approving access permits, or managing hardware devices.
                  </p>
                  <label className="flex items-start gap-2 text-rose-300 font-semibold cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={adminConfirmed}
                      onChange={(e) => setAdminConfirmed(e.target.checked)}
                      className="mt-0.5 rounded border-rose-500 text-rose-600"
                    />
                    <span>Require Admin Confirmation: I explicitly verify granting high-privilege access to this position.</span>
                  </label>
                </div>
              )}

              {errorMessage && (
                <div className="p-3 bg-red-950/40 border border-red-500/40 rounded-xl text-red-400 text-xs font-mono flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={submitLoading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-600 hover:from-cyan-300 hover:to-blue-500 text-white font-bold text-xs tracking-wider shadow-[0_0_20px_rgba(6,182,212,0.4)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {submitLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                CREATE POSITION
              </Button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
