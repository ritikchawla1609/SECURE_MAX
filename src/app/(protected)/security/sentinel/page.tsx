import { redirect } from 'next/navigation';

export default function SentinelRedirectPage() {
  redirect('/dashboard/security');
}
