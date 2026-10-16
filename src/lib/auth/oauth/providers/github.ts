import 'server-only';
import { getProviderConfig } from '../config';

export interface GitHubTokens {
  access_token: string;
  token_type: string;
  scope?: string;
}

export interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url?: string;
}

export interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
  visibility: string | null;
}

export function buildGithubAuthUrl(params: {
  redirectUri: string;
  state: string;
}): string {
  const config = getProviderConfig('github');
  const url = new URL(config.authorizationUrl);
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('scope', config.scopes.join(' '));
  url.searchParams.set('state', params.state);
  url.searchParams.set('allow_signup', 'true');
  return url.toString();
}

export async function exchangeGithubCode(params: {
  code: string;
  redirectUri: string;
}): Promise<GitHubTokens> {
  const config = getProviderConfig('github');
  const res = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code: params.code,
      redirect_uri: params.redirectUri,
    }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const desc = errorData.error_description || errorData.error || res.statusText;
    throw new Error(`GitHub token exchange failed: ${desc}`);
  }

  const data = await res.json();
  if (data.error) {
    throw new Error(`GitHub token error: ${data.error_description || data.error}`);
  }
  if (!data.access_token) {
    throw new Error('GitHub token response did not contain an access_token');
  }
  return data as GitHubTokens;
}

export async function fetchGithubUserProfile(tokens: GitHubTokens): Promise<{
  providerUserId: string;
  email: string;
  name: string;
  avatarUrl?: string;
}> {
  // 1. Fetch user base profile
  const userRes = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'SecureMAX-Cybersecurity-Platform',
    },
  });

  if (!userRes.ok) {
    const errText = await userRes.text().catch(() => '');
    throw new Error(`Failed to fetch GitHub profile: ${userRes.status} ${errText}`);
  }

  const userData = (await userRes.json()) as GitHubUser;

  // 2. Fetch user verified emails to ensure strict email ownership
  const emailsRes = await fetch('https://api.github.com/user/emails', {
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'SecureMAX-Cybersecurity-Platform',
    },
  });

  if (!emailsRes.ok) {
    throw new Error('Failed to verify GitHub email ownership. Could not retrieve verified email list from GitHub API.');
  }

  const emails = (await emailsRes.json()) as GitHubEmail[];
  if (!Array.isArray(emails) || emails.length === 0) {
    throw new Error('GitHub account does not have any emails associated. Verification required.');
  }

  // Find primary verified email
  let verifiedEmail: string | null = null;
  const primaryVerified = emails.find(e => e.primary && e.verified);
  if (primaryVerified) {
    verifiedEmail = primaryVerified.email;
  } else {
    // Fallback strictly to any email explicitly confirmed as verified
    const anyVerified = emails.find(e => e.verified);
    if (anyVerified) {
      verifiedEmail = anyVerified.email;
    }
  }

  // STRICT ZERO-TRUST SECURITY CONTROL:
  // NEVER fall back to unverified userData.email! GitHub permits users to set arbitrary unverified
  // public profile emails. Merging or authenticating against unverified public emails enables account impersonation.
  if (!verifiedEmail) {
    throw new Error('GitHub account does not have a verified email address. Verification required.');
  }

  return {
    providerUserId: String(userData.id),
    email: verifiedEmail.toLowerCase().trim(),
    name: userData.name || userData.login,
    avatarUrl: userData.avatar_url,
  };
}
