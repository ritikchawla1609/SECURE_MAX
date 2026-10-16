import 'server-only';
import crypto from 'crypto';

/**
 * Generates a cryptographically random PKCE code verifier (RFC 7636).
 * Returns a 43-128 character URL-safe string.
 */
export function generateCodeVerifier(): string {
  return crypto.randomBytes(48).toString('base64url');
}

/**
 * Derives the PKCE code challenge from a code verifier using SHA-256 (S256).
 */
export function generateCodeChallenge(codeVerifier: string): string {
  return crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
}
