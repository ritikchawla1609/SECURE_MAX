import 'server-only';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitRecord>();
const MAX_RATE_LIMIT_ENTRIES = 5000;

/**
 * Clean up expired rate limit records periodically.
 */
function cleanupExpired() {
  const now = Date.now();
  for (const [key, record] of rateLimitMap.entries()) {
    if (record.resetAt <= now) {
      rateLimitMap.delete(key);
    }
  }

  // Hard safety limit against memory exhaustion attacks
  if (rateLimitMap.size > MAX_RATE_LIMIT_ENTRIES) {
    const keysToDelete = Array.from(rateLimitMap.keys()).slice(0, 1000);
    for (const k of keysToDelete) {
      rateLimitMap.delete(k);
    }
  }
}

/**
 * Checks in-memory sliding window rate limit for an identifier (e.g. client IP + action).
 * Default: 30 requests per minute.
 */
export function checkRateLimit(
  identifier: string,
  limit: number = 30,
  windowMs: number = 60 * 1000
): { allowed: boolean; remaining: number; reset: number } {
  const now = Date.now();
  if (rateLimitMap.size > 1000) {
    cleanupExpired();
  }

  const record = rateLimitMap.get(identifier);
  if (!record || record.resetAt <= now) {
    rateLimitMap.set(identifier, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, reset: Math.ceil(windowMs / 1000) };
  }

  if (record.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      reset: Math.ceil((record.resetAt - now) / 1000),
    };
  }

  record.count += 1;
  return {
    allowed: true,
    remaining: limit - record.count,
    reset: Math.ceil((record.resetAt - now) / 1000),
  };
}

/**
 * Extracts client IP address from standard reverse-proxy headers.
 */
export function getClientIp(req: Request): string {
  const xForwardedFor = req.headers.get('x-forwarded-for');
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0].trim();
  }
  const xRealIp = req.headers.get('x-real-ip');
  if (xRealIp) {
    return xRealIp.trim();
  }
  const cfConnectingIp = req.headers.get('cf-connecting-ip');
  if (cfConnectingIp) {
    return cfConnectingIp.trim();
  }
  return '127.0.0.1';
}
