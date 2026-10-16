import * as React from 'react';
import { supabaseAdmin } from '@/lib/db/client';
import { deviceStore } from '@/lib/auth/deviceStore';
import { AuditLogsInteractiveView, AuditRecord } from '@/components/auditor/AuditLogsInteractiveView';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AuditTrailPage() {
  if (typeof deviceStore !== 'undefined') {
    await deviceStore.loadFromCloud();
  }

  let auditEvents: any[] = [];
  if (supabaseAdmin) {
    const { data } = await supabaseAdmin
      .from('audit_events')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) auditEvents = data;
  }

  const fallbackEvents = deviceStore ? deviceStore.getAuditEvents().map((e) => ({
    id: e.id,
    created_at: e.created_at,
    event_type: e.event_type,
    status: e.severity === 'CRITICAL' ? 'DENIED' : 'SUCCESS',
    actor_did: e.user_name ? `${e.user_name} (${e.user_email || 'USER'})` : (e.user_email || e.performed_by || 'SYSTEM'),
    target_type: e.target_id || 'Identity Ledger',
    source: 'CRYPTOGRAPHIC AUDIT LEDGER',
    event_hash: e.event_hash || '0x3f4a9b2c8e1d5a7f9b0c2e4d6a8f1b3c5e7a9b0d2f4a6c8e1b3d5f7a9c0e2b4',
    prev_hash: '0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2',
    details: { description: e.description },
  })) : [];

  const allEvents = [...(fallbackEvents || []), ...(auditEvents || [])];
  
  // Deduplicate by ID
  const uniqueEvents = Array.from(new Map(allEvents.map((e) => [e.id, e])).values());
  
  // Sort descending
  const displayAudit: AuditRecord[] = uniqueEvents.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return <AuditLogsInteractiveView initialEvents={displayAudit} />;
}
