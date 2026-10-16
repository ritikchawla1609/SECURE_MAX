import crypto from 'crypto';
import { supabaseAdmin, isSupabaseConfigured } from './client';

/**
 * Deterministically maps any arbitrary string ID (e.g. 'usr_admin_001', 'ast_123')
 * to a valid, collision-resistant RFC 4122 v4-formatted UUID for PostgreSQL compatibility.
 */
export function toUuid(input: string): string {
  if (!input) {
    return '00000000-0000-4000-8000-000000000000';
  }
  // If already a valid UUID, return as-is
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input)) {
    return input.toLowerCase();
  }
  const hash = crypto.createHash('md5').update('securemax:' + input).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`.toLowerCase();
}

/**
 * Asynchronously syncs the complete vault ledger to Supabase Cloud Storage.
 * This guarantees state survival across Vercel container recycles and multi-worker instances.
 */
export async function syncLedgerToSupabase(payload: any): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const jsonString = JSON.stringify(payload);
    const { error } = await supabaseAdmin.storage
      .from('securemax-vault')
      .upload('vault_ledger.json', jsonString, {
        contentType: 'application/json',
        upsert: true,
      });

    if (error) {
      console.warn('[SupabaseSync] Storage sync warning:', error.message);
      return false;
    }
    return true;
  } catch (err: any) {
    console.warn('[SupabaseSync] Failed to sync ledger to Supabase:', err.message);
    return false;
  }
}

/**
 * Downloads the latest persistent vault ledger from Supabase Cloud Storage.
 */
export async function fetchLedgerFromSupabase(): Promise<any | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const { data: urlData, error: urlError } = await supabaseAdmin.storage
      .from('securemax-vault')
      .createSignedUrl('vault_ledger.json', 60);

    if (urlError || !urlData?.signedUrl) {
      return null;
    }

    const cacheBustedUrl = `${urlData.signedUrl}&_t=${Date.now()}`;
    const response = await fetch(cacheBustedUrl, { cache: 'no-store' });
    if (!response.ok) return null;
    return await response.json();
  } catch (err: any) {
    console.warn('[SupabaseSync] Could not download ledger from Supabase:', err.message);
    return null;
  }
}

/**
 * Dual-writes user records into Supabase PostgreSQL 'users' table.
 */
export async function syncUserToSupabase(user: {
  id: string;
  name: string;
  email: string;
  status?: string;
}): Promise<void> {
  if (!isSupabaseConfigured() || !user.email) return;
  try {
    const uuid = toUuid(user.id);
    const status = user.status === 'REVOKED' ? 'REVOKED' : user.status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE';
    
    const { error } = await supabaseAdmin
      .from('users')
      .upsert({
        id: uuid,
        display_name: user.name || user.email,
        email: user.email.toLowerCase().trim(),
        status,
      }, { onConflict: 'email' });

    if (error) {
      console.warn('[SupabaseSync] User sync error:', error.message);
    }
  } catch (err: any) {
    console.warn('[SupabaseSync] User sync exception:', err.message);
  }
}

/**
 * Dual-writes asset records into Supabase PostgreSQL 'assets' table.
 */
export async function syncAssetToSupabase(asset: {
  id: string;
  asset_code: string;
  name: string;
  description?: string;
  classification: string;
  ownerId?: string;
  owner_id?: string;
  status?: string;
}): Promise<void> {
  if (!isSupabaseConfigured() || !asset.asset_code) return;
  try {
    const uuid = toUuid(asset.id);
    const ownerUuid = toUuid(asset.ownerId || asset.owner_id || 'usr_admin_001');
    const validClassifications = ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED', 'HIGH'];
    const classification = validClassifications.includes(asset.classification) ? asset.classification : 'CONFIDENTIAL';

    // Ensure owner exists first in Supabase to satisfy foreign key
    const { error: ownerErr } = await supabaseAdmin
      .from('users')
      .upsert({
        id: ownerUuid,
        display_name: 'Asset Owner',
        email: `owner_${ownerUuid.slice(0, 8)}@securemax.system`,
        status: 'ACTIVE',
      }, { onConflict: 'id' });

    if (ownerErr) {
      console.warn('[SupabaseSync] Asset owner upsert error:', ownerErr.message);
    }

    const { error: assetErr } = await supabaseAdmin
      .from('assets')
      .upsert({
        id: uuid,
        asset_code: asset.asset_code,
        name: asset.name,
        description: asset.description || null,
        classification,
        owner_id: ownerUuid,
        status: asset.status === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'asset_code' });

    if (assetErr) {
      console.warn('[SupabaseSync] Asset sync error:', assetErr.message);
    }
  } catch (err: any) {
    console.warn('[SupabaseSync] Asset sync exception:', err.message);
  }
}

/**
 * Dual-writes device records into Supabase PostgreSQL 'devices' table.
 */
export async function syncDeviceToSupabase(device: {
  id: string;
  userId?: string;
  user_id?: string;
  deviceName?: string;
  device_name?: string;
  status?: string;
}): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    const uuid = toUuid(device.id);
    const userUuid = toUuid(device.userId || device.user_id || 'usr_admin_001');
    const status = device.status === 'REVOKED' ? 'REVOKED' : device.status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE';
    const fingerprint = `${device.deviceName || device.device_name || 'workstation'}_${device.id}`;

    // Ensure user exists first
    const { error: userErr } = await supabaseAdmin
      .from('users')
      .upsert({
        id: userUuid,
        display_name: 'Device Owner',
        email: `device_owner_${userUuid.slice(0, 8)}@securemax.system`,
        status: 'ACTIVE',
      }, { onConflict: 'id' });

    if (userErr) {
      console.warn('[SupabaseSync] Device user upsert error:', userErr.message);
    }

    const { error: devErr } = await supabaseAdmin
      .from('devices')
      .upsert({
        id: uuid,
        user_id: userUuid,
        device_fingerprint: fingerprint,
        status,
        last_seen_at: new Date().toISOString(),
      }, { onConflict: 'device_fingerprint' });

    if (devErr) {
      console.warn('[SupabaseSync] Device sync error:', devErr.message);
    }
  } catch (err: any) {
    console.warn('[SupabaseSync] Device sync exception:', err.message);
  }
}

/**
 * Dual-writes access requests into Supabase PostgreSQL 'access_requests' table.
 */
export async function syncAccessRequestToSupabase(req: {
  id: string;
  user_id: string;
  asset_id?: string;
  reason?: string;
  status?: string;
}): Promise<void> {
  if (!isSupabaseConfigured() || !req.asset_id) return;
  try {
    const uuid = toUuid(req.id);
    const userUuid = toUuid(req.user_id);
    const assetUuid = toUuid(req.asset_id);
    const validStatuses = ['PENDING', 'AUTHORIZED', 'DENIED', 'EXPIRED', 'REVOKED'];
    const mappedStatus = req.status === 'APPROVED' ? 'AUTHORIZED' : req.status === 'REJECTED' ? 'DENIED' : 'PENDING';

    const { error } = await supabaseAdmin
      .from('access_requests')
      .upsert({
        id: uuid,
        user_id: userUuid,
        asset_id: assetUuid,
        purpose: req.reason || 'Official duty requirement',
        status: mappedStatus,
        created_at: new Date().toISOString(),
      }, { onConflict: 'id' });

    if (error) {
      console.warn('[SupabaseSync] Access request sync error:', error.message);
    }
  } catch (err: any) {
    console.warn('[SupabaseSync] Access request sync exception:', err.message);
  }
}
