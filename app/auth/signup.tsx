import { Redirect, useLocalSearchParams } from 'expo-router';

export default function SignupRedirectScreen() {
  const { invite } = useLocalSearchParams<{ invite?: string }>();

  return (
    <Redirect
      href={
        typeof invite === 'string' && invite.trim().length > 0
          ? { pathname: '/auth/invitation', params: { invite } }
          : { pathname: '/auth/tenant', params: { mode: 'signup' } }
      }
    />
  );
}
