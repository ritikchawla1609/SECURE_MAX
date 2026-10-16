import * as React from 'react';
import { AppShell } from '@/components/layout/AppShell';

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-[#0B0F19]" />}>
      <AppShell>{children}</AppShell>
    </React.Suspense>
  );
}
