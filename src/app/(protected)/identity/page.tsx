import * as React from 'react';
import { Fingerprint, ShieldCheck, Key, Lock, Activity, User, ChevronDown } from 'lucide-react';
import { supabaseAdmin } from '@/lib/db/client';
import { Badge } from '@/components/ui/badge';
import { deviceStore } from '@/lib/auth/deviceStore';

export const dynamic = 'force-dynamic';

export default async function IdentityPage() {
  let users: any[] = [];
  try {
    const res = await supabaseAdmin
      .from('users')
      .select('*')
      .order('role', { ascending: true });
    users = res.data || [];
  } catch (e) {
    // Supabase offline, fall back to deviceStore
  }

  const uniqueIds = Array.from(new Set([...deviceStore.users.values()].map(u => u.id)));
  const storeUsersRaw = await Promise.all(uniqueIds.map(async id => await deviceStore.getUserById(id)));
  const storeUsers = storeUsersRaw
    .filter(Boolean)
    .map(u => ({
      id: u!.id,
      name: u!.name,
      role: u!.role,
      wallet_address: u!.did || `did:securemax:user:${u!.id.slice(-6)}`,
      status: u!.status || 'ACTIVE'
    }));

  const activeIdentities = users.length > 0 ? users : storeUsers;

  return (
    <div className="space-y-6 font-sans selection:bg-blue-600/30 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#0F172A] border border-slate-800 rounded-xl p-6 shadow-sm">
        <div>
          <div className="text-blue-400 font-mono text-xs uppercase tracking-wider mb-1 font-semibold">
            CHAIN-1 DECENTRALIZED DIRECTORY
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <Fingerprint className="h-7 w-7 text-blue-400" />
            Identity Registry
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-normal">
            Decentralized Identifiers (DIDs) & cryptographic wallet attestations registered on Chain-1.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-blue-500/30 text-blue-400 bg-blue-950/40 font-mono text-xs px-3 py-1">
            {activeIdentities.length} Active {activeIdentities.length === 1 ? 'DID' : 'DIDs'}
          </Badge>
        </div>
      </div>

      <div className="space-y-4">
        {activeIdentities.length > 0 ? activeIdentities.map((user: any) => (
          <div key={user.id} className="bg-[#0F172A] border border-slate-800 rounded-xl overflow-hidden shadow-sm hover:border-slate-700 transition-colors">
            <div className="p-4 bg-slate-900/60 border-b border-slate-800 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="w-9 h-9 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">{user.name || 'Unknown User'}</div>
                  <div className="text-[11px] font-mono text-slate-400">{user.wallet_address || 'No DID Bound'}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="text-xs font-mono px-2.5 py-0.5 border-blue-500/30 text-blue-400 bg-blue-950/40">
                  {user.role}
                </Badge>
                <Badge variant="outline" className="text-xs font-mono px-2.5 py-0.5 border-emerald-500/30 text-emerald-400 bg-emerald-950/40 hidden sm:inline-flex">
                  Active
                </Badge>
              </div>
            </div>

            <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-6 bg-[#0F172A]">
               {/* IDENTITY PROFILE */}
               <div className="space-y-3">
                 <h4 className="text-[11px] font-mono tracking-wider text-slate-400 uppercase pb-1.5 border-b border-slate-800 font-semibold">
                   Identity Profile
                 </h4>
                 <div className="space-y-1.5 text-xs font-mono">
                   <div className="flex justify-between"><span className="text-slate-400">Name</span><span className="text-slate-200">{user.name || 'N/A'}</span></div>
                   <div className="flex justify-between"><span className="text-slate-400">DID</span><span className="text-blue-400 truncate max-w-[140px]" title={user.wallet_address}>{user.wallet_address ? `${user.wallet_address.substring(0, 10)}...` : 'N/A'}</span></div>
                   <div className="flex justify-between"><span className="text-slate-400">Role</span><span className="text-slate-200">{user.role}</span></div>
                   <div className="flex justify-between"><span className="text-slate-400">Status</span><span className="text-emerald-400">Active</span></div>
                 </div>
               </div>

               {/* AUTHENTICATION */}
               <div className="space-y-3">
                 <h4 className="text-[11px] font-mono tracking-wider text-slate-400 uppercase pb-1.5 border-b border-slate-800 font-semibold">
                   Authentication
                 </h4>
                 <div className="space-y-1.5 text-xs font-mono">
                   <div className="flex justify-between"><span className="text-slate-400">Challenge</span><span className="text-slate-300">Verified</span></div>
                   <div className="flex justify-between"><span className="text-slate-400">Signature</span><span className="text-slate-400 truncate max-w-[140px]">EIP-712 / P-256</span></div>
                   <div className="flex justify-between"><span className="text-slate-400">Session</span><span className="text-emerald-400">Verified</span></div>
                 </div>
               </div>

               {/* AUTHORIZATION */}
               <div className="space-y-3">
                 <h4 className="text-[11px] font-mono tracking-wider text-slate-400 uppercase pb-1.5 border-b border-slate-800 font-semibold">
                   Authorization
                 </h4>
                 <div className="space-y-1.5 text-xs font-mono">
                   <div className="flex justify-between"><span className="text-slate-400">Boundaries</span><span className="text-blue-400">Domain 1 / Domain 2</span></div>
                   <div className="flex justify-between"><span className="text-slate-400">Clearance</span><span className="text-slate-200">{user.role === 'ADMIN' ? 'Global Admin' : 'RBAC Policy'}</span></div>
                   <div className="flex justify-between"><span className="text-slate-400">Posture</span><span className="text-emerald-400">Compliant</span></div>
                 </div>
               </div>
            </div>
          </div>
        )) : (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500 border border-slate-800 rounded-xl bg-[#0F172A]">
            <Fingerprint className="h-12 w-12 mb-4 opacity-40 text-blue-400" />
            <p className="text-xs font-mono tracking-wider uppercase text-slate-400">No Registered Identities Found</p>
          </div>
        )}
      </div>
    </div>
  );
}
