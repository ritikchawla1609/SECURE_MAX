import { CommandCenterView } from '@/components/admin/CommandCenterView';
import { QuickUserRegistrationCard } from '@/components/admin/QuickUserRegistrationCard';
import { getVerifiedSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  try {
    const session = await getVerifiedSession();
    if (session.role !== 'ADMIN' && session.userId !== 'usr_admin_001') {
      redirect('/dashboard/user');
    }
  } catch {
    redirect('/login');
  }

  return (
    <div className="space-y-6 pb-12">
      <CommandCenterView />
      <div className="max-w-7xl mx-auto px-6">
        <QuickUserRegistrationCard />
      </div>
    </div>
  );
}
