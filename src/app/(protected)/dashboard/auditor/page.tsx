import * as React from 'react';
import { getVerifiedSession } from '@/lib/auth/session';
import { AuditorDashboardView } from '@/components/auditor/AuditorDashboardView';
import { redirect } from 'next/navigation';
import { UserRole } from '@/types';

export const dynamic = 'force-dynamic';

export default async function AuditorDashboardPage() {
  try {
    const session = await getVerifiedSession();
    if (session.role !== UserRole.AUDITOR && session.role !== UserRole.ADMIN) {
      redirect('/dashboard/user');
    }
  } catch {
    redirect('/login');
  }

  return <AuditorDashboardView />;
}
