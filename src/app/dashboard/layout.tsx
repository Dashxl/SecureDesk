import React from 'react';
import { redirect } from 'next/navigation';
import { isAuth0Configured, safeGetSession } from '@/lib/auth-config';
import { DashboardShell } from '@/components/layout/DashboardShell';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  if (!isAuth0Configured()) {
    redirect('/');
  }

  const session = await safeGetSession();
  if (!session?.user) {
    redirect('/api/auth/login');
  }

  return <DashboardShell>{children}</DashboardShell>;
}
