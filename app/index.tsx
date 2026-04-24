import { Redirect } from 'expo-router';

import { useSession } from '@/src/context/SessionProvider';

export default function IndexScreen() {
  const { authEntryRoute, homeRoute, isAuthenticated } = useSession();

  return <Redirect href={(isAuthenticated ? homeRoute : authEntryRoute) as never} />;
}
