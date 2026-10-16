import * as React from 'react';
import { getVerifiedSession } from '@/lib/auth/session';
import { AuditorDashboardView } from '@/components/auditor/AuditorDashboardView';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function AuditorDashboardPage() {
  try {
    await getVerifiedSession(); // Validate active session
  } catch {
    redirect('/login');
  }

  return <AuditorDashboardView />;
}
