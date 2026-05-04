import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BannerNotice } from '@/src/components/BannerNotice';
import { ListEmptyState } from '@/src/components/ListEmptyState';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import {
  listNotificationsViaBackend,
  mapBackendErrorToMessage,
  markNotificationReadViaBackend,
} from '@/src/services/backendApi';
import { colors } from '@/src/theme/colors';
import { radius } from '@/src/theme/radius';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';
import { NotificationRecord } from '@/src/types';
import { formatDateTimeLabel } from '@/src/utils/dates';

const visibleNotificationTypes = new Set<NotificationRecord['type']>([
  'payment_completed',
  'payment_overdue',
  'rent_due_reminder',
]);

function NotificationRow({
  notification,
  onMarkRead,
}: {
  notification: NotificationRecord;
  onMarkRead: (notificationId: string) => void;
}) {
  return (
    <View style={[styles.card, !notification.readAt && styles.unreadCard]}>
      <View style={styles.cardHeader}>
        <View style={styles.copy}>
          <Text style={styles.title}>{notification.title}</Text>
          <Text style={styles.meta}>{formatDateTimeLabel(notification.createdAt)}</Text>
        </View>
        {!notification.readAt ? <View style={styles.dot} /> : null}
      </View>
      <Text style={styles.body}>{notification.body}</Text>
      {!notification.readAt ? (
        <PrimaryButton
          label="Marquer comme lu"
          onPress={() => onMarkRead(notification.id)}
          variant="secondary"
        />
      ) : null}
    </View>
  );
}

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isUpdatingId, setIsUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadNotifications() {
      try {
        const nextNotifications = await listNotificationsViaBackend();

        if (isMounted) {
          setNotifications(
            nextNotifications.filter((notification) =>
              visibleNotificationTypes.has(notification.type),
            ),
          );
        }
      } catch (loadError) {
        if (!isMounted) {
          return;
        }

        setError(
          mapBackendErrorToMessage(loadError, 'Les notifications sont indisponibles.'),
        );
      }
    }

    void loadNotifications();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleMarkRead = async (notificationId: string) => {
    setIsUpdatingId(notificationId);
    setError(null);

    try {
      const updated = await markNotificationReadViaBackend(notificationId);
      setNotifications((currentNotifications) =>
        currentNotifications.map((notification) =>
          notification.id === notificationId ? updated : notification,
        ),
      );
    } catch (updateError) {
      setError(
        mapBackendErrorToMessage(updateError, 'La notification n’a pas pu être mise à jour.'),
      );
    } finally {
      setIsUpdatingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        contentContainerStyle={styles.content}
        data={notifications}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <ListEmptyState
            description="Seuls les rappels de loyer, retards et paiements reçus apparaissent ici."
            title="Aucune notification"
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <ScreenHeader
              onBackPress={() => router.back()}
              showBackButton
              subtitle="Seulement les alertes utiles: paiement reçu, rappel, retard."
              title="Notifications"
            />
            {error ? (
              <BannerNotice description={error} title="Chargement impossible" tone="error" />
            ) : null}
            {isUpdatingId ? (
              <BannerNotice
                description="Mise à jour de la notification en cours."
                title="Synchronisation"
                tone="info"
              />
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <NotificationRow
            notification={item}
            onMarkRead={(notificationId) => {
              void handleMarkRead(notificationId);
            }}
          />
        )}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  content: {
    gap: spacing.sm,
    padding: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  header: {
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.sm,
  },
  unreadCard: {
    borderColor: colors.primary,
  },
  cardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: colors.text,
    ...typography.bodyStrong,
  },
  meta: {
    color: colors.textMuted,
    ...typography.caption,
  },
  body: {
    color: colors.text,
    ...typography.body,
  },
  dot: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 10,
    marginTop: 4,
    width: 10,
  },
});
