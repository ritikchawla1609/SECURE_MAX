import * as React from 'react';
import { getVerifiedSession } from '@/lib/auth/session';
import { deviceStore } from '@/lib/auth/deviceStore';
import { UserDashboardLiveView } from '@/components/dashboard/UserDashboardLiveView';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function UserDashboardPage() {
  let session;
  try {
    session = await getVerifiedSession();
  } catch {
    redirect('/login');
  }

  const assignedAssets = deviceStore.getAssetsForUser(session.userId);
  const enrolledDevices = deviceStore.getDevicesForUser(session.userId);

  return (
    <UserDashboardLiveView
      initialSession={{
        userId: session.userId,
        name: session.name,
        email: session.email,
        role: session.role,
        deviceName: session.deviceName,
      }}
      initialAssignedAssets={assignedAssets}
      initialEnrolledDevices={enrolledDevices}
    />
  );
}
