import 'server-only';
import { getProviderConfig } from '../config';
import { verifyOidcIdToken } from '../oidc';

export interface MicrosoftTokens {
  access_token: string;
  id_token?: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

export interface MicrosoftGraphUser {
  id: string;
  displayName?: string;
  givenName?: string;
  surname?: string;
  mail?: string | null;
  userPrincipalName?: string | null;
}

export function buildMicrosoftAuthUrl(params: {
  redirectUri: string;
  state: string;
  codeChallenge: string;
  nonce?: string;
}): string {
  const config = getProviderConfig('microsoft');
  const url = new URL(config.authorizationUrl);
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('response_mode', 'query');
  url.searchParams.set('scope', config.scopes.join(' '));
  url.searchParams.set('state', params.state);
  url.searchParams.set('code_challenge', params.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('prompt', 'select_account');
  if (params.nonce) {
    url.searchParams.set('nonce', params.nonce);
  }
  return url.toString();
}

export async function exchangeMicrosoftCode(params: {
  code: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<MicrosoftTokens> {
  const config = getProviderConfig('microsoft');
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: 'authorization_code',
    code: params.code,
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
    throw new Error(`Microsoft token exchange failed: ${desc}`);
  }

  const tokens = (await res.json()) as MicrosoftTokens;
  if (!tokens.access_token) {
    throw new Error('Microsoft token response did not contain an access_token');
  }
  return tokens;
}

export async function fetchMicrosoftUserProfile(
  tokens: MicrosoftTokens,
  options?: { expectedNonce?: string }
): Promise<{
  providerUserId: string;
  email: string;
  name: string;
  avatarUrl?: string;
}> {
  const config = getProviderConfig('microsoft');

  // 1. Inspect and validate OIDC ID token if returned
  let idTokenClaims: any = null;
  if (tokens.id_token) {
    idTokenClaims = verifyOidcIdToken(tokens.id_token, {
      expectedAudience: config.clientId,
      expectedNonce: options?.expectedNonce,
      provider: 'microsoft',
    });
  }

  // 2. Fetch Graph profile
  const userinfoUrl = 'https://graph.microsoft.com/v1.0/me';
  const res = await fetch(userinfoUrl, {
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Failed to fetch Microsoft Graph user profile: ${res.status} ${errText}`);
  }

  const data = (await res.json()) as MicrosoftGraphUser;

  // Resolve authoritative email:
  // Prefer data.mail (verified mailbox)
  // Or idTokenClaims.email
  // Or idTokenClaims.preferred_username (if valid email format)
  // Fall back to data.userPrincipalName ONLY if it is not an unverified synthetic external guest UPN (#EXT#)
  let emailCandidate: string | null = null;

  if (data.mail && data.mail.includes('@')) {
    emailCandidate = data.mail;
  } else if (idTokenClaims?.email && idTokenClaims.email.includes('@')) {
    emailCandidate = idTokenClaims.email;
  } else if (idTokenClaims?.preferred_username && idTokenClaims.preferred_username.includes('@') && !idTokenClaims.preferred_username.includes('#EXT#')) {
    emailCandidate = idTokenClaims.preferred_username;
  } else if (data.userPrincipalName && data.userPrincipalName.includes('@')) {
    if (data.userPrincipalName.includes('#EXT#')) {
      throw new Error('Microsoft external guest account (#EXT#) lacks a verified primary mailbox email address.');
    }
    emailCandidate = data.userPrincipalName;
  }

  if (!emailCandidate || !emailCandidate.includes('@')) {
    throw new Error('Microsoft account does not have an associated valid email address.');
  }

  return {
    providerUserId: data.id || idTokenClaims?.sub || 'ms_user',
    email: emailCandidate.toLowerCase().trim(),
    name: data.displayName || idTokenClaims?.name || emailCandidate.split('@')[0],
  };
}
