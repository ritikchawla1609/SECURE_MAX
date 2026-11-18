import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

import { deviceStore } from '../../src/lib/auth/deviceStore';
import { 
  approveAccessRequestAction, 
  rejectAccessRequestAction, 
  revokeLiveGrantAction, 
  fetchAllAccessRequestsAction,
  fetchLiveGrantsAction 
} from '../../src/app/actions/accessRequests';

describe('Access Requests and Live Grants Options Test Suite', () => {
  beforeEach(() => {
    deviceStore.seedTestDataForTesting(true);
  });

  it('1. Initial seeded requests contain Arjun Verma (req-1), Neha Iyer (req-2), and Vasu (req_001)', async () => {
    const res = await fetchAllAccessRequestsAction();
    expect(res.success).toBe(true);
    const pending = res.requests.filter(r => r.status === 'PENDING');
    
    expect(pending.some(r => r.id === 'req-1' && r.user_name === 'Arjun Verma')).toBe(true);
    expect(pending.some(r => r.id === 'req-2' && r.user_name === 'Neha Iyer')).toBe(true);
    expect(pending.some(r => r.id === 'req_001')).toBe(true);
  });

  it('2. Admin clicking Approve on req-1 updates status to APPROVED and mints live grant', async () => {
    const approveRes = await approveAccessRequestAction({ requestId: 'req-1', ttlMinutes: 45 });
    expect(approveRes.success).toBe(true);
    expect(approveRes.request?.status).toBe('APPROVED');
    expect(approveRes.grant).toBeDefined();
    expect(approveRes.grant?.assetCode).toBe('SMX-FIN-002');
    expect(approveRes.grant?.status).toBe('ACTIVE');

    // Confirm it is no longer pending
    const fetchRes = await fetchAllAccessRequestsAction();
    const req1 = fetchRes.requests.find(r => r.id === 'req-1');
    expect(req1?.status).toBe('APPROVED');
  });

  it('3. Admin clicking Deny on req-2 updates status to REJECTED', async () => {
    const rejectRes = await rejectAccessRequestAction({ requestId: 'req-2', reason: 'Security policy restriction' });
    expect(rejectRes.success).toBe(true);
    expect(rejectRes.request?.status).toBe('REJECTED');

    // Confirm it is no longer pending
    const fetchRes = await fetchAllAccessRequestsAction();
    const req2 = fetchRes.requests.find(r => r.id === 'req-2');
    expect(req2?.status).toBe('REJECTED');
  });

  it('4. Admin clicking Revoke on an active live grant revokes access', async () => {
    const grantsRes = await fetchLiveGrantsAction();
    const activeGrant = grantsRes.grants.find(g => g.status === 'ACTIVE');
    expect(activeGrant).toBeDefined();

    const revokeRes = await revokeLiveGrantAction({ grantId: activeGrant!.id });
    expect(revokeRes.success).toBe(true);
    expect(revokeRes.grant?.status).toBe('REVOKED');

    const grantsAfter = await fetchLiveGrantsAction();
    const grantAfter = grantsAfter.grants.find(g => g.id === activeGrant!.id);
    expect(grantAfter?.status).toBe('REVOKED');
  });
});
