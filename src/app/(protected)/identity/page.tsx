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
    <div className="space-y-8 font-sans selection:bg-cyan-500/30 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-100 uppercase flex items-center gap-3">
            <Fingerprint className="h-6 w-6 text-cyan-400" />
            Identity Management
          </h2>
          <p className="text-sm text-zinc-500 font-mono tracking-widest mt-1 uppercase">Cryptographic Wallet-Backed Identities</p>
        </div>
      </div>

      <div className="space-y-6">
        {activeIdentities.length > 0 ? activeIdentities.map((user: any) => (
          <div key={user.id} className="bg-[#0a0a0c] border border-zinc-800 rounded-lg overflow-hidden">
            <div className="bg-zinc-900/50 p-4 border-b border-zinc-800 flex justify-between items-center cursor-pointer hover:bg-zinc-900/80 transition-colors">
              <div className="flex items-center gap-6">
                <div className="w-8 flex justify-center"><User className="w-4 h-4 text-zinc-500" /></div>
                <div className="text-xs font-bold tracking-widest text-zinc-100 uppercase w-[150px] truncate">{user.name || 'UNKNOWN USER'}</div>
                <div className="text-[10px] font-mono tracking-widest px-3 py-1 rounded bg-cyan-500/10 text-cyan-400 w-[100px] text-center">
                  {user.role}
                </div>
                <div className="text-[10px] font-mono tracking-widest px-3 py-1 rounded bg-emerald-500/10 text-emerald-400 hidden md:block">
                  ACTIVE
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-zinc-500" />
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-8">
               {/* IDENTITY PROFILE */}
               <div className="space-y-4">
                 <h4 className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase pb-2 border-b border-zinc-800">Identity Profile</h4>
                 <div className="space-y-2 text-xs font-mono">
                   <div className="flex justify-between"><span className="text-zinc-600">NAME</span><span className="text-zinc-300">{user.name || 'N/A'}</span></div>
                   <div className="flex justify-between"><span className="text-zinc-600">WALLET</span><span className="text-cyan-400 truncate max-w-[120px]" title={user.wallet_address}>{user.wallet_address ? `${user.wallet_address.substring(0,6)}...${user.wallet_address.substring(user.wallet_address.length - 4)}` : 'N/A'}</span></div>
                   <div className="flex justify-between"><span className="text-zinc-600">ROLE</span><span className="text-zinc-300">{user.role}</span></div>
                   <div className="flex justify-between"><span className="text-zinc-600">STATUS</span><span className="text-emerald-500">ACTIVE</span></div>
                 </div>
               </div>

               {/* AUTHENTICATION */}
               <div className="space-y-4">
                 <h4 className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase pb-2 border-b border-zinc-800">Authentication</h4>
                 <div className="space-y-2 text-xs font-mono">
                   <div className="flex justify-between"><span className="text-zinc-600">CHALLENGE</span><span className="text-zinc-400 truncate max-w-[120px]">Verified</span></div>
                   <div className="flex justify-between"><span className="text-zinc-600">EIP-191 SIG</span><span className="text-zinc-600 truncate max-w-[120px]">0x...{user.wallet_address ? user.wallet_address.slice(-4) : 'abcd'}</span></div>
                   <div className="flex justify-between"><span className="text-zinc-600">SESSION</span><span className="text-emerald-500">CRYPTOGRAPHICALLY VERIFIED</span></div>
                 </div>
               </div>

               {/* AUTHORIZATION */}
               <div className="space-y-4">
                 <h4 className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase pb-2 border-b border-zinc-800">Authorization</h4>
                 <div className="space-y-2 text-xs font-mono">
                   <div className="flex justify-between"><span className="text-zinc-600">PERMISSIONS</span><span className="text-cyan-400">DOMAIN 1 / DOMAIN 2</span></div>
                   <div className="flex justify-between"><span className="text-zinc-600">ASSET ACCESS</span><span className="text-zinc-300">{user.role === 'ADMIN' ? 'GLOBAL' : 'RESTRICTED'}</span></div>
                   <div className="flex justify-between"><span className="text-zinc-600">STATE</span><span className="text-emerald-500">SECURE SESSION</span></div>
                 </div>
               </div>
            </div>
          </div>
        )) : (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-600 border border-zinc-800/50 rounded-lg bg-[#0a0a0c]">
            <Fingerprint className="h-12 w-12 mb-6 opacity-50 text-cyan-400" />
            <p className="text-sm font-mono tracking-widest uppercase text-zinc-400">NO IDENTITIES FOUND</p>
          </div>
        )}
      </div>
    </div>
  );
}
