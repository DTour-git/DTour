import { useMe } from '@/lib/auth';
import { ProfileView } from '@/components/ProfileView';
import { SignInPrompt } from '@/components/SignInPrompt';

export default function You() {
  const me = useMe();
  if (!me) return <SignInPrompt />;
  return <ProfileView handle={me.handle} isTab />;
}
