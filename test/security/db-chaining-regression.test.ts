import { describe, it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { supabaseAdmin } from '../../src/lib/db/client';
import { executeSentinelScan } from '../../src/lib/sentinel/engine';

// Mock only access-flow to prevent external dependencies, but keep REAL supabaseAdmin!
vi.mock('../../src/lib/api/access-flow', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    authorizeAssetAccess: vi.fn().mockRejectedValue(new Error('Access Denied: Blockchain Identity/Access layer rejected authorization.')),
  };
});

describe('SupabaseAdmin Chaining Regression Suite', () => {
  it('supports .from().update().eq() chained calls without throwing', async () => {
    const query = supabaseAdmin.from('security_scans').update({
      status: 'COMPLETED',
      passed_count: 5,
      failed_count: 0,
      completed_at: new Date().toISOString()
    }).eq('id', 'scan-123');

    expect(typeof query.then).toBe('function');
    const result = await query;
    expect(result.error).toBeNull();
  });

  it('supports .from().update().in() and multiple conditions', async () => {
    const query = supabaseAdmin.from('roles').update({ name: 'ADMIN' }).eq('id', 'user-123').in('status', ['ACTIVE']);
    expect(typeof query.then).toBe('function');
    const result = await query;
    expect(result.error).toBeNull();
  });

  it('supports .from().delete().eq() chained calls', async () => {
    const res = await supabaseAdmin.from('security_incidents').delete().eq('id', 'inc-123');
    expect(res.error).toBeNull();
  });

  it('supports .from().select().eq().single() and maybeSingle()', async () => {
    const singleRes = await supabaseAdmin.from('users').select('*').eq('id', 'usr-123').single();
    expect(singleRes.error).toBeNull();

    const maybeRes = await supabaseAdmin.from('users').select('*').eq('id', 'usr-123').maybeSingle();
    expect(maybeRes.error).toBeNull();
  });

  it('executes full executeSentinelScan using real unmocked supabaseAdmin proxy', async () => {
    // This executes executeSentinelScan which calls supabaseAdmin.from('security_scans').update(...).eq(...)
    const scanId = await executeSentinelScan('regression-test-admin');
    expect(scanId).toBeDefined();
    expect(typeof scanId).toBe('string');
  });
});

