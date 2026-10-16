import { supabaseAdmin } from '@/lib/db/client';
import { AuditEvent, AuditEventType } from '@/types';
import crypto from 'crypto';

export interface AuditLogParams {
  eventType: AuditEventType | string;
  actorId?: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, any>;
}

/**
 * Foundational security logging module.
 * In later phases, this will implement the full hash-chaining logic.
 */
export async function logAuditEvent(params: AuditLogParams) {
  try {
    // 1. Record in local tamper-evident store
    try {
      const { deviceStore } = await import('@/lib/auth/deviceStore');
      await deviceStore.recordAuditEvent({
        eventType: String(params.eventType),
        description: `Audit Event: ${params.eventType} on ${params.targetType || 'SYSTEM'}:${params.targetId || 'N/A'}`,
        targetId: params.targetId,
        severity: String(params.eventType).includes('DENIED') ? 'WARNING' : 'INFO',
      });
    } catch {
      // Ignore
    }

    // 2. Fetch previous hash & compute hash
    let prevHash = '0x0000000000000000000000000000000000000000000000000000000000000000';
    try {
      const query: any = supabaseAdmin
        .from('audit_events')
        .select('event_hash')
        .order('id', { ascending: false })
        .limit(1);
      const res = typeof query.maybeSingle === 'function' 
        ? await query.maybeSingle() 
        : await query.single();
      if (res?.data?.event_hash) prevHash = res.data.event_hash;
    } catch {
      // Supabase offline
    }

    const hashData = JSON.stringify({
      eventType: params.eventType,
      actorId: params.actorId,
      targetType: params.targetType,
      targetId: params.targetId,
      details: params.details,
      prevHash,
    });
    const rawHash = crypto.createHash('sha256').update(hashData).digest('hex');
    const eventHash = rawHash.startsWith('0x') ? rawHash : `0x${rawHash}`;

    // 3. Attempt insert into database if available
    try {
      await supabaseAdmin.from('audit_events').insert({
        event_type: params.eventType,
        actor_id: params.actorId || null,
        target_type: params.targetType || null,
        target_id: params.targetId || null,
        event_hash: eventHash,
        prev_hash: prevHash,
      });
    } catch {
      // Offline mode
    }

    return eventHash;
  } catch (err) {
    console.error('Audit Error:', err);
    return '0x0000000000000000000000000000000000000000000000000000000000000000';
  }
}
