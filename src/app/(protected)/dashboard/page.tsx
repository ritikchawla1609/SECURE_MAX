import { redirect } from 'next/navigation';
import { getVerifiedSession } from '@/lib/auth/session';
import { UserRole } from '@/types';

export const dynamic = 'force-dynamic';

export default async function DashboardRedirect() {
  try {
    const session = await getVerifiedSession();
    if (session.role === UserRole.ADMIN) {
      redirect('/dashboard/admin');
    } else if (session.role === UserRole.AUDITOR) {
      redirect('/dashboard/auditor');
    } else if (session.role === UserRole.SECURITY_ANALYST) {
      redirect('/dashboard/soc');
    } else {
      redirect('/dashboard/user');
    }
  } catch {
    redirect('/login');
  }
}
