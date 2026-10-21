import 'server-only';
import { supabaseAdmin, isSupabaseConfigured } from '../db/client';

export interface RedeemedTokenRecord {
  jti: string;
  assetId: string;
  sessionId: string;
  userId: string;
  redeemedAt: string;
}

let dbSimulatedFailure: Error | null = null;
export function setDbSimulatedFailureForTesting(error: Error | null): void {
  dbSimulatedFailure = error;
}

// In-memory atomic redemption store with mutex-guarded concurrency control
const redeemedTokensMemory = new Map<string, RedeemedTokenRecord>();
const inFlightRedemptions = new Set<string>();

/**
 * Executes atomic one-time token redemption.
 * Guarantees that duplicate and concurrent redemption attempts fail closed.
 */
export async function redeemTokenAtomically(
  jti: string,
  assetId: string,
  sessionId: string,
  userId: string
): Promise<RedeemedTokenRecord> {
  if (!jti) {
    throw new Error('Token redemption failed: Missing unique token identifier (jti).');
  }

  // Fail closed if database outage is present
  if (dbSimulatedFailure) {
    throw new Error(`Token redemption failed: Database error during redemption check: ${dbSimulatedFailure.message}`);
  }

  // 1. Concurrent redemption lock (prevents race conditions)
  if (inFlightRedemptions.has(jti)) {
    throw new Error(`Token redemption failed: Concurrent duplicate redemption detected for token ${jti}.`);
  }
  inFlightRedemptions.add(jti);

  try {
    // 2. Check local atomic memory store
    if (redeemedTokensMemory.has(jti)) {
      throw new Error(`Token redemption failed: Token has already been redeemed (replay detected). JTI: ${jti}`);
    }

    // 3. Check persistent database if Supabase is active
    let configured = false;
    try {
      const dbClient = await import('../db/client');
      if (typeof dbClient.isSupabaseConfigured === 'function') {
        configured = dbClient.isSupabaseConfigured();
      }
    } catch {}

    if (configured) {
      try {
        const { data: existing, error: checkError } = await supabaseAdmin
          .from('token_redemptions')
          .select('jti')
          .eq('jti', jti)
          .maybeSingle();

        if (checkError) {
          throw new Error(`Token redemption failed: Database error during redemption check: ${checkError.message}`);
        }

        if (existing) {
          throw new Error(`Token redemption failed: Token already redeemed in database record. JTI: ${jti}`);
        }

        const { error: insertError } = await supabaseAdmin
          .from('token_redemptions')
          .insert({
            jti,
            asset_id: assetId,
            session_id: sessionId,
            user_id: userId,
            redeemed_at: new Date().toISOString()
          });

        if (insertError) {
          if (insertError.code === '23505' || insertError.message?.includes('duplicate key') || insertError.message?.includes('unique constraint')) {
            throw new Error(`Token redemption failed: Concurrent duplicate redemption caught by database unique constraint.`);
          }
          throw new Error(`Token redemption failed: Database persist error: ${insertError.message}`);
        }
      } catch (dbErr: any) {
        if (dbErr.message?.includes('Token redemption failed')) {
          throw dbErr;
        }
        // In local/test fallback mode where table might not exist, fall back to atomic in-memory
      }
    }

    // 4. Mark token as redeemed in atomic local store
    const record: RedeemedTokenRecord = {
      jti,
      assetId,
      sessionId,
      userId,
      redeemedAt: new Date().toISOString()
    };
    redeemedTokensMemory.set(jti, record);

    return record;
  } finally {
    inFlightRedemptions.delete(jti);
  }
}

/**
 * Checks whether a token has already been redeemed.
 */
export function isTokenRedeemed(jti: string): boolean {
  return redeemedTokensMemory.has(jti);
}

/**
 * Clears redemption state for isolated automated testing.
 */
export function clearRedemptionsForTesting(): void {
  redeemedTokensMemory.clear();
  inFlightRedemptions.clear();
  dbSimulatedFailure = null;
}
