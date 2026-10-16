import { NextResponse } from 'next/server';
import { isProviderConfigured } from '@/lib/auth/oauth/config';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  return NextResponse.json({
    google: {
      configured: isProviderConfigured('google'),
      name: 'Google',
      supportsPkce: true,
    },
    github: {
      configured: isProviderConfigured('github'),
      name: 'GitHub',
      supportsPkce: false,
    },
    microsoft: {
      configured: isProviderConfigured('microsoft'),
      name: 'Microsoft Entra ID',
      supportsPkce: true,
    },
  });
}
