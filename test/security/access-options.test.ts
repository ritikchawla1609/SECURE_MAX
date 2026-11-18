import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

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

  it('5. Dual-dispatch sync API route handles APPROVE, REJECT, REVOKE, and EXTEND directly', async () => {
    const { POST } = await import('../../src/app/api/sync/state/route');

    // Test POST APPROVE
    const approveReq = new Request('http://localhost:3000/api/sync/state', {
      method: 'POST',
      body: JSON.stringify({ action: 'APPROVE', requestId: 'req_001', ttlMinutes: 60 }),
    });
    const approveRes = await POST(approveReq);
    expect(approveRes.status).toBe(200);
    const approveJson = await approveRes.json();
    expect(approveJson.success).toBe(true);
    expect(approveJson.request?.status).toBe('APPROVED');
    expect(approveJson.grant?.status).toBe('ACTIVE');

    // Test POST EXTEND
    const grantId = approveJson.grant.id;
    const extendReq = new Request('http://localhost:3000/api/sync/state', {
      method: 'POST',
      body: JSON.stringify({ action: 'EXTEND', grantId, ttlMinutes: 30 }),
    });
    const extendRes = await POST(extendReq);
    expect(extendRes.status).toBe(200);
    const extendJson = await extendRes.json();
    expect(extendJson.success).toBe(true);
    expect(extendJson.grant?.status).toBe('ACTIVE');

    // Test POST REVOKE
    const revokeReq = new Request('http://localhost:3000/api/sync/state', {
      method: 'POST',
      body: JSON.stringify({ action: 'REVOKE', grantId }),
    });
    const revokeRes = await POST(revokeReq);
    expect(revokeRes.status).toBe(200);
    const revokeJson = await revokeRes.json();
    expect(revokeJson.success).toBe(true);
    expect(revokeJson.grant?.status).toBe('REVOKED');
  });

  it('6. Seeds official persistent vault ledger to disk and verifies full access requests & identities', () => {
    const targetPath = path.join(process.cwd(), '.securemax_db', 'vault_ledger.json');
    process.env.SECUREMAX_STORE_PATH = targetPath;
    deviceStore.seedTestDataForTesting(true);
    // Ensure initial showcase requests are PENDING for interactive option demonstration
    const r1 = deviceStore.accessRequests.find(r => r.id === 'req-1');
    if (r1) r1.status = 'PENDING';
    const r2 = deviceStore.accessRequests.find(r => r.id === 'req-2');
    if (r2) r2.status = 'PENDING';
    const r001 = deviceStore.accessRequests.find(r => r.id === 'req_001');
    if (r001) r001.status = 'PENDING';

    deviceStore.saveToDisk();
    delete process.env.SECUREMAX_STORE_PATH;

    expect(fs.existsSync(targetPath)).toBe(true);
    const parsed = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
    expect(parsed.accessRequests.some((r: any) => r.id === 'req-1' && r.user_name === 'Arjun Verma' && r.status === 'PENDING')).toBe(true);
    expect(parsed.accessRequests.some((r: any) => r.id === 'req-2' && r.user_name === 'Neha Iyer' && r.status === 'PENDING')).toBe(true);
    expect(parsed.accessRequests.some((r: any) => r.id === 'req_001' && r.status === 'PENDING')).toBe(true);
    expect(parsed.users.some((u: any) => u.id === 'usr_admin_001')).toBe(true);
    expect(parsed.users.some((u: any) => u.id === 'usr_vasu_002')).toBe(true);
  });
});
