import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('server-only', () => ({}));

import { cookies } from 'next/headers';
import { GET as oauthInit } from '../../src/app/api/auth/oauth/[provider]/route';
import { GET as oauthCallback } from '../../src/app/api/auth/callback/[provider]/route';
import { GET as getProviders } from '../../src/app/api/auth/providers/route';
import { POST as logoutApi } from '../../src/app/api/auth/logout/route';
import { deviceStore } from '../../src/lib/auth/deviceStore';
import { getVerifiedSession } from '../../src/lib/auth/session';
import { generateCodeVerifier, generateCodeChallenge } from '../../src/lib/auth/oauth/pkce';
import { generateOAuthState, verifyOAuthState, sanitizeReturnUrl } from '../../src/lib/auth/oauth/state';
import { UserRole, UserStatus } from '../../src/types';

// Mock Next.js cookies
vi.mock('next/headers', () => {
  const store = new Map<string, any>();
  return {
    cookies: vi.fn(() => ({
      get: vi.fn((key: string) => store.get(key)),
      set: vi.fn((key: string, val: string, options: any) => store.set(key, { value: val, ...options })),
      delete: vi.fn((key: string) => store.delete(key)),
      _store: store,
    })),
  };
});

describe('SecureMAX Real OAuth / OIDC Authentication Suite (Google, GitHub, Microsoft)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    const cookieStore = (cookies() as any)._store;
    cookieStore.clear();

    // Reset store and seed test users (admin@securemax.mil, vasu@securemax.mil, auditor@securemax.mil)
    deviceStore.seedTestDataForTesting(true);

    // Default test OAuth credentials
    process.env.APP_BASE_URL = 'http://localhost:3000';
    process.env.JWT_SECRET = 'securemax-dev-jwt-secret-minimum-32-chars-long-secure-padding';
    process.env.GOOGLE_CLIENT_ID = 'test-google-client-id.apps.googleusercontent.com';
    process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';
    process.env.GITHUB_CLIENT_ID = 'test-github-client-id';
    process.env.GITHUB_CLIENT_SECRET = 'test-github-client-secret';
    process.env.MICROSOFT_CLIENT_ID = 'test-microsoft-client-id';
    process.env.MICROSOFT_CLIENT_SECRET = 'test-microsoft-client-secret';
    process.env.MICROSOFT_TENANT_ID = 'common';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. PROVIDER CONFIGURATION & STATUS ENDPOINT
  // =========================================================================
  describe('1. Provider Configuration & Providers Status API', () => {
    it('reports configured providers correctly when environment variables are set', async () => {
      const res = await getProviders();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.google.configured).toBe(true);
      expect(data.github.configured).toBe(true);
      expect(data.microsoft.configured).toBe(true);
      expect(data.google.supportsPkce).toBe(true);
      expect(data.github.supportsPkce).toBe(false);
      expect(data.microsoft.supportsPkce).toBe(true);
    });

    it('reports unconfigured status when credentials are missing', async () => {
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_SECRET;

      const res = await getProviders();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.google.configured).toBe(false);
      expect(data.github.configured).toBe(true);
    });

    it('fails gracefully with actionable error when initiating unconfigured provider', async () => {
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_SECRET;

      const req = new Request('http://localhost:3000/api/auth/oauth/google?json=1', {
        headers: { Accept: 'application/json' },
      });
      const res = await oauthInit(req, { params: { provider: 'google' } });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Google OAuth is not configured');
    });

    it('rejects unsupported provider parameter', async () => {
      const req = new Request('http://localhost:3000/api/auth/oauth/unsupported_idp?json=1', {
        headers: { Accept: 'application/json' },
      });
      const res = await oauthInit(req, { params: { provider: 'unsupported_idp' } });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Unsupported OAuth provider');
    });
  });

  // =========================================================================
  // 2. PKCE & TAMPER-PROOF STATE VALIDATION
  // =========================================================================
  describe('2. PKCE and CSRF State Security', () => {
    it('generates valid RFC 7636 PKCE code_verifier and S256 code_challenge', () => {
      const verifier = generateCodeVerifier();
      expect(verifier).toBeDefined();
      expect(verifier.length).toBeGreaterThanOrEqual(43);

      const challenge1 = generateCodeChallenge(verifier);
      const challenge2 = generateCodeChallenge(verifier);
      expect(challenge1).toBe(challenge2);
      expect(challenge1).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('generates tamper-proof state and validates anti-CSRF cookie bindings', () => {
      const { state, cookieValue } = generateOAuthState('google', '/dashboard/admin');
      expect(state).toBeDefined();
      expect(cookieValue).toMatch(/^google:[A-Za-z0-9_-]+$/);

      const check = verifyOAuthState(state, 'google', cookieValue);
      expect(check.valid).toBe(true);
      expect(check.payload?.provider).toBe('google');
      expect(check.payload?.returnUrl).toBe('/dashboard/admin');
    });

    it('fails state verification if state signature is tampered', () => {
      const { state, cookieValue } = generateOAuthState('google');
      // Tamper state
      const tampered = state.slice(0, -4) + 'AAAA';
      const check = verifyOAuthState(tampered, 'google', cookieValue);
      expect(check.valid).toBe(false);
      expect(check.error).toMatch(/signature verification failed|Invalid or malformed OAuth state/);
    });

    it('fails state verification if provider in callback does not match provider in state', () => {
      const { state, cookieValue } = generateOAuthState('google');
      const check = verifyOAuthState(state, 'github', cookieValue);
      expect(check.valid).toBe(false);
      expect(check.error).toContain('mismatch');
    });

    it('fails state verification if CSRF cookie is missing or mismatched', () => {
      const { state } = generateOAuthState('google');
      const check = verifyOAuthState(state, 'google', 'google:wrong-nonce');
      expect(check.valid).toBe(false);
      expect(check.error).toContain('mismatch');
    });
  });

  // =========================================================================
  // 3. OAUTH INITIATION (GOOGLE, GITHUB, MICROSOFT)
  // =========================================================================
  describe('3. Real Authorization Initiation', () => {
    it('initiates Google OAuth with PKCE S256 challenge, state, and scopes', async () => {
      const req = new Request('http://localhost:3000/api/auth/oauth/google?json=1', {
        headers: { Accept: 'application/json' },
      });
      const res = await oauthInit(req, { params: { provider: 'google' } });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(data.url).toContain('code_challenge=');
      expect(data.url).toContain('code_challenge_method=S256');
      expect(data.url).toContain('scope=openid+email+profile');
      expect(data.url).toContain('state=');

      // Verify cookies set in response
      const stateCookie = res.cookies.get('smx_oauth_state');
      const verifierCookie = res.cookies.get('smx_oauth_verifier');
      expect(stateCookie).toBeDefined();
      expect(verifierCookie).toBeDefined();
      expect(stateCookie?.value).toContain('google:');
    });

    it('initiates GitHub OAuth with state and email scope', async () => {
      const req = new Request('http://localhost:3000/api/auth/oauth/github?json=1', {
        headers: { Accept: 'application/json' },
      });
      const res = await oauthInit(req, { params: { provider: 'github' } });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.url).toContain('https://github.com/login/oauth/authorize');
      expect(data.url).toContain('scope=read%3Auser+user%3Aemail');
      expect(data.url).toContain('state=');
      expect(res.cookies.get('smx_oauth_state')?.value).toContain('github:');
    });

    it('initiates Microsoft OAuth with PKCE S256, User.Read scope, and prompt=select_account', async () => {
      const req = new Request('http://localhost:3000/api/auth/oauth/microsoft?json=1', {
        headers: { Accept: 'application/json' },
      });
      const res = await oauthInit(req, { params: { provider: 'microsoft' } });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.url).toContain('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
      expect(data.url).toContain('code_challenge=');
      expect(data.url).toContain('prompt=select_account');
      expect(data.url).toContain('User.Read');
    });

    it('redirects directly (302) when accessed via standard browser navigation', async () => {
      const req = new Request('http://localhost:3000/api/auth/oauth/google', {
        headers: { Accept: 'text/html,application/xhtml+xml' },
      });
      const res = await oauthInit(req, { params: { provider: 'google' } });
      expect(res.status).toBe(307); // NextResponse.redirect defaults to 307
      expect(res.headers.get('location')).toContain('https://accounts.google.com/o/oauth2/v2/auth');
    });
  });

  // =========================================================================
  // 4. CALLBACK ERROR HANDLING & CONSENT DENIAL
  // =========================================================================
  describe('4. Callback Error Handling & Consent Denial', () => {
    it('redirects to login with clear message when user cancels or provider denies consent', async () => {
      const req = new Request('http://localhost:3000/api/auth/callback/google?error=access_denied&error_description=User+declined+authorization');
      const res = await oauthCallback(req, { params: { provider: 'google' } });
      expect(res.status).toBe(307);
      const location = decodeURIComponent(res.headers.get('location') || '');
      expect(location).toContain('/login?error=');
      expect(location).toContain('User declined authorization');
    });

    it('redirects to login when authorization code is missing', async () => {
      const req = new Request('http://localhost:3000/api/auth/callback/google');
      const res = await oauthCallback(req, { params: { provider: 'google' } });
      expect(res.status).toBe(307);
      const location = res.headers.get('location') || '';
      expect(location).toContain('/login?error=');
      expect(location).toContain('code');
    });

    it('redirects to login when state is missing or invalid (CSRF attack prevented)', async () => {
      const req = new Request('http://localhost:3000/api/auth/callback/google?code=fake_code_123&state=invalid_tampered_state');
      const res = await oauthCallback(req, { params: { provider: 'google' } });
      expect(res.status).toBe(307);
      const location = res.headers.get('location') || '';
      expect(location).toContain('/login?error=');
      expect(location).toMatch(/OAuth\+state|CSRF/);
    });
  });

  // =========================================================================
  // 5. GOOGLE OAUTH FLOW END-TO-END
  // =========================================================================
  describe('5. Google OAuth Flow End-to-End', () => {
    it('successfully authenticates a new user via Google, creates member record, and establishes session', async () => {
      // 1. Initiate OAuth
      const initReq = new Request('http://localhost:3000/api/auth/oauth/google?json=1', {
        headers: { Accept: 'application/json' },
      });
      const initRes = await oauthInit(initReq, { params: { provider: 'google' } });
      const { url } = await initRes.json();
      const stateParam = new URL(url).searchParams.get('state')!;
      const stateCookie = initRes.cookies.get('smx_oauth_state')!.value;
      const verifierCookie = initRes.cookies.get('smx_oauth_verifier')!.value;

      // Mock cookies in next/headers
      const cookieMap = (cookies() as any)._store;
      cookieMap.set('smx_oauth_state', { value: stateCookie });
      cookieMap.set('smx_oauth_verifier', { value: verifierCookie });

      // 2. Mock Google Token Endpoint & UserInfo Endpoint
      const mockFetch = vi.fn(async (input: any, init?: any) => {
        const urlStr = String(input);
        if (urlStr === 'https://oauth2.googleapis.com/token') {
          return new Response(JSON.stringify({
            access_token: 'mock_google_access_token_123',
            token_type: 'Bearer',
            expires_in: 3600,
            id_token: 'mock_id_token',
          }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        if (urlStr === 'https://openidconnect.googleapis.com/v1/userinfo') {
          return new Response(JSON.stringify({
            sub: 'google_user_sub_9999',
            name: 'Priya Sharma',
            email: 'priya.sharma@cyberdefense.in',
            email_verified: true,
            picture: 'https://lh3.googleusercontent.com/photo.jpg',
          }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        return new Response('Not Found', { status: 404 });
      });
      vi.stubGlobal('fetch', mockFetch);

      // 3. Execute Callback
      const callbackReq = new Request(`http://localhost:3000/api/auth/callback/google?code=mock_google_code_xyz&state=${stateParam}`);
      const callbackRes = await oauthCallback(callbackReq, { params: { provider: 'google' } });

      expect(callbackRes.status).toBe(307);
      expect(callbackRes.headers.get('location')).toBe('http://localhost:3000/dashboard');

      // 4. Verify session cookie was set
      const sessionCookie = callbackRes.cookies.get('securemesh_session');
      expect(sessionCookie).toBeDefined();
      expect(sessionCookie?.value).toBeDefined();

      // Set cookie in mock store to test verification
      cookieMap.set('securemesh_session', { value: sessionCookie!.value });

      // 5. Verify user created in deviceStore with Member (USER) role
      const newUser = deviceStore.getUserByEmail('priya.sharma@cyberdefense.in')!;
      expect(newUser).toBeDefined();
      expect(newUser.name).toBe('Priya Sharma');
      expect(newUser.role).toBe(UserRole.USER); // Zero privilege escalation
      expect(newUser.kyc_status).toBe('VERIFIED');
      expect(newUser.status).toBe(UserStatus.ACTIVE);

      // 6. Test session validation
      const verifiedSession = await getVerifiedSession();
      expect(verifiedSession.userId).toBe(newUser.id);
      expect(verifiedSession.email).toBe(newUser.email);
      expect(verifiedSession.role).toBe(UserRole.USER);
    });

    it('rejects Google account if email_verified is false', async () => {
      const initReq = new Request('http://localhost:3000/api/auth/oauth/google?json=1', {
        headers: { Accept: 'application/json' },
      });
      const initRes = await oauthInit(initReq, { params: { provider: 'google' } });
      const { url } = await initRes.json();
      const stateParam = new URL(url).searchParams.get('state')!;
      const stateCookie = initRes.cookies.get('smx_oauth_state')!.value;
      const verifierCookie = initRes.cookies.get('smx_oauth_verifier')!.value;

      const cookieMap = (cookies() as any)._store;
      cookieMap.set('smx_oauth_state', { value: stateCookie });
      cookieMap.set('smx_oauth_verifier', { value: verifierCookie });

      const mockFetch = vi.fn(async (input: any) => {
        const urlStr = String(input);
        if (urlStr === 'https://oauth2.googleapis.com/token') {
          return new Response(JSON.stringify({ access_token: 'token_abc', token_type: 'Bearer', expires_in: 3600 }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        if (urlStr === 'https://openidconnect.googleapis.com/v1/userinfo') {
          return new Response(JSON.stringify({
            sub: 'unverified_sub',
            name: 'Unverified User',
            email: 'unverified@gmail.com',
            email_verified: false, // UNVERIFIED!
          }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        return new Response('Not Found', { status: 404 });
      });
      vi.stubGlobal('fetch', mockFetch);

      const callbackReq = new Request(`http://localhost:3000/api/auth/callback/google?code=code_123&state=${stateParam}`);
      const callbackRes = await oauthCallback(callbackReq, { params: { provider: 'google' } });

      expect(callbackRes.status).toBe(307);
      const loc = decodeURIComponent(callbackRes.headers.get('location') || '');
      expect(loc).toContain('/login?error=');
      expect(loc).toContain('not verified');
    });
  });

  // =========================================================================
  // 6. GITHUB OAUTH FLOW END-TO-END & ACCOUNT LINKING
  // =========================================================================
  describe('6. GitHub OAuth Flow End-to-End & Safe Account Linking', () => {
    it('successfully links to existing user (Vasu) and preserves existing role', async () => {
      // Vasu already exists as UserRole.USER with assignments in seed data
      const existingVasu = deviceStore.getUserByEmail('vasu@securemax.mil')!;
      expect(existingVasu).toBeDefined();
      const originalRole = existingVasu.role;

      // 1. Initiate GitHub OAuth
      const initReq = new Request('http://localhost:3000/api/auth/oauth/github?json=1', {
        headers: { Accept: 'application/json' },
      });
      const initRes = await oauthInit(initReq, { params: { provider: 'github' } });
      const { url } = await initRes.json();
      const stateParam = new URL(url).searchParams.get('state')!;
      const stateCookie = initRes.cookies.get('smx_oauth_state')!.value;

      const cookieMap = (cookies() as any)._store;
      cookieMap.set('smx_oauth_state', { value: stateCookie });

      // 2. Mock GitHub endpoints
      const mockFetch = vi.fn(async (input: any) => {
        const urlStr = String(input);
        if (urlStr === 'https://github.com/login/oauth/access_token') {
          return new Response(JSON.stringify({
            access_token: 'mock_gh_token_777',
            token_type: 'bearer',
            scope: 'read:user,user:email',
          }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        if (urlStr === 'https://api.github.com/user') {
          return new Response(JSON.stringify({
            id: 882194,
            login: 'vasu-cyber',
            name: 'Vasu Gupta',
            email: 'vasu@securemax.mil',
          }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        if (urlStr === 'https://api.github.com/user/emails') {
          return new Response(JSON.stringify([
            { email: 'vasu.personal@example.com', primary: false, verified: true },
            { email: 'vasu@securemax.mil', primary: true, verified: true },
          ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        return new Response('Not Found', { status: 404 });
      });
      vi.stubGlobal('fetch', mockFetch);

      // 3. Execute Callback
      const callbackReq = new Request(`http://localhost:3000/api/auth/callback/github?code=gh_code_888&state=${stateParam}`);
      const callbackRes = await oauthCallback(callbackReq, { params: { provider: 'github' } });

      expect(callbackRes.status).toBe(307);
      expect(callbackRes.headers.get('location')).toBe('http://localhost:3000/dashboard');

      // 4. Verify existing account was linked and role preserved
      const userAfterLogin = deviceStore.getUserByEmail('vasu@securemax.mil')!;
      expect(userAfterLogin.id).toBe(existingVasu.id);
      expect(userAfterLogin.role).toBe(originalRole);

      // 5. Verify session works
      const sessionCookie = callbackRes.cookies.get('securemesh_session')!.value;
      cookieMap.set('securemesh_session', { value: sessionCookie });
      const session = await getVerifiedSession();
      expect(session.userId).toBe(existingVasu.id);
      expect(session.email).toBe('vasu@securemax.mil');
    });

    it('rejects GitHub login if user has no verified email', async () => {
      const initReq = new Request('http://localhost:3000/api/auth/oauth/github?json=1', {
        headers: { Accept: 'application/json' },
      });
      const initRes = await oauthInit(initReq, { params: { provider: 'github' } });
      const { url } = await initRes.json();
      const stateParam = new URL(url).searchParams.get('state')!;
      const stateCookie = initRes.cookies.get('smx_oauth_state')!.value;

      const cookieMap = (cookies() as any)._store;
      cookieMap.set('smx_oauth_state', { value: stateCookie });

      const mockFetch = vi.fn(async (input: any) => {
        const urlStr = String(input);
        if (urlStr === 'https://github.com/login/oauth/access_token') {
          return new Response(JSON.stringify({ access_token: 'gh_tok', token_type: 'bearer' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        if (urlStr === 'https://api.github.com/user') {
          return new Response(JSON.stringify({ id: 111, login: 'spammer', email: null }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        if (urlStr === 'https://api.github.com/user/emails') {
          return new Response(JSON.stringify([
            { email: 'fake@spammer.net', primary: true, verified: false }, // UNVERIFIED!
          ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        return new Response('Not Found', { status: 404 });
      });
      vi.stubGlobal('fetch', mockFetch);

      const callbackReq = new Request(`http://localhost:3000/api/auth/callback/github?code=gh_bad_code&state=${stateParam}`);
      const callbackRes = await oauthCallback(callbackReq, { params: { provider: 'github' } });

      expect(callbackRes.status).toBe(307);
      const loc = decodeURIComponent(callbackRes.headers.get('location') || '');
      expect(loc).toContain('/login?error=');
      expect(loc).toContain('verified email');
    });
  });

  // =========================================================================
  // 7. MICROSOFT ENTRA ID FLOW END-TO-END
  // =========================================================================
  describe('7. Microsoft Entra ID Flow End-to-End', () => {
    it('authenticates Microsoft user, creates session, and redirects to dashboard', async () => {
      // 1. Initiate Microsoft OAuth
      const initReq = new Request('http://localhost:3000/api/auth/oauth/microsoft?json=1', {
        headers: { Accept: 'application/json' },
      });
      const initRes = await oauthInit(initReq, { params: { provider: 'microsoft' } });
      const { url } = await initRes.json();
      const stateParam = new URL(url).searchParams.get('state')!;
      const stateCookie = initRes.cookies.get('smx_oauth_state')!.value;
      const verifierCookie = initRes.cookies.get('smx_oauth_verifier')!.value;

      const cookieMap = (cookies() as any)._store;
      cookieMap.set('smx_oauth_state', { value: stateCookie });
      cookieMap.set('smx_oauth_verifier', { value: verifierCookie });

      // 2. Mock Microsoft Token Endpoint & Graph API
      const mockFetch = vi.fn(async (input: any) => {
        const urlStr = String(input);
        if (urlStr.includes('/oauth2/v2.0/token')) {
          return new Response(JSON.stringify({
            access_token: 'mock_ms_token_999',
            token_type: 'Bearer',
            expires_in: 3600,
          }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        if (urlStr === 'https://graph.microsoft.com/v1.0/me') {
          return new Response(JSON.stringify({
            id: 'ms-guid-00123-45678',
            displayName: 'Rohan Verma',
            mail: 'rohan.verma@defensecorp.microsoft.com',
            userPrincipalName: 'rohan.verma@defensecorp.microsoft.com',
          }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        return new Response('Not Found', { status: 404 });
      });
      vi.stubGlobal('fetch', mockFetch);

      // 3. Execute Callback
      const callbackReq = new Request(`http://localhost:3000/api/auth/callback/microsoft?code=ms_auth_code_11&state=${stateParam}`);
      const callbackRes = await oauthCallback(callbackReq, { params: { provider: 'microsoft' } });

      expect(callbackRes.status).toBe(307);
      expect(callbackRes.headers.get('location')).toBe('http://localhost:3000/dashboard');

      const sessionCookie = callbackRes.cookies.get('securemesh_session');
      expect(sessionCookie).toBeDefined();

      // 4. Verify user in store
      const user = deviceStore.getUserByEmail('rohan.verma@defensecorp.microsoft.com')!;
      expect(user).toBeDefined();
      expect(user.name).toBe('Rohan Verma');
      expect(user.role).toBe(UserRole.USER);
    });
  });

  // =========================================================================
  // 8. PRIVILEGE ESCALATION PREVENTION & ROLE ENFORCEMENT
  // =========================================================================
  describe('8. Privilege Escalation Prevention & Role Enforcement', () => {
    it('strictly forces new OAuth user role to USER (MEMBER) regardless of claims', async () => {
      const initReq = new Request('http://localhost:3000/api/auth/oauth/google?json=1', {
        headers: { Accept: 'application/json' },
      });
      const initRes = await oauthInit(initReq, { params: { provider: 'google' } });
      const { url } = await initRes.json();
      const stateParam = new URL(url).searchParams.get('state')!;
      const stateCookie = initRes.cookies.get('smx_oauth_state')!.value;
      const verifierCookie = initRes.cookies.get('smx_oauth_verifier')!.value;

      const cookieMap = (cookies() as any)._store;
      cookieMap.set('smx_oauth_state', { value: stateCookie });
      cookieMap.set('smx_oauth_verifier', { value: verifierCookie });

      const mockFetch = vi.fn(async (input: any) => {
        const urlStr = String(input);
        if (urlStr === 'https://oauth2.googleapis.com/token') {
          return new Response(JSON.stringify({ access_token: 'tok_test', token_type: 'Bearer', expires_in: 3600 }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        if (urlStr === 'https://openidconnect.googleapis.com/v1/userinfo') {
          return new Response(JSON.stringify({
            sub: 'attacker_sub',
            name: 'Attacker Attempting Escalation',
            email: 'attacker@example.org',
            email_verified: true,
            // Attacker includes fake role claim
            role: 'ADMIN',
          }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        return new Response('Not Found', { status: 404 });
      });
      vi.stubGlobal('fetch', mockFetch);

      const callbackReq = new Request(`http://localhost:3000/api/auth/callback/google?code=code_atk&state=${stateParam}`);
      await oauthCallback(callbackReq, { params: { provider: 'google' } });

      const user = deviceStore.getUserByEmail('attacker@example.org')!;
      expect(user.role).toBe(UserRole.USER);
      expect(user.role).not.toBe(UserRole.ADMIN);
    });

    it('blocks OAuth login if matching user account is SUSPENDED or REVOKED', async () => {
      // Suspend Vasu
      deviceStore.suspendUser('usr_vasu_002');
      const suspendedVasu = deviceStore.getUserByEmail('vasu@securemax.mil')!;
      expect(suspendedVasu.status).toBe(UserStatus.SUSPENDED);

      const initReq = new Request('http://localhost:3000/api/auth/oauth/github?json=1', {
        headers: { Accept: 'application/json' },
      });
      const initRes = await oauthInit(initReq, { params: { provider: 'github' } });
      const { url } = await initRes.json();
      const stateParam = new URL(url).searchParams.get('state')!;
      const stateCookie = initRes.cookies.get('smx_oauth_state')!.value;

      const cookieMap = (cookies() as any)._store;
      cookieMap.set('smx_oauth_state', { value: stateCookie });

      const mockFetch = vi.fn(async (input: any) => {
        const urlStr = String(input);
        if (urlStr === 'https://github.com/login/oauth/access_token') {
          return new Response(JSON.stringify({ access_token: 'gh_tok_sus', token_type: 'bearer' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        if (urlStr === 'https://api.github.com/user') {
          return new Response(JSON.stringify({ id: 999, login: 'vasu', email: 'vasu@securemax.mil' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        if (urlStr === 'https://api.github.com/user/emails') {
          return new Response(JSON.stringify([{ email: 'vasu@securemax.mil', primary: true, verified: true }]), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        return new Response('Not Found', { status: 404 });
      });
      vi.stubGlobal('fetch', mockFetch);

      const callbackReq = new Request(`http://localhost:3000/api/auth/callback/github?code=code_sus&state=${stateParam}`);
      const callbackRes = await oauthCallback(callbackReq, { params: { provider: 'github' } });

      expect(callbackRes.status).toBe(307);
      const loc = callbackRes.headers.get('location') || '';
      expect(loc).toContain('/login?error=');
      expect(loc).toContain('SUSPENDED');
    });
  });

  // =========================================================================
  // 9. SESSION REVOCATION & LOGOUT
  // =========================================================================
  describe('9. Session Persistence & Logout Revocation', () => {
    it('revokes OAuth stateful session upon calling logout API', async () => {
      // 1. Authenticate user
      const user = deviceStore.getUserByEmail('vasu@securemax.mil')!;
      const device = deviceStore.registerDevice({
        userId: user.id,
        deviceName: 'OAuth Test Session',
        publicKey: 'oauth_key_123',
        isAdminDevice: false,
      });
      const session = deviceStore.createSession({
        userId: user.id,
        deviceId: device.id,
        durationHours: 8,
      });

      const { SignJWT } = await import('jose');
      const { getJwtSecret } = await import('../../src/lib/auth/session');
      const token = await new SignJWT({
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        sessionId: session.session_id,
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('8h')
        .sign(getJwtSecret());

      const cookieMap = (cookies() as any)._store;
      cookieMap.set('securemesh_session', { value: token });

      // Session verifies
      const activeSession = await getVerifiedSession();
      expect(activeSession.sessionId).toBe(session.session_id);

      // 2. Call Logout
      const logoutRes = await logoutApi();
      expect(logoutRes.status).toBe(200);

      // Session marked REVOKED in store
      const stored = deviceStore.getSession(session.session_id);
      expect(stored?.status).toBe('REVOKED');

      // Next session verification rejects because cookie was cleared
      await expect(getVerifiedSession()).rejects.toThrow(/No active SecureMAX session/);

      // Even if an attacker attempts to replay the old revoked session token, zero-trust live check rejects it!
      cookieMap.set('securemesh_session', { value: token });
      await expect(getVerifiedSession()).rejects.toThrow(/REVOKED/);
    });
  });

  // =========================================================================
  // 10. OIDC ID TOKEN CRYPTOGRAPHIC & CLAIMS VALIDATION
  // =========================================================================
  describe('10. OIDC ID Token Verification (RFC 7519 / OIDC Core 1.0)', () => {
    it('verifies a valid OIDC ID token with correct audience, issuer, expiry, and nonce', async () => {
      const { verifyOidcIdToken } = await import('../../src/lib/auth/oauth/oidc');
      const { SignJWT } = await import('jose');

      const dummyKey = new TextEncoder().encode('dummy-test-key-minimum-32-chars-long!');
      const nowSec = Math.floor(Date.now() / 1000);

      const validToken = await new SignJWT({
        sub: 'google_user_12345',
        email: 'alice@defense.gov',
        email_verified: true,
        nonce: 'test-nonce-secure-value',
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuer('https://accounts.google.com')
        .setAudience('test-google-client-id.apps.googleusercontent.com')
        .setIssuedAt(nowSec)
        .setExpirationTime(nowSec + 3600)
        .sign(dummyKey);

      const claims = verifyOidcIdToken(validToken, {
        expectedAudience: 'test-google-client-id.apps.googleusercontent.com',
        expectedNonce: 'test-nonce-secure-value',
        provider: 'google',
      });

      expect(claims).toBeDefined();
      expect(claims?.sub).toBe('google_user_12345');
      expect(claims?.email).toBe('alice@defense.gov');
      expect(claims?.nonce).toBe('test-nonce-secure-value');
    });

    it('rejects expired OIDC ID token', async () => {
      const { verifyOidcIdToken } = await import('../../src/lib/auth/oauth/oidc');
      const { SignJWT } = await import('jose');

      const dummyKey = new TextEncoder().encode('dummy-test-key-minimum-32-chars-long!');
      const expiredSec = Math.floor(Date.now() / 1000) - 300; // 5 minutes ago

      const expiredToken = await new SignJWT({
        sub: 'google_user_12345',
        email: 'alice@defense.gov',
        nonce: 'test-nonce',
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuer('https://accounts.google.com')
        .setAudience('test-google-client-id.apps.googleusercontent.com')
        .setIssuedAt(expiredSec - 3600)
        .setExpirationTime(expiredSec)
        .sign(dummyKey);

      expect(() =>
        verifyOidcIdToken(expiredToken, {
          expectedAudience: 'test-google-client-id.apps.googleusercontent.com',
          expectedNonce: 'test-nonce',
          provider: 'google',
        })
      ).toThrow(/expired/);
    });

    it('rejects OIDC ID token with audience mismatch (confused deputy attack)', async () => {
      const { verifyOidcIdToken } = await import('../../src/lib/auth/oauth/oidc');
      const { SignJWT } = await import('jose');

      const dummyKey = new TextEncoder().encode('dummy-test-key-minimum-32-chars-long!');
      const nowSec = Math.floor(Date.now() / 1000);

      const foreignToken = await new SignJWT({
        sub: 'google_user_12345',
        email: 'alice@defense.gov',
        nonce: 'test-nonce',
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuer('https://accounts.google.com')
        .setAudience('malicious-client-app-id.apps.googleusercontent.com')
        .setIssuedAt(nowSec)
        .setExpirationTime(nowSec + 3600)
        .sign(dummyKey);

      expect(() =>
        verifyOidcIdToken(foreignToken, {
          expectedAudience: 'test-google-client-id.apps.googleusercontent.com',
          expectedNonce: 'test-nonce',
          provider: 'google',
        })
      ).toThrow(/audience mismatch/);
    });

    it('rejects OIDC ID token with nonce mismatch (replay attack)', async () => {
      const { verifyOidcIdToken } = await import('../../src/lib/auth/oauth/oidc');
      const { SignJWT } = await import('jose');

      const dummyKey = new TextEncoder().encode('dummy-test-key-minimum-32-chars-long!');
      const nowSec = Math.floor(Date.now() / 1000);

      const replayedToken = await new SignJWT({
        sub: 'google_user_12345',
        email: 'alice@defense.gov',
        nonce: 'old-consumed-nonce-999',
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuer('https://accounts.google.com')
        .setAudience('test-google-client-id.apps.googleusercontent.com')
        .setIssuedAt(nowSec)
        .setExpirationTime(nowSec + 3600)
        .sign(dummyKey);

      expect(() =>
        verifyOidcIdToken(replayedToken, {
          expectedAudience: 'test-google-client-id.apps.googleusercontent.com',
          expectedNonce: 'current-expected-nonce-000',
          provider: 'google',
        })
      ).toThrow(/nonce mismatch/);
    });

    it('rejects OIDC ID token with invalid issuer', async () => {
      const { verifyOidcIdToken } = await import('../../src/lib/auth/oauth/oidc');
      const { SignJWT } = await import('jose');

      const dummyKey = new TextEncoder().encode('dummy-test-key-minimum-32-chars-long!');
      const nowSec = Math.floor(Date.now() / 1000);

      const rogueIssuerToken = await new SignJWT({
        sub: 'rogue_user_12345',
        email: 'attacker@evil.com',
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuer('https://rogue-idp.attacker.com')
        .setAudience('test-google-client-id.apps.googleusercontent.com')
        .setIssuedAt(nowSec)
        .setExpirationTime(nowSec + 3600)
        .sign(dummyKey);

      expect(() =>
        verifyOidcIdToken(rogueIssuerToken, {
          expectedAudience: 'test-google-client-id.apps.googleusercontent.com',
          provider: 'google',
        })
      ).toThrow(/issuer mismatch/);
    });
  });

  // =========================================================================
  // 11. STRICT EMAIL OWNERSHIP & UNVERIFIED PROFILE EXPLOIT PREVENTION
  // =========================================================================
  describe('11. Strict Email Ownership & Unverified Profile Exploit Prevention', () => {
    it('STRICTLY rejects GitHub login when public profile email matches victim but user:email is unverified', async () => {
      // Attacker has set public profile email to victim 'vasu@securemax.mil', but their GitHub email is unverified
      const initReq = new Request('http://localhost:3000/api/auth/oauth/github?json=1', {
        headers: { Accept: 'application/json' },
      });
      const initRes = await oauthInit(initReq, { params: { provider: 'github' } });
      const { url } = await initRes.json();
      const stateParam = new URL(url).searchParams.get('state')!;
      const stateCookie = initRes.cookies.get('smx_oauth_state')!.value;

      const cookieMap = (cookies() as any)._store;
      cookieMap.set('smx_oauth_state', { value: stateCookie });

      const mockFetch = vi.fn(async (input: any) => {
        const urlStr = String(input);
        if (urlStr === 'https://github.com/login/oauth/access_token') {
          return new Response(JSON.stringify({ access_token: 'gh_exploit_tok', token_type: 'bearer' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (urlStr === 'https://api.github.com/user') {
          return new Response(
            JSON.stringify({
              id: 999999,
              login: 'attacker-account',
              // Attacker sets public email to victim's address!
              email: 'vasu@securemax.mil',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (urlStr === 'https://api.github.com/user/emails') {
          return new Response(
            JSON.stringify([
              // In emails endpoint, the address is NOT verified!
              { email: 'vasu@securemax.mil', primary: true, verified: false },
            ]),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response('Not Found', { status: 404 });
      });
      vi.stubGlobal('fetch', mockFetch);

      const callbackReq = new Request(
        `http://localhost:3000/api/auth/callback/github?code=gh_exploit_code&state=${stateParam}`
      );
      const callbackRes = await oauthCallback(callbackReq, { params: { provider: 'github' } });

      expect(callbackRes.status).toBe(307);
      const loc = decodeURIComponent(callbackRes.headers.get('location') || '');
      expect(loc).toContain('/login?error=');
      expect(loc).toContain('verified email');

      // Crucial: Vasu's account must NOT be compromised or have attacker device attached!
      const vasuDevices = deviceStore.getDevicesForUser('usr_vasu_002');
      const attackerDevice = vasuDevices.find(d => d.device_name?.includes('attacker'));
      expect(attackerDevice).toBeUndefined();
    });

    it('rejects Microsoft external guest account with synthetic #EXT# UPN when mailbox email is missing', async () => {
      const initReq = new Request('http://localhost:3000/api/auth/oauth/microsoft?json=1', {
        headers: { Accept: 'application/json' },
      });
      const initRes = await oauthInit(initReq, { params: { provider: 'microsoft' } });
      const { url } = await initRes.json();
      const stateParam = new URL(url).searchParams.get('state')!;
      const stateCookie = initRes.cookies.get('smx_oauth_state')!.value;
      const verifierCookie = initRes.cookies.get('smx_oauth_verifier')!.value;

      const cookieMap = (cookies() as any)._store;
      cookieMap.set('smx_oauth_state', { value: stateCookie });
      cookieMap.set('smx_oauth_verifier', { value: verifierCookie });

      const mockFetch = vi.fn(async (input: any) => {
        const urlStr = String(input);
        if (urlStr.includes('/oauth2/v2.0/token')) {
          return new Response(
            JSON.stringify({
              access_token: 'mock_ms_guest_token',
              token_type: 'Bearer',
              expires_in: 3600,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (urlStr === 'https://graph.microsoft.com/v1.0/me') {
          return new Response(
            JSON.stringify({
              id: 'ms-guest-111',
              displayName: 'Guest Attacker',
              mail: null, // No verified mailbox!
              userPrincipalName: 'attacker_gmail.com#EXT#@defensecorp.onmicrosoft.com',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response('Not Found', { status: 404 });
      });
      vi.stubGlobal('fetch', mockFetch);

      const callbackReq = new Request(
        `http://localhost:3000/api/auth/callback/microsoft?code=ms_code_guest&state=${stateParam}`
      );
      const callbackRes = await oauthCallback(callbackReq, { params: { provider: 'microsoft' } });

      expect(callbackRes.status).toBe(307);
      const loc = decodeURIComponent(callbackRes.headers.get('location') || '');
      expect(loc).toContain('/login?error=');
      expect(loc).toMatch(/#EXT#|mailbox/);
    });
  });

  // =========================================================================
  // 12. OPEN REDIRECT, CRLF INJECTION & ROLE BOUNDARY HARDENING
  // =========================================================================
  describe('12. Open Redirect, CRLF Injection & Role Boundaries', () => {
    it('sanitizes malicious open redirect and CRLF header injection vectors', () => {
      // Open redirect vectors
      expect(sanitizeReturnUrl('https://evil.com')).toBe('/dashboard');
      expect(sanitizeReturnUrl('//evil.com')).toBe('/dashboard');
      expect(sanitizeReturnUrl('/\\evil.com')).toBe('/dashboard');
      expect(sanitizeReturnUrl('/test\\evil.com')).toBe('/dashboard');
      expect(sanitizeReturnUrl('javascript:alert(1)')).toBe('/dashboard');
      expect(sanitizeReturnUrl('data:text/html,<script>evil</script>')).toBe('/dashboard');

      // CRLF header injection vectors
      expect(sanitizeReturnUrl('/dashboard\r\nSet-Cookie: pwned=1')).toBe('/dashboard');
      expect(sanitizeReturnUrl('/dashboard\nLocation: https://evil.com')).toBe('/dashboard');

      // Sensitive API route protection
      expect(sanitizeReturnUrl('/api/auth/logout')).toBe('/dashboard');
      expect(sanitizeReturnUrl('/api/admin/panic')).toBe('/dashboard');

      // Valid internal paths allowed
      expect(sanitizeReturnUrl('/assets')).toBe('/assets');
      expect(sanitizeReturnUrl('/dashboard/admin')).toBe('/dashboard/admin');
    });

    it('enforces role boundaries by redirecting non-admin users away from /dashboard/admin', async () => {
      // Regular user initiates login with returnUrl=/dashboard/admin
      const initReq = new Request('http://localhost:3000/api/auth/oauth/google?json=1&returnUrl=/dashboard/admin', {
        headers: { Accept: 'application/json' },
      });
      const initRes = await oauthInit(initReq, { params: { provider: 'google' } });
      const { url } = await initRes.json();
      const stateParam = new URL(url).searchParams.get('state')!;
      const stateCookie = initRes.cookies.get('smx_oauth_state')!.value;
      const verifierCookie = initRes.cookies.get('smx_oauth_verifier')!.value;

      const cookieMap = (cookies() as any)._store;
      cookieMap.set('smx_oauth_state', { value: stateCookie });
      cookieMap.set('smx_oauth_verifier', { value: verifierCookie });

      const mockFetch = vi.fn(async (input: any) => {
        const urlStr = String(input);
        if (urlStr === 'https://oauth2.googleapis.com/token') {
          return new Response(JSON.stringify({ access_token: 'tok_reg', token_type: 'Bearer', expires_in: 3600 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (urlStr === 'https://openidconnect.googleapis.com/v1/userinfo') {
          return new Response(
            JSON.stringify({
              sub: 'regular_sub_123',
              name: 'Normal User',
              email: 'normal.user@gmail.com',
              email_verified: true,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response('Not Found', { status: 404 });
      });
      vi.stubGlobal('fetch', mockFetch);

      const callbackReq = new Request(
        `http://localhost:3000/api/auth/callback/google?code=reg_code&state=${stateParam}`
      );
      const callbackRes = await oauthCallback(callbackReq, { params: { provider: 'google' } });

      // Regular user must be redirected to /dashboard, NOT /dashboard/admin!
      expect(callbackRes.status).toBe(307);
      expect(callbackRes.headers.get('location')).toBe('http://localhost:3000/dashboard');
    });
  });

  // =========================================================================
  // 13. SESSION_SECRET ENVIRONMENT VARIABLE FALLBACK
  // =========================================================================
  describe('13. Configuration Secret Flexibility (SESSION_SECRET vs JWT_SECRET)', () => {
    it('uses SESSION_SECRET when JWT_SECRET is unset', async () => {
      delete process.env.JWT_SECRET;
      process.env.SESSION_SECRET = 'session-secret-override-configured-by-admin-32chars!';

      const { getJwtSecret } = await import('../../src/lib/auth/session');
      const secretBytes = getJwtSecret();
      const secretStr = new TextDecoder().decode(secretBytes);
      expect(secretStr).toBe('session-secret-override-configured-by-admin-32chars!');
    });
  });
});

