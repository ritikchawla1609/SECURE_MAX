import 'server-only';
import crypto from 'crypto';
import { SignJWT } from 'jose';
import { deviceStore, StoredUser, storeEvents } from '@/lib/auth/deviceStore';
import { syncUserToSupabase } from '@/lib/db/supabase-sync';
import { getJwtSecret } from '@/lib/auth/session';
import { UserRole, UserStatus } from '@/types';
import {
  OAuthProvider,
  getCallbackUrl,
  getProviderConfig,
  isProviderConfigured,
} from './config';
import { generateCodeVerifier, generateCodeChallenge } from './pkce';
import { generateOAuthState, verifyOAuthState, sanitizeReturnUrl } from './state';
import {
  buildGoogleAuthUrl,
  exchangeGoogleCode,
  fetchGoogleUserProfile,
} from './providers/google';
import {
  buildGithubAuthUrl,
  exchangeGithubCode,
  fetchGithubUserProfile,
} from './providers/github';
import {
  buildMicrosoftAuthUrl,
  exchangeMicrosoftCode,
  fetchMicrosoftUserProfile,
} from './providers/microsoft';

export interface OAuthCookieOptions {
  name: string;
  value: string;
  options: {
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'lax' | 'strict' | 'none';
    path: string;
    maxAge: number;
  };
}

export interface InitiateOAuthResult {
  authorizationUrl: string;
  cookiesToSet: OAuthCookieOptions[];
  nonce: string;
}

export interface OAuthCallbackResult {
  sessionToken: string;
  redirectUrl: string;
  user: StoredUser;
  cookiesToClear: string[];
}

/**
 * Initiates the OAuth authorization flow for a supported provider.
 */
export function initiateOAuth(
  provider: OAuthProvider,
  returnUrl?: string,
  req?: Request
): InitiateOAuthResult {
  if (!isProviderConfigured(provider)) {
    const providerName =
      provider === 'google' ? 'Google' : provider === 'github' ? 'GitHub' : 'Microsoft';
    throw new Error(
      `${providerName} OAuth is not configured on this server. Please set the required credentials in environment variables.`
    );
  }

  const config = getProviderConfig(provider, req);
  const redirectUri = getCallbackUrl(provider, req);
  const { state, cookieValue, nonce } = generateOAuthState(provider, returnUrl);

  const cookiesToSet: OAuthCookieOptions[] = [
    {
      name: 'smx_oauth_state',
      value: cookieValue,
      options: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 10 * 60, // 10 minutes
      },
    },
  ];

  let authorizationUrl: string;

  if (config.supportsPkce) {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    cookiesToSet.push({
      name: 'smx_oauth_verifier',
      value: codeVerifier,
      options: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 10 * 60, // 10 minutes
      },
    });

    if (provider === 'google') {
      authorizationUrl = buildGoogleAuthUrl({ redirectUri, state, codeChallenge, nonce });
    } else if (provider === 'microsoft') {
      authorizationUrl = buildMicrosoftAuthUrl({ redirectUri, state, codeChallenge, nonce });
    } else {
      throw new Error(`Unsupported PKCE provider: ${provider}`);
    }
  } else {
    if (provider === 'github') {
      authorizationUrl = buildGithubAuthUrl({ redirectUri, state });
    } else {
      throw new Error(`Unsupported non-PKCE provider: ${provider}`);
    }
  }

  return { authorizationUrl, cookiesToSet, nonce };
}

/**
 * Handles the OAuth authorization callback, verifies the identity,
 * resolves/creates the user in the database, establishes a session,
 * and issues a signed session cookie.
 */
