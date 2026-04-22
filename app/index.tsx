import { Redirect } from 'expo-router';

import { useSession } from '@/src/context/SessionProvider';

export default function IndexScreen() {
  const { isAuthenticated, session } = useSession();

  if (isAuthenticated && session?.role === 'owner') {
    return <Redirect href="/(owner)/home" />;
  }

  if (isAuthenticated && session?.role === 'tenant') {
    return <Redirect href="/(tenant)/home" />;
  }

  return <Redirect href="/auth/login" />;
}
