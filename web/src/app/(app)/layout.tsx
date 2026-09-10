'use client';

import { AppProviders } from '@/providers/AppProviders';
import { AppShell } from '@/components/layout/AppShell';
import { OnboardingFlow } from '@/components/Onboarding';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProviders>
      <OnboardingFlow />
      <AppShell>{children}</AppShell>
    </AppProviders>
  );
}
