import { Redirect } from 'expo-router';

export default function AgencyAuthRedirect() {
  return (
    <Redirect
      href={{
        pathname: '/auth/login',
        params: {
          role: 'agency_admin',
        },
      }}
    />
  );
}
