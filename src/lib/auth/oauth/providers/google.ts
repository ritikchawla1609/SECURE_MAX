import 'server-only';
import { getProviderConfig } from '../config';
import { verifyOidcIdToken } from '../oidc';

export interface GoogleTokens {
  access_token: string;
  id_token?: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

export interface GoogleUserInfo {
  sub: string;
  name: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  email: string;
  email_verified: boolean | string;
}

export function buildGoogleAuthUrl(params: {
  redirectUri: string;
  state: string;
  codeChallenge: string;
  nonce?: string;
}): string {
  const config = getProviderConfig('google');
  const url = new URL(config.authorizationUrl);
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', config.scopes.join(' '));
  url.searchParams.set('state', params.state);
  url.searchParams.set('code_challenge', params.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'select_account');
  if (params.nonce) {
    url.searchParams.set('nonce', params.nonce);
  }
  return url.toString();
}

export async function exchangeGoogleCode(params: {
  code: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<GoogleTokens> {
  const config = getProviderConfig('google');
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: params.code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: params.redirectUri,
    code_verifier: params.codeVerifier,
  });

  const res = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const desc = errorData.error_description || errorData.error || res.statusText;
    throw new Error(`Google token exchange failed: ${desc}`);
  }

  const tokens = (await res.json()) as GoogleTokens;
  if (!tokens.access_token) {
    throw new Error('Google token response did not contain an access_token');
  }
  return tokens;
}

export async function fetchGoogleUserProfile(
  tokens: GoogleTokens,
  options?: { expectedNonce?: string }
): Promise<{
  providerUserId: string;
  email: string;
  name: string;
  avatarUrl?: string;
}> {
  const config = getProviderConfig('google');

  // 1. If an OIDC id_token was returned, validate its cryptographic claims
  if (tokens.id_token) {
    const oidcClaims = verifyOidcIdToken(tokens.id_token, {
      expectedAudience: config.clientId,
      expectedNonce: options?.expectedNonce,
      provider: 'google',
    });

    if (oidcClaims && oidcClaims.email_verified === false) {
      throw new Error('Google OIDC ID token asserts email is unverified.');
    }
  }

  // 2. Query userinfo endpoint using access token
  const userinfoUrl = config.userinfoUrl || 'https://openidconnect.googleapis.com/v1/userinfo';

  const res = await fetch(userinfoUrl, {
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Failed to fetch Google user profile: ${res.status} ${errText}`);
  }

  const data = (await res.json()) as GoogleUserInfo;

  if (!data.email) {
    throw new Error('Google profile did not contain an email address');
  }

  // Strict email ownership check: must be verified by Google
  const isVerified = data.email_verified === true || data.email_verified === 'true';
  if (!isVerified) {
    throw new Error('Google email address is not verified. Unverified accounts cannot authenticate.');
  }

  // 3. Cross-verify userinfo sub against ID token sub (mitigating token substitution attacks)
  if (tokens.id_token) {
    const oidcClaims = verifyOidcIdToken(tokens.id_token, {
      expectedAudience: config.clientId,
      expectedNonce: options?.expectedNonce,
      provider: 'google',
    });
    if (oidcClaims && oidcClaims.sub && oidcClaims.sub !== data.sub) {
      throw new Error('Token substitution detected: Google userinfo sub does not match ID token sub');
    }
  }

  return {
    providerUserId: data.sub,
    email: data.email.toLowerCase().trim(),
    name: data.name || data.email.split('@')[0],
    avatarUrl: data.picture,
  };
}
