import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
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
import { useI18n } from '@/src/i18n/I18nProvider';
import {
  createOwnerProperty,
  createOwnerUnit,
  deleteOwnerProperty,
  deleteOwnerUnit,
  generateTenantInvite,
  updateOwnerProperty,
  updateOwnerUnit,
} from '@/src/services/rentalData';
import { OccupancyStatus, Property, PropertyRecord } from '@/src/types';
import { colors } from '@/src/theme/colors';
import { radius } from '@/src/theme/radius';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';
import { formatCurrency } from '@/src/utils/currency';
import { useSession } from '@/src/context/SessionProvider';

type PropertyFilter = 'all' | OccupancyStatus;
type ActiveAction =
  | 'create-apartment'
  | 'create-unit'
  | `delete-property:${string}`
  | `delete-unit:${string}`
  | `invite:${string}`
  | `update-property:${string}`
  | `update-unit:${string}`
  | null;

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
  const { copy } = useI18n();
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
  const [unitNotes, setUnitNotes] = useState('');
  const [existingUnitLabel, setExistingUnitLabel] = useState('');
  const [existingUnitRent, setExistingUnitRent] = useState('');
  const [existingUnitNotes, setExistingUnitNotes] = useState('');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [editingPropertyId, setEditingPropertyId] = useState<string | null>(null);
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [editPropertyLabel, setEditPropertyLabel] = useState('');
  const [editPropertyAddress, setEditPropertyAddress] = useState('');
  const [editUnitLabel, setEditUnitLabel] = useState('');
  const [editUnitRent, setEditUnitRent] = useState('');
  const [editUnitNotes, setEditUnitNotes] = useState('');
  const listRef = useRef<FlatList<Property>>(null);

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

  const propertiesWithoutUnits = useMemo(() => {
    const propertyIdsWithUnits = new Set(
      properties
        .map((property) => property.firestorePropertyId)
        .filter((id): id is string => Boolean(id)),
    );

    return propertyRecords.filter((property) => !propertyIdsWithUnits.has(property.id));
  }, [properties, propertyRecords]);

  const handleCreateApartment = async () => {
    setFeedback(null);

    if (!isFirebaseDataMode) {
      setFeedback({
        description:
          "L’ajout connecté de logements nécessite une session Firebase réelle. La démo locale conserve seulement les écrans de revue.",
        title: 'Mode démo',
        tone: 'info',
      });
      return;
    }

    if (
      propertyLabel.trim().length < 3 ||
      propertyAddress.trim().length < 6 ||
      unitLabel.trim().length < 2
    ) {
      setFeedback({
        description:
          'Renseignez le nom du bien, l’adresse et le numéro/appartement avant de valider.',
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

    setActiveAction('create-apartment');

    try {
      const propertyResult = await createOwnerProperty({
        address: propertyAddress,
        label: propertyLabel,
        ownerId,
      });

      reportDataEvent({
        action: 'create-property',
        message: propertyResult.message,
        scope: 'firestore',
        status: propertyResult.ok ? 'success' : 'error',
        title: propertyResult.title,
      });

      if (!propertyResult.ok || !propertyResult.propertyId) {
        setFeedback({
          description: propertyResult.message,
          title: propertyResult.title,
          tone: 'error',
        });
        return;
      }

      const unitResult = await createOwnerUnit({
        currency: 'MRU',
        label: unitLabel,
        notes: unitNotes,
        ownerId,
        propertyId: propertyResult.propertyId,
        rentAmount,
      });

      reportDataEvent({
        action: 'create-unit',
        message: unitResult.message,
        scope: 'firestore',
        status: unitResult.ok ? 'success' : 'error',
        title: unitResult.title,
      });

      setFeedback({
        description: unitResult.ok
          ? 'Le logement a été ajouté et apparaît maintenant dans votre liste.'
          : `Le bien a été créé, mais l’unité n’a pas pu être ajoutée: ${unitResult.message}`,
        title: unitResult.ok ? 'Logement ajouté' : 'Unité à compléter',
        tone: unitResult.ok ? 'success' : 'error',
      });

      setSelectedPropertyId(propertyResult.propertyId);

      if (unitResult.ok) {
        setPropertyLabel('');
        setPropertyAddress('');
        setUnitLabel('');
        setUnitRent('');
        setUnitNotes('');
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

    if (!selectedPropertyId || existingUnitLabel.trim().length < 2) {
      setFeedback({
        description:
          'Choisissez un bien existant puis renseignez un libellé d’unité avant de valider.',
        title: 'Informations incomplètes',
        tone: 'error',
      });
      return;
    }

    const rentAmount = Number(existingUnitRent.replace(/[^\d]/g, ''));

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
        label: existingUnitLabel,
        notes: existingUnitNotes,
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
        setExistingUnitLabel('');
        setExistingUnitRent('');
        setExistingUnitNotes('');

        if (result.unitId) {
          setActiveFilter('vacant');
          setGeneratedInvite(null);
          setInviteTargetUnitId(result.unitId);
          setFeedback({
            description:
              'La nouvelle unité est prête. Validez son invitation dans la liste des unités vacantes.',
            title: 'Unité prête à inviter',
            tone: 'success',
          });
        }
      }
    } finally {
      setActiveAction(null);
    }
  };

  const focusAddUnitForSameProperty = (property: Property) => {
    if (!property.firestorePropertyId) {
      setFeedback({
        description: 'Ce logement n’est pas relié à un bien Firestore valide.',
        title: 'Bien introuvable',
        tone: 'error',
      });
      return;
    }

    setSelectedPropertyId(property.firestorePropertyId);
    setExistingUnitLabel('');
    setExistingUnitRent('');
    setExistingUnitNotes('');
    setGeneratedInvite(null);
    setInviteTargetUnitId(null);
    setActiveFilter('all');
    setFeedback({
      description: `Créez une nouvelle unité dans ${property.name}, puis générez l’invitation sur cette unité.`,
      title: 'Ajouter un autre locataire',
      tone: 'info',
    });
    setTimeout(() => {
      listRef.current?.scrollToOffset({ animated: true, offset: 0 });
    }, 50);
  };

  const beginEditUnit = (property: Property) => {
    setEditingPropertyId(null);
    setEditingUnitId(property.id);
    setEditPropertyLabel(property.name);
    setEditPropertyAddress(property.address);
    setEditUnitLabel(property.unitLabel ?? '');
    setEditUnitRent(String(property.monthlyRent));
    setEditUnitNotes(property.notes ?? '');
    setFeedback(null);
  };

  const beginEditProperty = (property: PropertyRecord) => {
    setEditingUnitId(null);
    setEditingPropertyId(property.id);
    setEditPropertyLabel(property.label);
    setEditPropertyAddress(property.address);
    setFeedback(null);
  };

  const clearEditState = () => {
    setEditingPropertyId(null);
    setEditingUnitId(null);
    setEditPropertyLabel('');
    setEditPropertyAddress('');
    setEditUnitLabel('');
    setEditUnitRent('');
    setEditUnitNotes('');
  };

  const handleUpdateUnit = async (property: Property) => {
    setFeedback(null);

    if (!isFirebaseDataMode) {
      setFeedback({
        description: 'La modification nécessite une session Firebase réelle.',
        title: 'Mode démo',
        tone: 'info',
      });
      return;
    }

    if (!property.firestorePropertyId) {
      setFeedback({
        description: 'Ce logement n’est pas relié à un bien Firestore valide.',
        title: 'Bien introuvable',
        tone: 'error',
      });
      return;
    }

    if (
      editPropertyLabel.trim().length < 3 ||
      editPropertyAddress.trim().length < 6 ||
      editUnitLabel.trim().length < 2
    ) {
      setFeedback({
        description: 'Renseignez le nom du bien, l’adresse et le libellé d’unité.',
        title: 'Informations incomplètes',
        tone: 'error',
      });
      return;
    }

    const rentAmount = Number(editUnitRent.replace(/[^\d]/g, ''));

    if (!Number.isFinite(rentAmount) || rentAmount <= 0) {
      setFeedback({
        description: 'Saisissez un loyer mensuel valable en MRU.',
        title: 'Montant invalide',
        tone: 'error',
      });
      return;
    }

    setActiveAction(`update-unit:${property.id}`);

    try {
      const propertyResult = await updateOwnerProperty({
        address: editPropertyAddress,
        label: editPropertyLabel,
        ownerId,
        propertyId: property.firestorePropertyId,
      });

      reportDataEvent({
        action: 'update-property',
        message: propertyResult.message,
        scope: 'firestore',
        status: propertyResult.ok ? 'success' : 'error',
        title: propertyResult.title,
      });

      if (!propertyResult.ok) {
        setFeedback({
          description: propertyResult.message,
          title: propertyResult.title,
          tone: 'error',
        });
        return;
      }

      const unitResult = await updateOwnerUnit({
        label: editUnitLabel,
        notes: editUnitNotes,
        ownerId,
        rentAmount,
        unitId: property.id,
      });

      reportDataEvent({
        action: 'update-unit',
        message: unitResult.message,
        scope: 'firestore',
        status: unitResult.ok ? 'success' : 'error',
        title: unitResult.title,
      });

      setFeedback({
        description: unitResult.message,
        title: unitResult.title,
        tone: unitResult.ok ? 'success' : 'error',
      });

      if (unitResult.ok) {
        clearEditState();
      }
    } finally {
      setActiveAction(null);
    }
  };

  const handleUpdateProperty = async (propertyId: string) => {
    setFeedback(null);

    if (!isFirebaseDataMode) {
      setFeedback({
        description: 'La modification nécessite une session Firebase réelle.',
        title: 'Mode démo',
        tone: 'info',
      });
      return;
    }

    if (editPropertyLabel.trim().length < 3 || editPropertyAddress.trim().length < 6) {
      setFeedback({
        description: 'Renseignez le nom du bien et son adresse complète.',
        title: 'Informations incomplètes',
        tone: 'error',
      });
      return;
    }

    setActiveAction(`update-property:${propertyId}`);

    try {
      const result = await updateOwnerProperty({
        address: editPropertyAddress,
        label: editPropertyLabel,
        ownerId,
        propertyId,
      });

      reportDataEvent({
        action: 'update-property',
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
        clearEditState();
      }
    } finally {
      setActiveAction(null);
    }
  };

  const performDeleteUnit = async (unitId: string) => {
    setFeedback(null);
    setActiveAction(`delete-unit:${unitId}`);

    try {
      const result = await deleteOwnerUnit({
        ownerId,
        unitId,
      });

      reportDataEvent({
        action: 'delete-unit',
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

      if (result.ok && editingUnitId === unitId) {
        clearEditState();
      }
    } finally {
      setActiveAction(null);
    }
  };

  const confirmDeleteUnit = (property: Property) => {
    Alert.alert(
      'Supprimer cette unité ?',
      'Seules les unités vacantes, sans invitation active ni historique de paiement, peuvent être supprimées.',
      [
        { style: 'cancel', text: 'Annuler' },
        {
          onPress: () => {
            void performDeleteUnit(property.id);
          },
          style: 'destructive',
          text: 'Supprimer',
        },
      ],
    );
  };

  const performDeleteProperty = async (propertyId: string) => {
    setFeedback(null);
    setActiveAction(`delete-property:${propertyId}`);

    try {
      const result = await deleteOwnerProperty({
        ownerId,
        propertyId,
      });

      reportDataEvent({
        action: 'delete-property',
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

      if (result.ok && editingPropertyId === propertyId) {
        clearEditState();
      }
    } finally {
      setActiveAction(null);
    }
  };

  const confirmDeleteProperty = (property: PropertyRecord) => {
    Alert.alert(
      'Supprimer ce bien ?',
      'Un bien peut être supprimé uniquement lorsqu’il ne contient plus aucune unité.',
      [
        { style: 'cancel', text: 'Annuler' },
        {
          onPress: () => {
            void performDeleteProperty(property.id);
          },
          style: 'destructive',
          text: 'Supprimer',
        },
      ],
    );
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

  const renderUnitFooter = (item: Property) => {
    const isEditing = editingUnitId === item.id;
    const canDeleteUnit =
      item.occupancyStatus === 'vacant' &&
      item.tenantIds.length === 0 &&
      !item.activeInviteId;

    if (isEditing) {
      return (
        <View style={styles.editSection}>
          <Text style={styles.editTitle}>{copy('Modifier le logement')}</Text>
          <AuthField
            label="Nom du bien"
            onChangeText={setEditPropertyLabel}
            placeholder="Résidence Tevragh"
            value={editPropertyLabel}
          />
          <AuthField
            label="Adresse complète"
            onChangeText={setEditPropertyAddress}
            placeholder="Tevragh-Zeina, Nouakchott"
            value={editPropertyAddress}
          />
          <AuthField
            label="Appartement / chambre / porte"
            onChangeText={setEditUnitLabel}
            placeholder="Appartement A3"
            value={editUnitLabel}
          />
          <AuthField
            helper={
              item.occupancyStatus === 'occupied'
                ? 'Le loyer d’une unité occupée reste verrouillé dans cette version.'
                : undefined
            }
            keyboardType="numeric"
            label="Loyer mensuel (MRU)"
            onChangeText={setEditUnitRent}
            placeholder="150000"
            value={editUnitRent}
          />
          <AuthField
            label="Notes privées"
            multiline
            onChangeText={setEditUnitNotes}
            placeholder="Étage, repère, consignes..."
            value={editUnitNotes}
          />
          <View style={styles.actionRow}>
            <View style={styles.actionGrow}>
              <PrimaryButton
                label="Enregistrer"
                loading={activeAction === `update-unit:${item.id}`}
                onPress={() => {
                  void handleUpdateUnit(item);
                }}
              />
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={clearEditState}
              style={({ pressed }) => [styles.smallActionButton, pressed && styles.pressed]}>
              <Text style={styles.smallActionText}>{copy('Annuler')}</Text>
            </Pressable>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.cardActionBlock}>
        <View style={styles.actionRow}>
          <Pressable
            accessibilityRole="button"
            onPress={() => beginEditUnit(item)}
            style={({ pressed }) => [styles.smallActionButton, pressed && styles.pressed]}>
            <Text style={styles.smallActionText}>{copy('Modifier')}</Text>
          </Pressable>
          {canDeleteUnit ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => confirmDeleteUnit(item)}
              style={({ pressed }) => [
                styles.smallActionButton,
                styles.dangerActionButton,
                pressed && styles.pressed,
              ]}>
              <Text style={styles.dangerActionText}>
                {activeAction === `delete-unit:${item.id}` ? copy('Traitement...') : copy('Supprimer')}
              </Text>
            </Pressable>
          ) : null}
        </View>

        {item.occupancyStatus !== 'occupied' ? (
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
          <View style={styles.occupiedBlock}>
            <Text style={styles.occupiedText}>
              {copy('Cette unité est déjà occupée. Pour rattacher un autre locataire au même bien, ajoutez une nouvelle unité puis générez son invitation.')}
            </Text>
            <PrimaryButton
              accessibilityHint="Prépare le formulaire d’ajout d’unité sur le même bien"
              label="Ajouter une unité pour un autre locataire"
              onPress={() => focusAddUnitForSameProperty(item)}
              variant="secondary"
            />
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        ref={listRef}
        contentContainerStyle={styles.content}
        data={filteredProperties}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <ListEmptyState
            description="Aucune unité ne correspond à ce filtre. Ajoutez un logement pour voir l’appartement ici."
            title="Aucune unité"
          />
        }
        ListHeaderComponent={
          <View style={styles.headerContent}>
            <ScreenHeader
              subtitle="Ajoutez un logement complet, suivez son statut, puis invitez le locataire."
              title="Logements"
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
              <SectionTitle
                subtitle="Adresse, appartement et loyer en une seule étape"
                title="Ajouter un logement"
              />
              <View style={styles.formCard}>
                <AuthField
                  label="Nom du bien"
                  onChangeText={setPropertyLabel}
                  placeholder="Résidence Tevragh, Immeuble familial..."
                  value={propertyLabel}
                />
                <AuthField
                  autoCapitalize="words"
                  label="Adresse complète"
                  onChangeText={setPropertyAddress}
                  placeholder="Tevragh-Zeina, Nouakchott"
                  value={propertyAddress}
                />
                <AuthField
                  helper="Exemples: Appartement A3, Chambre 2, Porte 14, Studio RDC"
                  label="Appartement / chambre / porte"
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
                <AuthField
                  helper="Optionnel: étage, repère, état, consignes de suivi."
                  label="Notes privées"
                  multiline
                  onChangeText={setUnitNotes}
                  placeholder="2e étage, côté cour, compteur à relever..."
                  value={unitNotes}
                />
                <PrimaryButton
                  accessibilityHint="Crée le bien et l’unité afin que le logement apparaisse immédiatement dans la liste"
                  label="Ajouter le logement"
                  loading={activeAction === 'create-apartment'}
                  onPress={handleCreateApartment}
                />
              </View>
            </View>

            <View style={styles.section}>
              <SectionTitle
                subtitle="Un même bien peut contenir plusieurs unités, chacune avec sa propre invitation locataire"
                title="Ajouter une unité à un bien existant"
              />
              <View style={styles.formCard}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.filterRow}>
                    {propertyOptions.length > 0 ? (
                      propertyOptions.map((property) => (
                        <FilterChip
                          key={property.id}
                          label={property.label}
                          onPress={() => setSelectedPropertyId(property.id)}
                          selected={selectedPropertyId === property.id}
                        />
                      ))
                    ) : (
                      <Text style={styles.helperText}>
                        {copy('Ajoutez d’abord un bien pour créer des unités.')}
                      </Text>
                    )}
                  </View>
                </ScrollView>

                <AuthField
                  helper={
                    selectedPropertyRecord
                      ? `Bien cible: ${selectedPropertyRecord.label}`
                      : 'Choisissez le bien parent avant de créer l’unité.'
                  }
                  label="Appartement / chambre / porte"
                  onChangeText={setExistingUnitLabel}
                  placeholder="Appartement A3"
                  value={existingUnitLabel}
                />
                <AuthField
                  keyboardType="numeric"
                  label="Loyer mensuel (MRU)"
                  onChangeText={setExistingUnitRent}
                  placeholder="150000"
                  value={existingUnitRent}
                />
                <AuthField
                  helper="Optionnel: étage, repère, état, consignes de suivi."
                  label="Notes privées"
                  multiline
                  onChangeText={setExistingUnitNotes}
                  placeholder="2e étage, côté cour, compteur à relever..."
                  value={existingUnitNotes}
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

            {propertiesWithoutUnits.length > 0 ? (
              <View style={styles.section}>
                <SectionTitle
                  subtitle="Ces biens existent déjà mais n’ont pas encore d’appartement visible."
                  title="Biens à compléter"
                />
                <View style={styles.pendingList}>
                  {propertiesWithoutUnits.map((property) => (
                    <View
                      key={property.id}
                      style={[
                        styles.pendingPropertyCard,
                        selectedPropertyId === property.id && styles.pendingPropertySelected,
                      ]}>
                      {editingPropertyId === property.id ? (
                        <View style={styles.editSection}>
                          <Text style={styles.editTitle}>{copy('Modifier le bien')}</Text>
                          <AuthField
                            label="Nom du bien"
                            onChangeText={setEditPropertyLabel}
                            placeholder="Résidence Tevragh"
                            value={editPropertyLabel}
                          />
                          <AuthField
                            label="Adresse complète"
                            onChangeText={setEditPropertyAddress}
                            placeholder="Tevragh-Zeina, Nouakchott"
                            value={editPropertyAddress}
                          />
                          <View style={styles.actionRow}>
                            <View style={styles.actionGrow}>
                              <PrimaryButton
                                label="Enregistrer"
                                loading={activeAction === `update-property:${property.id}`}
                                onPress={() => {
                                  void handleUpdateProperty(property.id);
                                }}
                              />
                            </View>
                            <Pressable
                              accessibilityRole="button"
                              onPress={clearEditState}
                              style={({ pressed }) => [
                                styles.smallActionButton,
                                pressed && styles.pressed,
                              ]}>
                              <Text style={styles.smallActionText}>{copy('Annuler')}</Text>
                            </Pressable>
                          </View>
                        </View>
                      ) : (
                        <>
                          <Text style={styles.pendingTitle}>{property.label}</Text>
                          <Text style={styles.pendingMeta}>{property.address}</Text>
                          <Text style={styles.pendingHint}>
                            {copy('Ajouter un appartement à ce bien')}
                          </Text>
                          <View style={styles.actionRow}>
                            <Pressable
                              accessibilityRole="button"
                              onPress={() => setSelectedPropertyId(property.id)}
                              style={({ pressed }) => [
                                styles.smallActionButton,
                                pressed && styles.pressed,
                              ]}>
                              <Text style={styles.smallActionText}>
                                {copy('Ajouter une unité')}
                              </Text>
                            </Pressable>
                            <Pressable
                              accessibilityRole="button"
                              onPress={() => beginEditProperty(property)}
                              style={({ pressed }) => [
                                styles.smallActionButton,
                                pressed && styles.pressed,
                              ]}>
                              <Text style={styles.smallActionText}>{copy('Modifier')}</Text>
                            </Pressable>
                            <Pressable
                              accessibilityRole="button"
                              onPress={() => confirmDeleteProperty(property)}
                              style={({ pressed }) => [
                                styles.smallActionButton,
                                styles.dangerActionButton,
                                pressed && styles.pressed,
                              ]}>
                              <Text style={styles.dangerActionText}>
                                {activeAction === `delete-property:${property.id}`
                                  ? copy('Traitement...')
                                  : copy('Supprimer')}
                              </Text>
                            </Pressable>
                          </View>
                        </>
                      )}
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

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
            footerContent={renderUnitFooter(item)}
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
    backgroundColor: colors.role.owner.background,
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
  actionGrow: {
    flex: 1,
    minWidth: 0,
  },
  actionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  cardActionBlock: {
    gap: spacing.sm,
  },
  dangerActionButton: {
    borderColor: colors.danger,
  },
  dangerActionText: {
    color: colors.danger,
    ...typography.bodyStrong,
  },
  editSection: {
    gap: spacing.sm,
  },
  editTitle: {
    color: colors.text,
    ...typography.bodyStrong,
  },
  pendingList: {
    gap: spacing.xs,
  },
  pendingPropertyCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: 4,
    padding: spacing.sm,
  },
  pendingPropertySelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  pendingTitle: {
    color: colors.text,
    ...typography.bodyStrong,
  },
  pendingMeta: {
    color: colors.textMuted,
    ...typography.caption,
  },
  pendingHint: {
    color: colors.primary,
    ...typography.overline,
  },
  smallActionButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  smallActionText: {
    color: colors.primaryDark,
    ...typography.bodyStrong,
  },
  inviteSection: {
    gap: spacing.sm,
  },
  inviteForm: {
    gap: spacing.sm,
  },
  occupiedBlock: {
    gap: spacing.sm,
  },
  occupiedText: {
    color: colors.textMuted,
    ...typography.body,
  },
  pressed: {
    opacity: 0.78,
  },
});