export async function handleOAuthCallback(params: {
  provider: OAuthProvider;
  code?: string;
  state?: string;
  error?: string;
  errorDescription?: string;
  cookieState?: string;
  cookieVerifier?: string;
  req?: Request;
}): Promise<OAuthCallbackResult> {
  const {
    provider,
    code,
    state,
    error,
    errorDescription,
    cookieState,
    cookieVerifier,
    req,
  } = params;

  const cookiesToClear = ['smx_oauth_state', 'smx_oauth_verifier'];

  // 1. Check for provider-level callback errors or user cancellation
  if (error) {
    const message = errorDescription || error;
    throw new Error(`Authentication cancelled or denied by ${provider}: ${message}`);
  }

  if (!code) {
    throw new Error(`Authorization code was not returned by ${provider}`);
  }

  // 2. Validate state and anti-CSRF protection
  const stateCheck = verifyOAuthState(state, provider, cookieState);
  if (!stateCheck.valid || !stateCheck.payload) {
    throw new Error(stateCheck.error || 'Invalid or expired OAuth state');
  }

  const { returnUrl, nonce } = stateCheck.payload;
  const redirectUri = getCallbackUrl(provider, req);

  // 3. Exchange code for tokens and fetch verified user profile with OIDC validation
  let verifiedProfile: {
    providerUserId: string;
    email: string;
    name: string;
    avatarUrl?: string;
  };

  if (provider === 'google') {
    if (!cookieVerifier) {
      throw new Error('Missing PKCE code verifier for Google authentication');
    }
    const tokens = await exchangeGoogleCode({
      code,
      redirectUri,
      codeVerifier: cookieVerifier,
    });
    verifiedProfile = await fetchGoogleUserProfile(tokens, { expectedNonce: nonce });
  } else if (provider === 'github') {
    const tokens = await exchangeGithubCode({
      code,
      redirectUri,
    });
    verifiedProfile = await fetchGithubUserProfile(tokens);
  } else if (provider === 'microsoft') {
    if (!cookieVerifier) {
      throw new Error('Missing PKCE code verifier for Microsoft authentication');
    }
    const tokens = await exchangeMicrosoftCode({
      code,
      redirectUri,
      codeVerifier: cookieVerifier,
    });
    verifiedProfile = await fetchMicrosoftUserProfile(tokens, { expectedNonce: nonce });
  } else {
    throw new Error(`Unsupported OAuth provider: ${provider}`);
  }

  // 4. Resolve or register user in deviceStore
  const cleanEmail = verifiedProfile.email.toLowerCase().trim();
  let user = deviceStore.getUserByEmail(cleanEmail);

  if (user) {
    // Existing user account
    if (user.status === UserStatus.SUSPENDED || user.status === UserStatus.REVOKED) {
      throw new Error(`Unauthorized: User account is ${user.status}. Access denied.`);
    }

    // Record OAuth provider linking if not already present
    const userAny = user as any;
    if (!userAny.oauth_providers) {
      userAny.oauth_providers = {};
    }
    const wasAlreadyLinked = Boolean(userAny.oauth_providers[provider]);
    userAny.oauth_providers[provider] = {
      providerUserId: verifiedProfile.providerUserId,
      email: cleanEmail,
      linkedAt: new Date().toISOString(),
    };

    deviceStore.users.set(user.id, user);
    deviceStore.users.set(user.email, user);
    deviceStore.saveToDisk();

    if (!wasAlreadyLinked) {
      await deviceStore.recordAuditEvent({
        eventType: 'OAUTH_ACCOUNT_LINKED',
        description: `Verified ${provider} account (${cleanEmail}, id: ${verifiedProfile.providerUserId}) linked to existing user ${user.name}`,
        userEmail: user.email,
        userName: user.name,
        severity: 'INFO',
      });
    }

    storeEvents.emit('change', {
      type: 'USER_UPDATED',
      data: user,
      timestamp: Date.now(),
    });

    syncUserToSupabase(user).catch(() => {});

    // Role is preserved: existing assigned roles are authoritative and maintained
    await deviceStore.recordAuditEvent({
      eventType: 'USER_LOGIN_SUCCESS',
      description: `User ${user.name} (${user.email}) logged in via ${provider} OAuth`,
      userEmail: user.email,
      userName: user.name,
      severity: 'INFO',
    });
  } else {
    // New user registration via verified OAuth identity
    // Enforce role security: new self-registered OAuth users CANNOT self-escalate to ADMIN or AUDITOR!
    const newUserId = 'usr_' + crypto.randomUUID().slice(0, 8);
    const did = `did:securemax:user:${newUserId.slice(-6)}`;

    const newUser: StoredUser = {
      id: newUserId,
      name: verifiedProfile.name || cleanEmail.split('@')[0],
      email: cleanEmail,
      role: UserRole.USER, // Member role (zero self-escalation)
      position_id: 'pos_user',
      position: 'User',
      kyc_status: 'VERIFIED', // Verified through federated IdP
      status: UserStatus.ACTIVE,
      did,
      created_at: new Date().toISOString(),
    };

    (newUser as any).oauth_providers = {
      [provider]: {
        providerUserId: verifiedProfile.providerUserId,
        email: cleanEmail,
        linkedAt: new Date().toISOString(),
      },
    };

    deviceStore.users.set(newUser.id, newUser);
    deviceStore.users.set(newUser.email, newUser);
    deviceStore.saveToDisk();

    storeEvents.emit('change', {
      type: 'USER_REGISTERED',
      data: newUser,
      timestamp: Date.now(),
    });

    syncUserToSupabase(newUser).catch(() => {});

    await deviceStore.recordAuditEvent({
      eventType: 'IDENTITY_CREATED',
      description: `New user account created via verified ${provider} OAuth: ${newUser.name} (${cleanEmail})`,
      targetId: newUser.id,
      userEmail: newUser.email,
      userName: newUser.name,
      severity: 'INFO',
    });

    user = newUser;
  }

  // 5. Ensure an active device record exists for this user in deviceStore
  const userDevices = deviceStore.getDevicesForUser(user.id);
  let activeDevice = userDevices.find(d => d.status === 'ACTIVE');

  if (!activeDevice) {
    const providerLabel = provider.charAt(0).toUpperCase() + provider.slice(1);
    activeDevice = deviceStore.registerDevice({
      userId: user.id,
      deviceName: `${providerLabel} Verified Session`,
      publicKey: `oauth_${provider}_${crypto.randomUUID().slice(0, 8)}`,
      isAdminDevice: false,
    });
  }

  // 6. Establish a zero-trust stateful session in deviceStore
  const session = deviceStore.createSession({
    userId: user.id,
    deviceId: activeDevice.id,
    authLevel: 'PASSKEY',
    durationHours: 8,
  });

  deviceStore.recordLogin({
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    role: user.role,
    deviceName: activeDevice.device_name,
    status: 'SUCCESS',
  });

  // 7. Issue signed SecureMAX 8-hour session token
  const jwtSecret = getJwtSecret();
  const assuranceLevel = user.role === UserRole.ADMIN ? 'LEVEL_3' : 'LEVEL_2';
  const sessionToken = await new SignJWT({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    did: user.did,
    deviceId: activeDevice.id,
    deviceName: activeDevice.device_name,
    sessionId: session.session_id,
    assuranceLevel,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(jwtSecret);

  // 8. Determine safe redirect destination based on role and returnUrl
  let finalRedirect = sanitizeReturnUrl(returnUrl);

  // Strict role boundaries on destination:
  // Non-admins must never be redirected to /dashboard/admin
  if (user.role !== UserRole.ADMIN && finalRedirect.startsWith('/dashboard/admin')) {
    finalRedirect = '/dashboard';
  }
  // Non-auditors must never be redirected to /dashboard/auditor
  if (user.role !== UserRole.AUDITOR && finalRedirect.startsWith('/dashboard/auditor')) {
    finalRedirect = '/dashboard';
  }

  // Default redirects based on role
  if (finalRedirect === '/dashboard' || finalRedirect === '/') {
    if (user.role === UserRole.ADMIN) {
      finalRedirect = '/dashboard/admin';
    } else if (user.role === UserRole.AUDITOR) {
      finalRedirect = '/dashboard/auditor';
    } else {
      finalRedirect = '/dashboard';
    }
  }

  return {
    sessionToken,
    redirectUrl: finalRedirect,
    user,
    cookiesToClear,
  };
}
