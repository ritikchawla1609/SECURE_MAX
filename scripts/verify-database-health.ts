import 'dotenv/config';

import { createClient } from '@supabase/supabase-js';
import { toUuid, syncUserToSupabase, syncAssetToSupabase, syncDeviceToSupabase, syncAccessRequestToSupabase, syncLedgerToSupabase, fetchLedgerFromSupabase } from '../src/lib/db/supabase-sync';
import fs from 'fs';
import path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const ALL_TABLES = [
  'users',
  'roles',
  'user_roles',
  'dids',
  'wallets',
  'devices',
  'assets',
  'asset_assignments',
  'asset_permissions',
  'access_requests',
  'access_sessions',
  'encryption_keys',
  'key_versions',
  'key_policies',
  'key_access_events',
  'audit_events',
  'security_scans',
  'security_findings',
  'security_incidents',
  'break_glass_requests',
  'blockchain_transactions',
];

interface TableHealth {
  table: string;
  exists: boolean;
  rowCount: number;
  error?: string;
}

async function probeTable(table: string): Promise<TableHealth> {
  try {
    const { data, count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });

    if (error) {
      return { table, exists: false, rowCount: 0, error: error.message };
    }
    return { table, exists: true, rowCount: count || 0 };
  } catch (err: any) {
    return { table, exists: false, rowCount: 0, error: err.message };
  }
}

