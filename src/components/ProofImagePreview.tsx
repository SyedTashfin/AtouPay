import { useEffect, useState } from 'react';
import { Image, Linking, StyleSheet, Text, View } from 'react-native';
import { getDownloadURL, ref } from 'firebase/storage';

import { PrimaryButton } from '@/src/components/PrimaryButton';
import { storage } from '@/src/lib/firebase';
import { colors } from '@/src/theme/colors';
import { radius } from '@/src/theme/radius';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';

interface ProofImagePreviewProps {
  fileName?: string | null;
  storagePath?: string | null;
}

export function ProofImagePreview({ fileName, storagePath }: ProofImagePreviewProps) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!storagePath || !storage) {
      setResolvedUrl(null);
      setError(storagePath ? 'Firebase Storage n’est pas disponible dans cette build.' : null);
      return;
    }

    let isMounted = true;
    setError(null);

    void getDownloadURL(ref(storage, storagePath))
      .then((url) => {
        if (isMounted) {
          setResolvedUrl(url);
        }
      })
      .catch(() => {
        if (isMounted) {
          setResolvedUrl(null);
          setError('La preuve image n’est pas accessible avec cette session.');
        }
      });

    return () => {
      isMounted = false;
    };
  }, [storagePath]);

  if (!storagePath) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.meta}>{`Chemin sécurisé: ${storagePath}`}</Text>
      {fileName ? <Text style={styles.meta}>{`Fichier: ${fileName}`}</Text> : null}
      {resolvedUrl ? (
        <>
          <Image
            accessibilityIgnoresInvertColors
            source={{ uri: resolvedUrl }}
            style={styles.preview}
          />
          <PrimaryButton
            label="Ouvrir la preuve"
            onPress={() => {
              void Linking.openURL(resolvedUrl);
            }}
            variant="secondary"
          />
        </>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  error: {
    color: colors.danger,
    ...typography.caption,
  },
  meta: {
    color: colors.textMuted,
    ...typography.caption,
  },
  preview: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    height: 120,
    width: 120,
  },
});
