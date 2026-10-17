import { redirect } from 'next/navigation';
import { getBranches } from '@dtour/shared';
import { currentUser } from '@/lib/supabase-server';
import { OnboardingForm } from './OnboardingForm';

export const metadata = { title: 'Welcome' };

export default async function Onboarding() {
  const { sb, me } = await currentUser();
  if (!me) redirect('/login');
  const branches = await getBranches(sb);
  return <OnboardingForm profile={me.profile} email={me.email} branches={branches.filter((b) => b.code !== 'FY')} />;
}
