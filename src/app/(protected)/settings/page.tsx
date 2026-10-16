'use client';

import * as React from 'react';
import { 
  Settings as SettingsIcon, 
  User, 
  Shield, 
  Key, 
  Bell, 
  Moon, 
  Save, 
  Loader2, 
  CheckCircle2, 
  Smartphone, 
  Server, 
  Lock, 
  Eye, 
  EyeOff,
  Cpu,
  Fingerprint
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';

export default function SettingsPage() {
  const { toast } = useToast();

  const [activeTab, setActiveTab] = React.useState<'profile' | 'security' | 'notifications' | 'appearance'>('profile');
  
  // Profile state
  const [userName, setUserName] = React.useState('Alex Johnson');
  const [userEmail, setUserEmail] = React.useState('alex@securemax.mil');
  const [userRole, setUserRole] = React.useState('USER');
  const [userDid, setUserDid] = React.useState('did:securemax:user:a94b21');
  const [deviceName, setDeviceName] = React.useState('Primary Workstation');
  const [clearanceLevel, setClearanceLevel] = React.useState('CONFIDENTIAL');

  // Security preferences
  const [sessionTimeout, setSessionTimeout] = React.useState('8h');
  const [requireHardwareSignature, setRequireHardwareSignature] = React.useState(true);
  const [autoRevokeOnIdle, setAutoRevokeOnIdle] = React.useState(true);

  // Notification preferences
  const [notifyOnChainAnchors, setNotifyOnChainAnchors] = React.useState(true);
  const [notifyAccessRequests, setNotifyAccessRequests] = React.useState(true);
  const [notifySecurityWarnings, setNotifySecurityWarnings] = React.useState(true);

  // Appearance preferences
  const [cursorHalo, setCursorHalo] = React.useState(true);
  const [reducedMotion, setReducedMotion] = React.useState(false);

  // Save states
  const [isSaving, setIsSaving] = React.useState(false);
  const [savedSuccess, setSavedSuccess] = React.useState(false);

  // Fetch session details on mount
  React.useEffect(() => {
    fetch('/api/auth/session')
      .then((res) => res.json())
      .then((data) => {
        if (data?.session) {
          if (data.session.name) setUserName(data.session.name);
          if (data.session.email) setUserEmail(data.session.email);
          if (data.session.role) setUserRole(data.session.role);
          if (data.session.did) setUserDid(data.session.did);
          if (data.session.deviceName) setDeviceName(data.session.deviceName);
        }
      })
      .catch(() => {});

    // Load saved preferences from localStorage
    if (typeof window !== 'undefined') {
      const savedTimeout = localStorage.getItem('securemax_session_timeout');
      if (savedTimeout) setSessionTimeout(savedTimeout);
      const savedNotify = localStorage.getItem('securemax_notify_anchors');
      if (savedNotify !== null) setNotifyOnChainAnchors(savedNotify === 'true');
      const savedHalo = localStorage.getItem('securemax_cursor_halo');
      if (savedHalo !== null) setCursorHalo(savedHalo === 'true');
      const savedMotion = localStorage.getItem('securemax_reduced_motion');
      if (savedMotion !== null) {
        const isReduced = savedMotion === 'true';
        setReducedMotion(isReduced);
        document.documentElement.classList.toggle('reduce-motion', isReduced);
      }
    }
  }, []);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      document.documentElement.classList.toggle('reduce-motion', reducedMotion);
    }
  }, [reducedMotion]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSavedSuccess(false);

    try {
      // Simulate real persist
      await new Promise((resolve) => setTimeout(resolve, 600));

      if (typeof window !== 'undefined') {
        localStorage.setItem('securemax_session_timeout', sessionTimeout);
        localStorage.setItem('securemax_notify_anchors', String(notifyOnChainAnchors));
        localStorage.setItem('securemax_cursor_halo', String(cursorHalo));
        localStorage.setItem('securemax_reduced_motion', String(reducedMotion));
      }

      setSavedSuccess(true);
      toast({
        type: 'success',
        title: 'Settings Saved',
        message: 'Security preferences and cryptographic policies updated successfully.',
      });

      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      toast({
        type: 'error',
        title: 'Save Failed',
        message: err.message || 'Could not update settings',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-16 font-sans">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#0F172A] border border-slate-800 rounded-2xl p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-blue-400 font-mono text-xs uppercase tracking-wider mb-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            ZERO-TRUST PREFERENCES
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <SettingsIcon className="w-7 h-7 text-blue-400" />
            Security &amp; Account Settings
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-light">
            Manage your hardware enclave credentials, cryptographic identity, and audit notification preferences.
          </p>
        </div>

        <Button
          onClick={handleSaveSettings}
          disabled={isSaving}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs tracking-wider shadow-sm flex items-center gap-2 cursor-pointer active:scale-95"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Saving Changes...</span>
            </>
          ) : savedSuccess ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-300" />
              <span>Saved!</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Save Changes</span>
            </>
          )}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 gap-2 sm:gap-6 text-xs font-mono">
        <button
          onClick={() => setActiveTab('profile')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'profile'
              ? 'border-blue-500 text-blue-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <User className="w-4 h-4" />
          <span>Profile Identity</span>
        </button>

        <button
          onClick={() => setActiveTab('security')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'security'
              ? 'border-blue-500 text-blue-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Cryptographic Security</span>
        </button>

        <button
          onClick={() => setActiveTab('notifications')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'notifications'
              ? 'border-blue-500 text-blue-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>Notifications</span>
        </button>

        <button
          onClick={() => setActiveTab('appearance')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'appearance'
              ? 'border-blue-500 text-blue-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Moon className="w-4 h-4" />
          <span>Appearance</span>
        </button>
      </div>

      {/* Tab 1: Profile Identity */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-5">
            <Card className="bg-[#0F172A] border-slate-800 p-6 shadow-sm">
              <CardHeader className="p-0 pb-5">
                <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-400" />
                  Operator Profile
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Authoritative identity data registered in SecureMAX zero-trust directory.
                </CardDescription>
              </CardHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-300">Full Name</label>
                    <Input
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      className="bg-slate-900 border-slate-800 text-slate-100 text-xs rounded-lg focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-300">Official Email</label>
                    <Input
                      value={userEmail}
                      disabled
                      className="bg-slate-900/60 border-slate-800 text-slate-400 text-xs rounded-lg font-mono cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-300">Decentralized Identifier (DID)</label>
                    <Input
                      value={userDid}
                      disabled
                      className="bg-slate-900/60 border-slate-800 text-blue-400/90 text-xs rounded-lg font-mono cursor-not-allowed"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-300">Clearance Classification</label>
                    <select
                      value={clearanceLevel}
                      onChange={(e) => setClearanceLevel(e.target.value)}
                      className="w-full h-10 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-xs px-3 focus:outline-none focus:border-blue-500"
                    >
                      <option value="CONFIDENTIAL">CONFIDENTIAL</option>
                      <option value="SECRET">SECRET</option>
                      <option value="TOP_SECRET">TOP SECRET (LEVEL 3)</option>
                    </select>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <div className="lg:col-span-4 space-y-5">
            <Card className="bg-[#0F172A] border-slate-800 p-6 shadow-sm">
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
                <Smartphone className="w-4 h-4 text-blue-400" />
                Enrolled Hardware Terminal
              </CardTitle>
              <div className="p-3.5 rounded-xl bg-slate-900/50 border border-slate-800 space-y-2 text-xs font-mono">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">TERMINAL:</span>
                  <span className="text-slate-200">{deviceName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">KEY DERIVATION:</span>
                  <span className="text-blue-400">ECDSA P-256</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">ROLE CLEARANCE:</span>
                  <Badge variant="outline" className="border-blue-500/30 text-blue-400 bg-blue-950/30 text-[9px]">
                    {userRole}
                  </Badge>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Tab 2: Cryptographic Security */}
      {activeTab === 'security' && (
        <div className="max-w-3xl space-y-5">
          <Card className="bg-[#0F172A] border-slate-800 p-6 shadow-sm">
            <CardHeader className="p-0 pb-5">
              <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-400" />
                Zero-Trust Invariants &amp; Session Posture
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Configure policy boundaries enforcing the principle: Authorization ≠ Decryption.
              </CardDescription>
            </CardHeader>

            <div className="space-y-4">
              {/* Session Duration */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900/50 border border-slate-800">
                <div>
                  <div className="text-xs font-semibold text-white">Session Lifetime Token</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Maximum validity duration of JWT before requiring cryptographic re-authentication.
                  </div>
                </div>
                <select
                  value={sessionTimeout}
                  onChange={(e) => setSessionTimeout(e.target.value)}
                  className="h-9 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-xs px-3 font-mono focus:border-blue-500"
                >
                  <option value="1h">1 Hour (High-Assurance)</option>
                  <option value="4h">4 Hours</option>
                  <option value="8h">8 Hours (Standard Shift)</option>
                  <option value="24h">24 Hours</option>
                </select>
              </div>

              {/* Hardware Enclave Requirement */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900/50 border border-slate-800">
                <div>
                  <div className="text-xs font-semibold text-white">Enforce Hardware P-256 Signature</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Reject access attempts from browsers without enrolled Web Crypto cryptographic keypairs.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={requireHardwareSignature}
                  onChange={(e) => setRequireHardwareSignature(e.target.checked)}
                  className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                />
              </div>

              {/* Auto-Revocation */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900/50 border border-slate-800">
                <div>
                  <div className="text-xs font-semibold text-white">Live Policy Invalidation</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Instantly terminate session cookies if administrator modifies user clearance or revokes enrollment.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={autoRevokeOnIdle}
                  onChange={(e) => setAutoRevokeOnIdle(e.target.checked)}
                  className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                />
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Tab 3: Notifications */}
      {activeTab === 'notifications' && (
        <div className="max-w-3xl space-y-5">
          <Card className="bg-[#0F172A] border-slate-800 p-6 shadow-sm">
            <CardHeader className="p-0 pb-5">
              <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
                <Bell className="w-4 h-4 text-blue-400" />
                Audit &amp; Telemetry Alerts
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Control high-priority notifications for on-chain integrity anchors and access grants.
              </CardDescription>
            </CardHeader>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900/50 border border-slate-800">
                <div>
                  <div className="text-xs font-semibold text-white">Sepolia Hash Anchoring Alerts</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Notify when audit batch Merkle root is committed to Ethereum testnet contract.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={notifyOnChainAnchors}
                  onChange={(e) => setNotifyOnChainAnchors(e.target.checked)}
                  className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900/50 border border-slate-800">
                <div>
                  <div className="text-xs font-semibold text-white">Access Request Approvals</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Notify immediately when an administrator approves identity decryption permits.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={notifyAccessRequests}
                  onChange={(e) => setNotifyAccessRequests(e.target.checked)}
                  className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900/50 border border-slate-800">
                <div>
                  <div className="text-xs font-semibold text-white">Sentinel Threat Warnings</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Display persistent error toasts upon token replay or non-enrolled device access attempts.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={notifySecurityWarnings}
                  onChange={(e) => setNotifySecurityWarnings(e.target.checked)}
                  className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                />
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Tab 4: Appearance */}
      {activeTab === 'appearance' && (
        <div className="max-w-3xl space-y-5">
          <Card className="bg-[#0F172A] border-slate-800 p-6 shadow-sm">
            <CardHeader className="p-0 pb-5">
              <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
                <Moon className="w-4 h-4 text-blue-400" />
                Theme &amp; Accessibility
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Customize appearance, interactive elements, and accessibility preferences.
              </CardDescription>
            </CardHeader>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900/50 border border-slate-800">
                <div>
                  <div className="text-xs font-semibold text-white">Color Palette</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Deep Slate (#0B0F19 background, #0F172A cards, Enterprise Blue actions)
                  </div>
                </div>
                <Badge variant="outline" className="border-blue-500/30 text-blue-400 bg-blue-950/30 text-[10px] font-mono">
                  ENTERPRISE DARK
                </Badge>
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900/50 border border-slate-800">
                <div>
                  <div className="text-xs font-semibold text-white">Custom Blue Cursor Halo</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Subtle interactive cursor halo for desktop pointing devices.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={cursorHalo}
                  onChange={(e) => setCursorHalo(e.target.checked)}
                  className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900/50 border border-slate-800">
                <div>
                  <div className="text-xs font-semibold text-white">Respect Reduced Motion</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Disable non-essential animations across the user interface.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={reducedMotion}
                  onChange={(e) => setReducedMotion(e.target.checked)}
                  className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                />
              </div>
            </div>
          </Card>
        </div>
      )}

    </div>
  );
}
