import { Redirect, useLocalSearchParams } from 'expo-router';

export default function LoginRedirectScreen() {
  const { invite, mode, ownerInvite, role } = useLocalSearchParams<{
    invite?: string;
    mode?: string;
    ownerInvite?: string;
    role?: string;
  }>();

  if (typeof invite === 'string' && invite.trim().length > 0) {
    return (
      <Redirect
        href={{
          pathname: '/auth/invitation',
          params: { invite },
        }}
      />
    );
  }

  if (typeof ownerInvite === 'string' && ownerInvite.trim().length > 0) {
    return (
      <Redirect
        href={{
          pathname: '/auth/owner',
          params: {
            ...(mode ? { mode } : {}),
            ownerInvite,
          },
        }}
      />
    );
  }

  if (role === 'owner' || role === 'tenant') {
    return (
      <Redirect
        href={{
          pathname: role === 'owner' ? '/auth/owner' : '/auth/tenant',
          params: mode === 'signup' ? { mode } : undefined,
        }}
      />
    );
  }

  return <Redirect href="/auth" />;
}
