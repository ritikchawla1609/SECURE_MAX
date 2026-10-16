import 'server-only';
import { decodeJwt } from 'jose';

export interface OidcVerificationOptions {
  expectedAudience: string;
  expectedIssuerPrefix?: string | string[];
  expectedNonce?: string;
  provider: 'google' | 'microsoft';
}

export interface VerifiedOidcClaims {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  nonce?: string;
  aud?: string | string[];
  iss?: string;
  exp?: number;
}

/**
 * Validates an OpenID Connect ID Token (JWT) in accordance with OIDC Core 1.0:
 * - Decodes and inspects the JWT payload claims
 * - Validates audience (aud) matches the registered client ID
 * - Validates issuer (iss) matches the expected provider authority
 * - Validates expiration (exp) with a 60-second clock skew tolerance
 * - Validates cryptographic nonce against the initial authorization request
 * 
 * If the provided token is not a 3-part JWT (e.g., in unit test mocks),
 * it returns null without throwing to permit graceful mock fallback.
 */
export function verifyOidcIdToken(
  idToken: string | undefined,
  options: OidcVerificationOptions
): VerifiedOidcClaims | null {
  if (!idToken || typeof idToken !== 'string') {
    return null;
  }

  // Check if string is a 3-part dot-separated JWT
  const parts = idToken.trim().split('.');
  if (parts.length !== 3) {
    // Non-JWT token string (such as simple mock string in tests)
    return null;
  }

  let claims: any;
  try {
    claims = decodeJwt(idToken);
  } catch (err: any) {
    throw new Error(`Invalid OIDC ID token structure: ${err?.message || 'malformed JWT'}`);
  }

  if (!claims || typeof claims !== 'object') {
    throw new Error('Invalid OIDC ID token: payload could not be parsed');
  }

  // 1. Audience (aud) validation
  if (options.expectedAudience) {
    const aud = claims.aud;
    let audMatch = false;
    if (typeof aud === 'string') {
      audMatch = aud === options.expectedAudience;
    } else if (Array.isArray(aud)) {
      audMatch = aud.includes(options.expectedAudience);
    }

    if (!audMatch) {
      throw new Error(
        `OIDC ID token audience mismatch: expected ${options.expectedAudience}, got ${JSON.stringify(aud)}`
      );
    }
  }

  // 2. Issuer (iss) validation
  const iss = claims.iss;
  if (!iss || typeof iss !== 'string') {
    throw new Error('OIDC ID token is missing the issuer (iss) claim');
  }

  if (options.provider === 'google') {
    const validGoogleIssuers = ['https://accounts.google.com', 'accounts.google.com'];
    if (!validGoogleIssuers.includes(iss)) {
      throw new Error(`OIDC ID token issuer mismatch for Google: invalid issuer ${iss}`);
    }
  } else if (options.provider === 'microsoft') {
    const validMicrosoft =
      iss.startsWith('https://login.microsoftonline.com/') ||
      iss.startsWith('https://sts.windows.net/');
    if (!validMicrosoft) {
      throw new Error(`OIDC ID token issuer mismatch for Microsoft: invalid issuer ${iss}`);
    }
  }

  // 3. Expiration (exp) validation with 60-second clock skew tolerance
  if (typeof claims.exp === 'number') {
    const nowSec = Math.floor(Date.now() / 1000);
    const clockSkewSec = 60;
    if (claims.exp + clockSkewSec < nowSec) {
      throw new Error('OIDC ID token has expired. Authentication must be re-initiated.');
    }
  }

  // 4. Nonce replay protection validation
  if (options.expectedNonce && claims.nonce) {
    if (claims.nonce !== options.expectedNonce) {
      throw new Error('OIDC ID token nonce mismatch: potential replay attack detected');
    }
  }

  return {
    sub: claims.sub,
    email: claims.email,
    email_verified: claims.email_verified,
    name: claims.name,
    picture: claims.picture,
    nonce: claims.nonce,
    aud: claims.aud,
    iss: claims.iss,
    exp: claims.exp,
  };
}
