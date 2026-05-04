import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="tenant" />
      <Stack.Screen name="owner" />
      <Stack.Screen name="invitation" />
      <Stack.Screen name="dev-tools" />
      <Stack.Screen name="login" />
      <Stack.Screen name="agency" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="verify-email" />
    </Stack>
  );
}
