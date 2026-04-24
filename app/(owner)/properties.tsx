import { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';

import { BannerNotice } from '@/src/components/BannerNotice';
import { FilterChip } from '@/src/components/FilterChip';
import { GeneratedInviteCard } from '@/src/components/GeneratedInviteCard';
import { ListEmptyState } from '@/src/components/ListEmptyState';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { PropertyCard } from '@/src/components/PropertyCard';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { SectionTitle } from '@/src/components/SectionTitle';
import { SummaryCard } from '@/src/components/SummaryCard';
import { AuthField } from '@/src/components/auth/AuthField';
import { useAppContext } from '@/src/context/AppProvider';
import {
  createOwnerProperty,
  createOwnerUnit,
  generateTenantInvite,
} from '@/src/services/rentalData';
import { OccupancyStatus, PropertyRecord } from '@/src/types';
import { colors } from '@/src/theme/colors';
import { radius } from '@/src/theme/radius';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';
import { formatCurrency } from '@/src/utils/currency';
import { useSession } from '@/src/context/SessionProvider';

type PropertyFilter = 'all' | OccupancyStatus;
type ActiveAction = 'create-property' | 'create-unit' | `invite:${string}` | null;

const filters: { label: string; value: PropertyFilter }[] = [
  { label: 'Tous', value: 'all' },
  { label: 'Occupés', value: 'occupied' },
  { label: 'Invités', value: 'invited' },
  { label: 'Vacants', value: 'vacant' },
];

interface FeedbackState {
  description: string;
  title: string;
  tone: 'info' | 'success' | 'error';
}

interface GeneratedInviteState {
  code: string;
  expiresAt: string;
  inviteLink: string;
  unitId: string;
}

export default function OwnerPropertiesScreen() {
  const {
    reportDataEvent,
    isFirebaseDataMode,
    ownerDashboardSummary,
    ownerUser,
    properties,
    propertyRecords,
  } = useAppContext();
  const { session } = useSession();
  const [activeFilter, setActiveFilter] = useState<PropertyFilter>('all');
  const [activeAction, setActiveAction] = useState<ActiveAction>(null);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [generatedInvite, setGeneratedInvite] = useState<GeneratedInviteState | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteTargetUnitId, setInviteTargetUnitId] = useState<string | null>(null);
  const [propertyLabel, setPropertyLabel] = useState('');
  const [propertyAddress, setPropertyAddress] = useState('');
  const [unitLabel, setUnitLabel] = useState('');
  const [unitRent, setUnitRent] = useState('');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedPropertyId && propertyRecords.length > 0) {
      setSelectedPropertyId(propertyRecords[0].id);
    }
  }, [propertyRecords, selectedPropertyId]);

  const ownerId = session?.firebaseUid ?? ownerUser.id;

  const filteredProperties = properties.filter((property) =>
    activeFilter === 'all' ? true : property.occupancyStatus === activeFilter,
  );

  const propertyOptions = useMemo(
    () =>
      propertyRecords.map((property) => ({
        id: property.id,
        label: property.label,
      })),
    [propertyRecords],
  );

  const handleCreateProperty = async () => {
    setFeedback(null);

    if (!isFirebaseDataMode) {
      setFeedback({
        description:
          "L’ajout connecté de biens nécessite une session Firebase réelle. La démo locale conserve seulement les écrans de revue.",
        title: 'Mode démo',
        tone: 'info',
      });
      return;
    }

    if (propertyLabel.trim().length < 3 || propertyAddress.trim().length < 6) {
      setFeedback({
        description: 'Renseignez un nom de bien et une adresse complète avant de valider.',
        title: 'Informations incomplètes',
        tone: 'error',
      });
      return;
    }

    setActiveAction('create-property');

    try {
      const result = await createOwnerProperty({
        address: propertyAddress,
        label: propertyLabel,
        ownerId,
      });

      reportDataEvent({
        action: 'create-property',
        message: result.message,
        scope: 'firestore',
        status: result.ok ? 'success' : 'error',
        title: result.title,
      });

      setFeedback({
        description: result.message,
        title: result.title,
        tone: result.ok ? 'success' : 'error',
      });

      if (result.ok) {
        setPropertyLabel('');
        setPropertyAddress('');
        if (result.propertyId) {
          setSelectedPropertyId(result.propertyId);
        }
      }
    } finally {
      setActiveAction(null);
    }
  };

  const handleCreateUnit = async () => {
    setFeedback(null);

    if (!isFirebaseDataMode) {
      setFeedback({
        description:
          "L’ajout connecté d’unités nécessite une session Firebase réelle. La démo locale n’écrit pas dans Firestore.",
        title: 'Mode démo',
        tone: 'info',
      });
      return;
    }

    if (!selectedPropertyId || unitLabel.trim().length < 2) {
      setFeedback({
        description:
          'Choisissez un bien existant puis renseignez un libellé d’unité avant de valider.',
        title: 'Informations incomplètes',
        tone: 'error',
      });
      return;
    }

    const rentAmount = Number(unitRent.replace(/[^\d]/g, ''));

    if (!Number.isFinite(rentAmount) || rentAmount <= 0) {
      setFeedback({
        description: 'Saisissez un loyer mensuel valable en MRU.',
        title: 'Montant invalide',
        tone: 'error',
      });
      return;
    }

    setActiveAction('create-unit');

    try {
      const result = await createOwnerUnit({
        currency: 'MRU',
        label: unitLabel,
        ownerId,
        propertyId: selectedPropertyId,
        rentAmount,
      });

      reportDataEvent({
        action: 'create-unit',
        message: result.message,
        scope: 'firestore',
        status: result.ok ? 'success' : 'error',
        title: result.title,
      });

      setFeedback({
        description: result.message,
        title: result.title,
        tone: result.ok ? 'success' : 'error',
      });

      if (result.ok) {
        setUnitLabel('');
        setUnitRent('');
      }
    } finally {
      setActiveAction(null);
    }
  };

  const handleGenerateInvite = async (propertyId: string, unitId: string) => {
    setFeedback(null);
    setGeneratedInvite(null);
    setActiveAction(`invite:${unitId}`);

    try {
      if (!propertyId) {
        const result = {
          message: "L’unité n’est pas reliée à un bien Firestore valide. Rechargez la liste puis réessayez.",
          ok: false,
          title: 'Bien introuvable',
        };

        reportDataEvent({
          action: 'generate-invite',
          message: result.message,
          scope: 'invite',
          status: 'error',
          title: result.title,
        });
        setFeedback({
          description: result.message,
          title: result.title,
          tone: 'error',
        });
        return;
      }

      const result = await generateTenantInvite({
        email: inviteEmail,
        ownerId,
        propertyId,
        unitId,
      });

      reportDataEvent({
        action: 'generate-invite',
        message: result.message,
        scope: 'invite',
        status: result.ok ? 'success' : 'error',
        title: result.title,
      });

      setFeedback({
        description: result.message,
        title: result.title,
        tone: result.ok ? 'success' : 'error',
      });

      if (result.ok && result.inviteCode && result.inviteLink && result.expiresAt) {
        setGeneratedInvite({
          code: result.inviteCode,
          expiresAt: result.expiresAt,
          inviteLink: result.inviteLink,
          unitId,
        });
        setInviteEmail('');
        setInviteTargetUnitId(unitId);
      }
    } finally {
      setActiveAction(null);
    }
  };

  const handleCopyInviteValue = async (label: 'code' | 'lien', value: string) => {
    await Clipboard.setStringAsync(value);
    const title = label === 'code' ? 'Code copié' : 'Lien copié';
    const description =
      label === 'code'
        ? 'Le code d’invitation a été copié dans le presse-papiers.'
        : 'Le lien d’invitation a été copié dans le presse-papiers.';

    reportDataEvent({
      action: label === 'code' ? 'copy-invite-code' : 'copy-invite-link',
      message: description,
      scope: 'invite',
      status: 'success',
      title,
    });
    setFeedback({
      description,
      title,
      tone: 'success',
    });
  };

  const selectedPropertyRecord =
    propertyRecords.find((property) => property.id === selectedPropertyId) ?? null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        contentContainerStyle={styles.content}
        data={filteredProperties}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <ListEmptyState
            description="Aucune unité ne correspond à ce filtre. Commencez par créer un bien puis une unité."
            title="Aucune unité"
          />
        }
        ListHeaderComponent={
          <View style={styles.headerContent}>
            <ScreenHeader
              subtitle="Créez vos biens, rattachez des unités, puis générez des invitations locataires à usage unique."
              title="Biens et unités"
            />

            <SummaryCard
              helper={`${ownerDashboardSummary.propertiesCount} biens • ${ownerDashboardSummary.occupiedCount} unités occupées`}
              subtitle="Revenu mensuel potentiel"
              title="Résumé du parc"
              value={formatCurrency(ownerDashboardSummary.monthlyPotentialIncome)}
            />

            {feedback ? (
              <BannerNotice
                description={feedback.description}
                title={feedback.title}
                tone={feedback.tone}
              />
            ) : null}

            <View style={styles.section}>
              <SectionTitle subtitle="Niveau portefeuille" title="Créer un bien" />
              <View style={styles.formCard}>
                <AuthField
                  label="Nom du bien"
                  onChangeText={setPropertyLabel}
                  placeholder="Résidence Tevragh"
                  value={propertyLabel}
                />
                <AuthField
                  autoCapitalize="words"
                  label="Adresse"
                  onChangeText={setPropertyAddress}
                  placeholder="Tevragh-Zeina, Nouakchott"
                  value={propertyAddress}
                />
                <PrimaryButton
                  accessibilityHint="Crée un nouveau bien pour le propriétaire connecté"
                  label="Ajouter le bien"
                  loading={activeAction === 'create-property'}
                  onPress={handleCreateProperty}
                />
              </View>
            </View>

            <View style={styles.section}>
              <SectionTitle subtitle="Unité locative rattachée à un bien" title="Créer une unité" />
              <View style={styles.formCard}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.filterRow}>
                    {propertyOptions.length > 0 ? (
                      propertyOptions.map((property: PropertyRecord | { id: string; label: string }) => (
                        <FilterChip
                          key={property.id}
                          label={property.label}
                          onPress={() => setSelectedPropertyId(property.id)}
                          selected={selectedPropertyId === property.id}
                        />
                      ))
                    ) : (
                      <Text style={styles.helperText}>Ajoutez d’abord un bien pour créer des unités.</Text>
                    )}
                  </View>
                </ScrollView>

                <AuthField
                  helper={
                    selectedPropertyRecord
                      ? `Bien cible: ${selectedPropertyRecord.label}`
                      : 'Choisissez le bien parent avant de créer l’unité.'
                  }
                  label="Libellé de l’unité"
                  onChangeText={setUnitLabel}
                  placeholder="Appartement A3"
                  value={unitLabel}
                />
                <AuthField
                  keyboardType="numeric"
                  label="Loyer mensuel (MRU)"
                  onChangeText={setUnitRent}
                  placeholder="150000"
                  value={unitRent}
                />
                <PrimaryButton
                  accessibilityHint="Crée une unité locative sur le bien choisi"
                  disabled={!selectedPropertyId}
                  label="Ajouter l’unité"
                  loading={activeAction === 'create-unit'}
                  onPress={handleCreateUnit}
                />
              </View>
            </View>

            <View style={styles.filterSection}>
              <SectionTitle subtitle="Filtrer par statut d’occupation" title="Unités" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.filterRow}>
                  {filters.map((filter) => (
                    <FilterChip
                      key={filter.value}
                      label={filter.label}
                      onPress={() => setActiveFilter(filter.value)}
                      selected={activeFilter === filter.value}
                    />
                  ))}
                </View>
              </ScrollView>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <PropertyCard
            footerContent={
              item.occupancyStatus !== 'occupied' ? (
                <View style={styles.inviteSection}>
                  <PrimaryButton
                    accessibilityHint="Prépare une invitation locataire unique pour cette unité"
                    label={
                      inviteTargetUnitId === item.id
                        ? 'Régénérer l’invitation'
                        : 'Générer une invitation'
                    }
                    loading={activeAction === `invite:${item.id}`}
                    onPress={() => {
                      if (inviteTargetUnitId === item.id) {
                        void handleGenerateInvite(
                          item.firestorePropertyId ?? '',
                          item.id,
                        );
                        return;
                      }

                      setInviteTargetUnitId(item.id);
                      setGeneratedInvite(null);
                      setFeedback(null);
                    }}
                    variant="secondary"
                  />

                  {inviteTargetUnitId === item.id ? (
                    <View style={styles.inviteForm}>
                      <AuthField
                        autoCapitalize="none"
                        autoComplete="email"
                        helper="Optionnel: restreint l’invitation à cette adresse e-mail"
                        keyboardType="email-address"
                        label="E-mail autorisé"
                        onChangeText={setInviteEmail}
                        placeholder="locataire@exemple.com"
                        value={inviteEmail}
                      />
                      <PrimaryButton
                        accessibilityHint="Crée une invitation à usage unique pour cette unité"
                        label="Valider l’invitation"
                        loading={activeAction === `invite:${item.id}`}
                        onPress={() =>
                          void handleGenerateInvite(item.firestorePropertyId ?? '', item.id)
                        }
                      />
                    </View>
                  ) : null}

                  {generatedInvite && generatedInvite.unitId === item.id ? (
                    <GeneratedInviteCard
                      code={generatedInvite.code}
                      expiresAt={generatedInvite.expiresAt}
                      inviteLink={generatedInvite.inviteLink}
                      onCopyCode={() => {
                        void handleCopyInviteValue('code', generatedInvite.code);
                      }}
                      onCopyLink={() => {
                        void handleCopyInviteValue('lien', generatedInvite.inviteLink);
                      }}
                    />
                  ) : null}
                </View>
              ) : (
                <Text style={styles.occupiedText}>
                  Cette unité est déjà occupée. Les paiements simulés seront visibles côté propriétaire et locataire.
                </Text>
              )
            }
            property={item}
            tenantCount={item.tenantIds.length}
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
  headerContent: {
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  section: {
    gap: spacing.sm,
  },
  formCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.sm,
  },
  filterSection: {
    gap: spacing.sm,
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  helperText: {
    color: colors.textMuted,
    ...typography.body,
  },
  inviteSection: {
    gap: spacing.sm,
  },
  inviteForm: {
    gap: spacing.sm,
  },
  occupiedText: {
    color: colors.textMuted,
    ...typography.body,
  },
});
