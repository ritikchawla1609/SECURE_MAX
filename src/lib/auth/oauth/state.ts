import 'server-only';
import crypto from 'crypto';
import { getJwtSecret } from '@/lib/auth/session';
import { OAuthProvider } from './config';

export interface OAuthStatePayload {
  provider: OAuthProvider;
  nonce: string;
  timestamp: number;
  returnUrl: string;
}

const STATE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Sanitizes a return URL to prevent open redirect vulnerabilities,
 * HTTP response splitting (CRLF injection), and redirection into internal API endpoints.
 * Ensures the target is strictly an internal, relative application route.
 */
export function sanitizeReturnUrl(url?: string): string {
  if (!url || typeof url !== 'string') return '/dashboard';
  const clean = url.trim();

  // Security checks:
  // 1. Must start with a single '/'
  // 2. Must not start with '//' (scheme-relative open redirect)
  // 3. Must not contain '\' (browser backslash path traversal/normalization)
  // 4. Must not contain ':' (protocol scheme injection e.g. javascript:, https:)
  // 5. Must not contain control characters or newlines (CRLF HTTP response splitting)
  // 6. Must not target sensitive API endpoints (e.g. /api/auth/logout)
  if (
    clean.startsWith('/') &&
    !clean.startsWith('//') &&
    !clean.includes('\\') &&
    !clean.includes(':') &&
    !/[\r\n\t\x00-\x1f]/.test(clean) &&
    !clean.startsWith('/api/') &&
    clean !== '/api'
  ) {
    return clean;
  }
  return '/dashboard';
}

/**
 * Generates an HMAC-signed state parameter along with an anti-CSRF cookie value.
 */
export function generateOAuthState(provider: OAuthProvider, returnUrl?: string): {
  state: string;
  cookieValue: string;
  nonce: string;
} {
  const nonce = crypto.randomBytes(24).toString('base64url');
  const payload: OAuthStatePayload = {
    provider,
    nonce,
    timestamp: Date.now(),
    returnUrl: sanitizeReturnUrl(returnUrl),
  };

  const secret = getJwtSecret();
  const payloadStr = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', secret).update(payloadStr).digest('base64url');

  const combined = JSON.stringify({ p: payloadStr, s: signature });
  const state = Buffer.from(combined, 'utf8').toString('base64url');

  // Cookie binds provider and nonce
  const cookieValue = `${provider}:${nonce}`;
  return { state, cookieValue, nonce };
}

/**
 * Validates the state parameter and compares the nonce against the secure HttpOnly cookie.
 * Uses timing-safe comparisons to prevent timing attacks.
 */
export function verifyOAuthState(
  stateString?: string,
  expectedProvider?: OAuthProvider,
  cookieValue?: string
): { valid: boolean; payload?: OAuthStatePayload; error?: string } {
  if (!stateString || typeof stateString !== 'string') {
    return { valid: false, error: 'Missing OAuth state parameter' };
  }
  if (!cookieValue || typeof cookieValue !== 'string') {
    return { valid: false, error: 'Missing OAuth CSRF cookie' };
  }

  try {
    const raw = Buffer.from(stateString, 'base64url').toString('utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.p || !parsed.s) {
      return { valid: false, error: 'Malformed OAuth state parameter' };
    }

    const { p: payloadStr, s: signature } = parsed;
    const secret = getJwtSecret();
    const expectedSig = crypto.createHmac('sha256', secret).update(payloadStr).digest('base64url');

    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return { valid: false, error: 'OAuth state signature verification failed' };
    }

    const payload: OAuthStatePayload = JSON.parse(payloadStr);

    // Check expiration (10 minutes max age)
    if (Date.now() - payload.timestamp > STATE_MAX_AGE_MS || payload.timestamp > Date.now() + 60000) {
      return { valid: false, error: 'OAuth state has expired. Please initiate sign-in again.' };
    }

    // Check provider match
    if (expectedProvider && payload.provider !== expectedProvider) {
      return { valid: false, error: `OAuth state provider mismatch: expected ${expectedProvider}, got ${payload.provider}` };
    }

    // Check CSRF cookie match: cookie format is `${provider}:${nonce}`
    const colonIndex = cookieValue.indexOf(':');
    if (colonIndex === -1) {
      return { valid: false, error: 'Malformed OAuth CSRF cookie' };
    }
    const cookieProvider = cookieValue.slice(0, colonIndex);
    const cookieNonce = cookieValue.slice(colonIndex + 1);

    if (!cookieProvider || !cookieNonce || cookieProvider !== payload.provider) {
      return { valid: false, error: 'OAuth CSRF cookie provider mismatch' };
    }

    const nonceBuf = Buffer.from(payload.nonce);
    const cookieNonceBuf = Buffer.from(cookieNonce);
    if (nonceBuf.length !== cookieNonceBuf.length || !crypto.timingSafeEqual(nonceBuf, cookieNonceBuf)) {
      return { valid: false, error: 'OAuth CSRF nonce mismatch' };
    }

    return { valid: true, payload };
  } catch (err: any) {
    return { valid: false, error: 'Invalid or malformed OAuth state parameter' };
  }
}