async function runHealthCheck() {
  console.log('====================================================');
  console.log('🛡️  SECUREMAX COMPREHENSIVE DATABASE HEALTH AUDIT');
  console.log('====================================================');
  console.log(`Supabase URL: ${supabaseUrl}`);
  console.log(`Timestamp:    ${new Date().toISOString()}\n`);

  // 1. Audit All 21 Tables
  console.log('--- 1. AUDITING 21 POSTGRESQL TABLES ---');
  const results: TableHealth[] = [];
  for (const table of ALL_TABLES) {
    const health = await probeTable(table);
    results.push(health);
    const statusIcon = health.exists ? '✅' : '❌';
    const info = health.exists
      ? `EXISTS (${health.rowCount} rows)`
      : `FAILED: ${health.error}`;
    console.log(`${statusIcon} ${table.padEnd(25)} : ${info}`);
  }

  const existingCount = results.filter(r => r.exists).length;
  console.log(`\nSummary: ${existingCount}/${ALL_TABLES.length} tables verified and reachable.\n`);

  // 2. Audit Cloud Storage
  console.log('--- 2. AUDITING CLOUD STORAGE BUCKET (securemax-vault) ---');
  try {
    const { data: buckets, error: bucketErr } = await supabase.storage.listBuckets();
    if (bucketErr) {
      console.log(`❌ Failed to list buckets: ${bucketErr.message}`);
    } else {
      const vaultBucket = buckets?.find(b => b.name === 'securemax-vault');
      if (vaultBucket) {
        console.log(`✅ Bucket 'securemax-vault' exists. Public: ${vaultBucket.public}`);
      } else {
        console.log(`⚠️ Bucket 'securemax-vault' not found in bucket list.`);
      }
    }

    const { data: files, error: listErr } = await supabase.storage
      .from('securemax-vault')
      .list();

    if (listErr) {
      console.log(`❌ Failed to list files in bucket: ${listErr.message}`);
    } else {
      console.log(`✅ Files in 'securemax-vault': ${files?.map(f => f.name).join(', ') || 'empty'}`);
    }

    // Download ledger
    const cloudLedger = await fetchLedgerFromSupabase();
    if (cloudLedger) {
      console.log(`✅ Successfully downloaded 'vault_ledger.json' from cloud:`);
      console.log(`   - Users:          ${Object.keys(cloudLedger.users || {}).length}`);
      console.log(`   - Assets:         ${Object.keys(cloudLedger.assets || {}).length}`);
      console.log(`   - Devices:        ${Object.keys(cloudLedger.devices || {}).length}`);
      console.log(`   - AccessRequests: ${Object.keys(cloudLedger.accessRequests || {}).length}`);
      console.log(`   - Version:        ${cloudLedger.version || 'unversioned'}`);
      console.log(`   - SavedAt:        ${cloudLedger.savedAt || 'unknown'}`);
    } else {
      console.log(`❌ Failed to download or parse 'vault_ledger.json' from cloud.`);
    }
  } catch (err: any) {
    console.log(`❌ Storage audit exception: ${err.message}`);
  }

  // 3. Audit Dual-Write Persistence
  console.log('\n--- 3. TESTING DUAL-WRITE PERSISTENCE (CRUD) ---');
  const testId = `diag_${Date.now()}`;
  const testUser = {
    id: `usr_${testId}`,
    name: `Diagnostic User ${testId}`,
    email: `diag_${testId}@securemax.test`,
    status: 'ACTIVE',
  };

  const testAsset = {
    id: `ast_${testId}`,
    asset_code: `AST-DIAG-${testId}`,
    name: `Diagnostic Asset ${testId}`,
    classification: 'CONFIDENTIAL',
    ownerId: testUser.id,
    status: 'ACTIVE',
  };

  const testDevice = {
    id: `dev_${testId}`,
    userId: testUser.id,
    deviceName: `Diagnostic Laptop ${testId}`,
    status: 'ACTIVE',
  };

  const testAccessReq = {
    id: `req_${testId}`,
    user_id: testUser.id,
    asset_id: testAsset.id,
    reason: 'Diagnostic automated check',
    status: 'PENDING',
  };

  try {
    // Write user
    console.log(`Writing test user (${testUser.email})...`);
    await syncUserToSupabase(testUser);
    const userUuid = toUuid(testUser.id);
    const { data: dbUser, error: uErr } = await supabase
      .from('users')
      .select('*')
      .eq('id', userUuid)
      .maybeSingle();
    if (uErr || !dbUser) {
      console.log(`❌ User dual-write failed: ${uErr?.message || 'Row not found'}`);
    } else {
      console.log(`✅ User dual-write verified in database: ${dbUser.display_name} (ID: ${dbUser.id})`);
    }

    // Write asset
    console.log(`Writing test asset (${testAsset.asset_code})...`);
    await syncAssetToSupabase(testAsset);
    const assetUuid = toUuid(testAsset.id);
    const { data: dbAsset, error: aErr } = await supabase
      .from('assets')
      .select('*')
      .eq('id', assetUuid)
      .maybeSingle();
    if (aErr || !dbAsset) {
      console.log(`❌ Asset dual-write failed: ${aErr?.message || 'Row not found'}`);
    } else {
      console.log(`✅ Asset dual-write verified in database: ${dbAsset.name} (Code: ${dbAsset.asset_code})`);
    }

    // Write device
    console.log(`Writing test device (${testDevice.id})...`);
    await syncDeviceToSupabase(testDevice);
    const deviceUuid = toUuid(testDevice.id);
    const { data: dbDevice, error: dErr } = await supabase
      .from('devices')
      .select('*')
      .eq('id', deviceUuid)
      .maybeSingle();
    if (dErr || !dbDevice) {
      console.log(`❌ Device dual-write failed: ${dErr?.message || 'Row not found'}`);
    } else {
      console.log(`✅ Device dual-write verified in database: ${dbDevice.device_fingerprint}`);
    }

    // Write access request
    console.log(`Writing test access request (${testAccessReq.id})...`);
    await syncAccessRequestToSupabase(testAccessReq);
    const reqUuid = toUuid(testAccessReq.id);
    const { data: dbReq, error: rErr } = await supabase
      .from('access_requests')
      .select('*')
      .eq('id', reqUuid)
      .maybeSingle();
    if (rErr || !dbReq) {
      console.log(`❌ Access request dual-write failed: ${rErr?.message || 'Row not found'}`);
    } else {
      console.log(`✅ Access request dual-write verified in database: ${dbReq.purpose} (Status: ${dbReq.status})`);
    }

    // Cleanup test records
    console.log('\nCleaning up diagnostic test rows...');
    await supabase.from('access_requests').delete().eq('id', reqUuid);
    await supabase.from('devices').delete().eq('id', deviceUuid);
    await supabase.from('assets').delete().eq('id', assetUuid);
    await supabase.from('users').delete().eq('id', userUuid);
    console.log('✅ Cleanup completed cleanly.');

  } catch (err: any) {
    console.log(`❌ Dual-write test error: ${err.message}`);
  }

  // 4. Local Disk vs Cloud Sync Comparison
  console.log('\n--- 4. LOCAL DISK VS CLOUD LEDGER COMPARISON ---');
  const localLedgerPath = path.join(process.cwd(), '.securemax_db', 'vault_ledger.json');
  if (fs.existsSync(localLedgerPath)) {
    try {
      const localData = JSON.parse(fs.readFileSync(localLedgerPath, 'utf8'));
      console.log(`✅ Local ledger exists at: ${localLedgerPath}`);
      console.log(`   - Users:          ${Object.keys(localData.users || {}).length}`);
      console.log(`   - Assets:         ${Object.keys(localData.assets || {}).length}`);
      console.log(`   - Devices:        ${Object.keys(localData.devices || {}).length}`);
      console.log(`   - AccessRequests: ${Object.keys(localData.accessRequests || {}).length}`);
      console.log(`   - SavedAt:        ${localData.savedAt || 'unknown'}`);
    } catch (e: any) {
      console.log(`❌ Error reading local ledger: ${e.message}`);
    }
  } else {
    console.log(`ℹ️ No local ledger file found at ${localLedgerPath} (running purely on cloud/seed)`);
  }

  console.log('\n====================================================');
  console.log('🏁 AUDIT COMPLETE');
  console.log('====================================================');
}

runHealthCheck();
