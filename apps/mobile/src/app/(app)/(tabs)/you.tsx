import { useMe } from '@/lib/auth';
import { ProfileView } from '@/components/ProfileView';

export default function You() {
  const me = useMe();
  return <ProfileView handle={me.handle} isTab />;
}
