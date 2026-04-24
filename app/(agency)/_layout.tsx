import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { colors } from '@/src/theme/colors';
import { typography } from '@/src/theme/typography';

export default function AgencyLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: {
          backgroundColor: colors.background,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          ...typography.caption,
        },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 68,
          paddingBottom: 8,
          paddingTop: 6,
        },
      }}>
      <Tabs.Screen
        name="home"
        options={{
          title: 'Accueil',
          tabBarAccessibilityLabel: 'Accueil agence',
          tabBarIcon: ({ color, size }) => <Ionicons color={color} name="home-outline" size={size} />,
        }}
      />
      <Tabs.Screen
        name="owners"
        options={{
          title: 'Propriétaires',
          tabBarAccessibilityLabel: 'Propriétaires agence',
          tabBarIcon: ({ color, size }) => (
            <Ionicons color={color} name="people-outline" size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="invites"
        options={{
          title: 'Invitations',
          tabBarAccessibilityLabel: 'Invitations agence',
          tabBarIcon: ({ color, size }) => (
            <Ionicons color={color} name="mail-open-outline" size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Réglages',
          tabBarAccessibilityLabel: 'Réglages agence',
          tabBarIcon: ({ color, size }) => (
            <Ionicons color={color} name="settings-outline" size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="support"
        options={{
          title: 'Support',
          tabBarAccessibilityLabel: 'Support agence',
          tabBarIcon: ({ color, size }) => (
            <Ionicons color={color} name="help-buoy-outline" size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="audit"
        options={{
          title: 'Audit',
          tabBarAccessibilityLabel: 'Audit agence',
          tabBarIcon: ({ color, size }) => (
            <Ionicons color={color} name="pulse-outline" size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
