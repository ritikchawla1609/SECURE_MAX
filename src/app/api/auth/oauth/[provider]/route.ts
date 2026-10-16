import { NextResponse } from 'next/server';
import { OAuthProvider, getAppBaseUrl } from '@/lib/auth/oauth/config';
import { initiateOAuth } from '@/lib/auth/oauth/service';
import { checkRateLimit, getClientIp } from '@/lib/auth/oauth/rateLimit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  req: Request,
  { params }: { params: { provider: string } }
) {
  const baseUrl = getAppBaseUrl(req);
  const providerParam = params.provider.toLowerCase() as OAuthProvider;
  const ip = getClientIp(req);
  const rateLimit = checkRateLimit(`oauth_init_${ip}_${providerParam}`, 30, 60 * 1000);

  const url = new URL(req.url);
  const returnUrl = url.searchParams.get('returnUrl') || url.searchParams.get('next') || undefined;
  const wantsJson =
    url.searchParams.get('json') === '1' ||
    req.headers.get('accept')?.includes('application/json');

  if (!rateLimit.allowed) {
    const errorMsg = 'Too many requests. Please wait a moment before trying again.';
    if (wantsJson) {
      return NextResponse.json({ success: false, error: errorMsg }, { status: 429 });
    }
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(errorMsg)}`, baseUrl));
  }

  if (!['google', 'github', 'microsoft'].includes(providerParam)) {
    const errorMsg = `Unsupported OAuth provider: ${params.provider}`;
    if (wantsJson) {
      return NextResponse.json({ success: false, error: errorMsg }, { status: 400 });
    }
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(errorMsg)}`, baseUrl));
  }

  try {
    const { authorizationUrl, cookiesToSet } = initiateOAuth(providerParam, returnUrl, req);

    if (wantsJson) {
      const response = NextResponse.json({
        success: true,
        url: authorizationUrl,
        provider: providerParam,
      });

      for (const c of cookiesToSet) {
        response.cookies.set(c.name, c.value, c.options);
      }
      return response;
    }

    const response = NextResponse.redirect(authorizationUrl);
    for (const c of cookiesToSet) {
      response.cookies.set(c.name, c.value, c.options);
    }
    return response;
  } catch (error: any) {
    const errorMsg = error?.message || 'Failed to initiate authentication with provider';
    if (wantsJson) {
      return NextResponse.json({ success: false, error: errorMsg }, { status: 400 });
    }
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(errorMsg)}`, baseUrl));
  }
}

export async function POST(
  req: Request,
  { params }: { params: { provider: string } }
) {
  return GET(req, { params });
}
