import { Redirect, useLocalSearchParams } from 'expo-router';

export default function SignupRedirectScreen() {
  const { invite } = useLocalSearchParams<{ invite?: string }>();

  return (
    <Redirect
      href={
        typeof invite === 'string' && invite.trim().length > 0
          ? { pathname: '/auth/login', params: { invite, mode: 'signup' } }
          : { pathname: '/auth/login', params: { mode: 'signup' } }
      }
    />
  );
}
