import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { OAuthProvider, getAppBaseUrl } from '@/lib/auth/oauth/config';
import { handleOAuthCallback } from '@/lib/auth/oauth/service';
import { checkRateLimit, getClientIp } from '@/lib/auth/oauth/rateLimit';
import { deviceStore } from '@/lib/auth/deviceStore';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  req: Request,
  { params }: { params: { provider: string } }
) {
  if (typeof deviceStore !== 'undefined') {
    await deviceStore.loadFromCloud().catch(() => {});
  }

  const baseUrl = getAppBaseUrl(req);
  const providerParam = params.provider.toLowerCase() as OAuthProvider;
  const ip = getClientIp(req);
  const rateLimit = checkRateLimit(`oauth_callback_${ip}`, 60, 60 * 1000);

  if (!rateLimit.allowed) {
    const errorMsg = 'Too many authentication attempts. Please try again later.';
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(errorMsg)}`, baseUrl));
  }

  if (!['google', 'github', 'microsoft'].includes(providerParam)) {
    const errorMsg = `Unsupported OAuth provider: ${params.provider}`;
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(errorMsg)}`, baseUrl));
  }

  const url = new URL(req.url);
  const code = url.searchParams.get('code') || undefined;
  const state = url.searchParams.get('state') || undefined;
  const error = url.searchParams.get('error') || undefined;
  const errorDescription = url.searchParams.get('error_description') || undefined;

  // Resilient cookie resolution across runtimes (next/headers + raw header fallback)
  const cookieStore = cookies();
  let cookieState = cookieStore.get('smx_oauth_state')?.value;
  let cookieVerifier = cookieStore.get('smx_oauth_verifier')?.value;

  if (!cookieState) {
    const rawCookie = req.headers.get('cookie') || '';
    const stateMatch = rawCookie.match(/(?:^|;\s*)smx_oauth_state=([^;]+)/);
    if (stateMatch) cookieState = decodeURIComponent(stateMatch[1]);
  }
  if (!cookieVerifier) {
    const rawCookie = req.headers.get('cookie') || '';
    const verifierMatch = rawCookie.match(/(?:^|;\s*)smx_oauth_verifier=([^;]+)/);
    if (verifierMatch) cookieVerifier = decodeURIComponent(verifierMatch[1]);
  }

  try {
    const result = await handleOAuthCallback({
      provider: providerParam,
      code,
      state,
      error,
      errorDescription,
      cookieState,
      cookieVerifier,
      req,
    });

    const response = NextResponse.redirect(new URL(result.redirectUrl, baseUrl));

    // Set secure application session cookie
    response.cookies.set('securemesh_session', result.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 8 * 60 * 60, // 8 hours
    });

    // Clear temporary OAuth state/verifier cookies
    for (const cookieName of result.cookiesToClear) {
      response.cookies.set(cookieName, '', { maxAge: 0, path: '/' });
    }

    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }

    return response;
  } catch (err: any) {
    const errorMsg = err?.message || 'Authentication failed. Please try again.';
    // Log error summary without leaking sensitive tokens
    console.error(`[OAuth Callback Error - ${providerParam}]: ${errorMsg}`);

    const errorRedirect = NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(errorMsg)}`, baseUrl)
    );

    // Clean up temporary cookies on error to prevent lingering CSRF state
    errorRedirect.cookies.set('smx_oauth_state', '', { maxAge: 0, path: '/' });
    errorRedirect.cookies.set('smx_oauth_verifier', '', { maxAge: 0, path: '/' });

    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }

    return errorRedirect;
  }
}
