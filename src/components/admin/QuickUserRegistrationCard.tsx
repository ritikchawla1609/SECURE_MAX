'use client';

import React, { useState, useEffect } from 'react';
import { UserPlus, CheckCircle2, Shield, User, Loader2, Sparkles, Key, AlertTriangle } from 'lucide-react';
import { registerNewUserByAdmin, getRegisteredPersonnel } from '@/app/actions/adminUsers';
import { useRealtimeSync } from '@/lib/hooks/useRealtimeSync';

interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
  did: string;
  status: string;
}

export function QuickUserRegistrationCard() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'USER' | 'MANAGER' | 'AUDITOR'>('USER');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successInfo, setSuccessInfo] = useState<{
    name: string;
    email: string;
    role: string;
    did: string;
    code?: string;
  } | null>(null);

  const [members, setMembers] = useState<Member[]>([]);

  const fetchPersonnel = async () => {
    try {
      const list = await getRegisteredPersonnel();
      if (list) setMembers(list);
    } catch (err) {
      console.error('Failed to load registered personnel:', err);
    }
  };

  // Load existing team members on mount
  useEffect(() => {
    fetchPersonnel();
  }, []);

  // Real-time SSE (<100ms) + 2.5s polling fallback
  useRealtimeSync(fetchPersonnel, 2500);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('Please provide the full name for the new team member.');
      return;
    }
    if (!email.trim()) {
      setErrorMessage('Please provide an email address for the new team member.');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    setSuccessInfo(null);

    const res = await registerNewUserByAdmin({
      name: name.trim(),
      email: email.trim(),
      role,
    });

    setLoading(false);

    if (res.success && res.user) {
      setSuccessInfo({
        name: res.user.name,
        email: res.user.email,
        role: res.user.role,
        did: res.user.did,
        code: res.user.enrollmentCode,
      });

      // Append to local list
      setMembers(prev => [
        {
          id: res.user!.id,
          name: res.user!.name,
          email: res.user!.email,
          role: res.user!.role,
          did: res.user!.did,
          status: 'Active',
        },
        ...prev,
      ]);

      setName('');
      setEmail('');
    } else {
      setErrorMessage(res.error || 'Failed to register team member.');
    }
  };

  return (
    <div className="bg-[#0a0f18] border border-cyan-500/30 rounded-2xl p-6 shadow-[0_0_30px_rgba(6,182,212,0.1)]">
      
      {/* Header with simple language */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-zinc-800 gap-2 mb-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-cyan-400" />
            Add New Team Member
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Create an account, assign their access level, and issue a secure digital identity.
          </p>
        </div>
      </div>

      {/* Registration Form */}
      <form onSubmit={handleRegister} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
        
        {/* Full Name */}
        <div className="md:col-span-4 space-y-1.5">
          <label className="text-xs font-semibold text-zinc-300 block">
            Full Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Major Vikram Singh"
            required
            className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-cyan-400 transition-colors"
          />
        </div>

        {/* Email */}
        <div className="md:col-span-4 space-y-1.5">
          <label className="text-xs font-semibold text-zinc-300 block">
            Email Address
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. vikram@securemax.mil"
            required
            className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-cyan-400 transition-colors"
          />
        </div>

        {/* Role Select */}
        <div className="md:col-span-2 space-y-1.5">
          <label className="text-xs font-semibold text-zinc-300 block">
            Access Role
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as 'USER' | 'MANAGER' | 'AUDITOR')}
            className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-cyan-400 transition-colors"
          >
            <option value="USER">Field Member (User)</option>
            <option value="MANAGER">Manager</option>
            <option value="AUDITOR">Auditor</option>
          </select>
        </div>

        {/* Submit Button */}
        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-600 hover:from-cyan-300 hover:to-blue-500 text-white font-bold text-xs tracking-wide shadow-[0_0_20px_rgba(6,182,212,0.4)] flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all select-none touch-manipulation active:opacity-90"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <UserPlus className="w-4 h-4" />
            )}
            <span>Add Member</span>
          </button>
        </div>

      </form>

      {/* Success Notification Banner */}
      {successInfo && (
        <div className="mt-4 p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-bold text-white">
                {successInfo.name} successfully registered!
              </div>
              <div className="text-xs text-zinc-300 mt-0.5">
                Email: <span className="text-emerald-300">{successInfo.email}</span> • Role: <span className="text-emerald-300">{successInfo.role}</span>
              </div>
              <div className="text-[11px] font-mono text-zinc-400 mt-1">
                Digital Identity: <span className="text-cyan-300">{successInfo.did}</span>
              </div>
            </div>
          </div>

          {successInfo.code && (
            <div className="bg-black/60 border border-emerald-500/30 rounded-lg px-3 py-1.5 text-center shrink-0">
              <span className="text-[9px] font-mono text-zinc-400 block uppercase">One-Time Device Code</span>
              <span className="text-xs font-mono font-bold text-emerald-400 tracking-wider">{successInfo.code}</span>
            </div>
          )}
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div className="mt-4 p-3 rounded-xl bg-red-950/40 border border-red-500/40 flex items-center gap-2 text-red-400 text-xs font-mono animate-in fade-in">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Team Members List */}
      <div className="mt-6 pt-5 border-t border-zinc-800">
        <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider mb-3">
          Current Team Members ({members.length})
        </h3>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[550px]">
            <thead>
              <tr className="border-b border-zinc-800/80 text-zinc-500 text-[10px] uppercase font-mono tracking-wider">
                <th className="pb-2">Name &amp; Email</th>
                <th className="pb-2">Access Role</th>
                <th className="pb-2">Digital ID</th>
                <th className="pb-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/40 font-light">
              {members.map((member) => (
                <tr key={member.id} className="hover:bg-zinc-900/40 transition-colors">
                  <td className="py-2.5 pr-3">
                    <div className="font-semibold text-zinc-200 max-w-[200px] truncate">{member.name}</div>
                    <div className="text-[11px] text-zinc-500 font-mono max-w-[200px] truncate">{member.email}</div>
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono whitespace-nowrap ${
                      member.role === 'ADMIN' 
                        ? 'bg-purple-950/60 text-purple-300 border border-purple-500/30' 
                        : member.role === 'AUDITOR'
                        ? 'bg-amber-950/60 text-amber-300 border border-amber-500/30'
                        : member.role === 'MANAGER'
                        ? 'bg-blue-950/60 text-blue-300 border border-blue-500/30'
                        : 'bg-cyan-950/60 text-cyan-300 border border-cyan-500/30'
                    }`}>
                      {member.role === 'ADMIN' ? 'Administrator' : member.role === 'AUDITOR' ? 'Auditor' : member.role === 'MANAGER' ? 'Manager' : 'Team Member'}
                    </span>
                  </td>
                  <td className="py-2.5 text-zinc-400 font-mono text-[11px] max-w-[180px] truncate pr-3" title={member.did}>
                    {member.did}
                  </td>
                  <td className="py-2.5 text-right whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5 text-emerald-400 text-[11px]">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                      Active
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
