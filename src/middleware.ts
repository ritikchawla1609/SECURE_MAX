import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { UserRole } from '@/types';

import { jwtVerify } from 'jose';

// Real session validation using jose for Edge runtime compatibility
async function validateSession(req: NextRequest) {
  const sessionToken = req.cookies.get('securemesh_session')?.value;
  if (!sessionToken) return null;
  
  try {
    const secret = process.env.JWT_SECRET;
    if (process.env.NODE_ENV === 'production' && (!secret || secret.includes('fallback') || secret.length < 32)) {
      console.error('[Security Error] Production JWT_SECRET is missing or insecure.');
      return null;
    }
    const JWT_SECRET = new TextEncoder().encode(secret || 'securemax-dev-jwt-secret-minimum-32-chars-long-secure-padding');
    const { payload } = await jwtVerify(sessionToken, JWT_SECRET);
    return payload;
  } catch (e) {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // If visiting /login or / while already authenticated, redirect to appropriate dashboard
  if (pathname === '/login' || pathname === '/') {
    const session = await validateSession(request);
    if (session) {
      if (session.role === 'ADMIN') return NextResponse.redirect(new URL('/dashboard/admin', request.url));
      if (session.role === 'AUDITOR') return NextResponse.redirect(new URL('/dashboard/auditor', request.url));
      return NextResponse.redirect(new URL('/dashboard/user', request.url));
    }
    return NextResponse.next();
  }

  // Public API endpoints that don't require an active session
  const isPublicApi = 
    pathname.startsWith('/api/auth/') ||
    pathname === '/api/admin/bootstrap' ||
    pathname === '/api/admin/recovery' ||
    pathname.startsWith('/api/devices/enrollment/verify') ||
    pathname.startsWith('/api/devices/enrollment/complete') ||
    pathname === '/api/health';

  // Enforce 5MB payload limit for uploads to prevent memory exhaustion
  if (pathname === '/api/assets/upload' && request.method === 'POST') {
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > 5 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: { code: 'PAYLOAD_TOO_LARGE', message: 'Payload exceeds 5MB limit' } },
        { status: 413 }
      );
    }
  }

  // Protect dashboard, breachlab, and api routes (except public APIs)
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/breachlab') || (pathname.startsWith('/api/') && !isPublicApi)) {
    const session = await validateSession(request);
    
    if (!session) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Session required' } }, { status: 401 });
      }
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Role-based routing checks
    if (pathname.startsWith('/dashboard/admin') && session.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/breachlab', '/breachlab/:path*', '/api/:path*', '/login', '/'],
};
