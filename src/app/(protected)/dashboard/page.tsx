import { redirect } from 'next/navigation';
// import { getSession } from '@/lib/auth/session'; // TODO: wire up server-side auth

export default async function DashboardRedirect() {
  // Simulate auth check for now
  // const session = await getSession();
  // if (!session) redirect('/');
  // redirect(`/dashboard/${session.role.toLowerCase()}`);
  
  redirect('/dashboard/soc');
}
