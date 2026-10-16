import 'server-only';

export type OAuthProvider = 'google' | 'github' | 'microsoft';

export interface ProviderConfig {
  provider: OAuthProvider;
  name: string;
  clientId: string;
  clientSecret: string;
  tenantId?: string;
  authorizationUrl: string;
  tokenUrl: string;
  userinfoUrl?: string;
  scopes: string[];
  supportsPkce: boolean;
}

/**
 * Returns the base URL for the application, resolving through:
 * 1. APP_BASE_URL
 * 2. NEXT_PUBLIC_APP_URL
 * 3. Request headers (x-forwarded-host / host)
 * 4. Fallback to http://localhost:3000
 */
export function getAppBaseUrl(req?: Request): string {
  if (process.env.APP_BASE_URL) {
    return process.env.APP_BASE_URL.replace(/\/$/, '');
  }
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  }
  if (req) {
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
    const proto = req.headers.get('x-forwarded-proto') || (host?.includes('localhost') ? 'http' : 'https');
    if (host) {
      return `${proto}://${host}`;
    }
  }
  return 'http://localhost:3000';
}

/**
 * Calculates the exact callback URL for a given OAuth provider.
 */
export function getCallbackUrl(provider: OAuthProvider, req?: Request): string {
  const baseUrl = getAppBaseUrl(req);
  return `${baseUrl}/api/auth/callback/${provider}`;
}

/**
 * Returns true if the specified provider has its required credentials configured.
 */
export function isProviderConfigured(provider: OAuthProvider): boolean {
  switch (provider) {
    case 'google':
      return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
    case 'github':
      return Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
    case 'microsoft':
      return Boolean(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET);
    default:
      return false;
  }
}

/**
 * Returns provider configuration or throws if required environment variables are missing.
 */
export function getProviderConfig(provider: OAuthProvider, req?: Request): ProviderConfig {
  switch (provider) {
    case 'google': {
      const clientId = process.env.GOOGLE_CLIENT_ID || '';
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
      if (!clientId || !clientSecret) {
        throw new Error('Google OAuth is not configured. Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET.');
      }
      return {
        provider: 'google',
        name: 'Google',
        clientId,
        clientSecret,
        authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        userinfoUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
        scopes: ['openid', 'email', 'profile'],
        supportsPkce: true,
      };
    }

    case 'github': {
      const clientId = process.env.GITHUB_CLIENT_ID || '';
      const clientSecret = process.env.GITHUB_CLIENT_SECRET || '';
      if (!clientId || !clientSecret) {
        throw new Error('GitHub OAuth is not configured. Missing GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET.');
      }
      return {
        provider: 'github',
        name: 'GitHub',
        clientId,
        clientSecret,
        authorizationUrl: 'https://github.com/login/oauth/authorize',
        tokenUrl: 'https://github.com/login/oauth/access_token',
        userinfoUrl: 'https://api.github.com/user',
        scopes: ['read:user', 'user:email'],
        supportsPkce: false,
      };
    }

    case 'microsoft': {
      const clientId = process.env.MICROSOFT_CLIENT_ID || '';
      const clientSecret = process.env.MICROSOFT_CLIENT_SECRET || '';
      const tenantId = process.env.MICROSOFT_TENANT_ID || 'common';
      if (!clientId || !clientSecret) {
        throw new Error('Microsoft OAuth is not configured. Missing MICROSOFT_CLIENT_ID or MICROSOFT_CLIENT_SECRET.');
      }
      return {
        provider: 'microsoft',
        name: 'Microsoft',
        clientId,
        clientSecret,
        tenantId,
        authorizationUrl: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,
        tokenUrl: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
        userinfoUrl: 'https://graph.microsoft.com/v1.0/me',
        scopes: ['openid', 'email', 'profile', 'User.Read'],
        supportsPkce: true,
      };
    }

    default:
      throw new Error(`Unsupported OAuth provider: ${provider}`);
  }
}
