import { ImagePickerAsset } from 'expo-image-picker';
import { ref, uploadBytes } from 'firebase/storage';

import { requireFirebaseStorage } from '@/src/lib/firebase';

const MAX_PROOF_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_PROOF_IMAGE_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export interface ManualPaymentProofImageMetadata {
  proofImageContentType: string;
  proofImageFileName: string;
  proofImageOriginalFileName: string;
  proofImageSizeBytes: number;
  proofImageStoragePath: string;
}

function sanitizeStorageSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 120) || 'unknown';
}

function getFileExtension(contentType: string) {
  if (contentType === 'image/png') {
    return 'png';
  }

  if (contentType === 'image/webp') {
    return 'webp';
  }

  return 'jpg';
}

function assertAllowedProofImage(contentType: string, sizeBytes?: number) {
  if (!ALLOWED_PROOF_IMAGE_CONTENT_TYPES.has(contentType)) {
    throw new Error('Seuls les formats JPG, PNG ou WebP sont acceptés.');
  }

  if (typeof sizeBytes === 'number' && sizeBytes > MAX_PROOF_IMAGE_SIZE_BYTES) {
    throw new Error('La preuve image doit faire 5 Mo maximum.');
  }
}

export async function uploadManualPaymentProofImage(input: {
  agencyId: string;
  asset: ImagePickerAsset;
  paymentId: string;
  tenantId: string;
}): Promise<ManualPaymentProofImageMetadata> {
  const storage = requireFirebaseStorage();
  const assetContentType = input.asset.mimeType || 'image/jpeg';

  assertAllowedProofImage(assetContentType, input.asset.fileSize);

  const response = await fetch(input.asset.uri);
  const blob = await response.blob();
  const contentType = input.asset.mimeType || blob.type || 'image/jpeg';

  assertAllowedProofImage(contentType, blob.size);

  const rawFileName =
    input.asset.fileName ??
    `bankily-proof-${new Date().toISOString().replace(/[:.]/g, '-')}.${getFileExtension(
      contentType,
    )}`;
  const originalFileName = rawFileName.slice(0, 240);
  const fileName = sanitizeStorageSegment(rawFileName);
  const extension = getFileExtension(contentType);
  const storageFileName = `${Date.now().toString(36)}-${fileName.replace(/\.[^.]+$/, '')}.${extension}`;
  const storagePath = [
    'paymentProofs',
    sanitizeStorageSegment(input.agencyId),
    sanitizeStorageSegment(input.paymentId),
    sanitizeStorageSegment(input.tenantId),
    storageFileName,
  ].join('/');
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, blob, {
    contentType,
    customMetadata: {
      agencyId: input.agencyId,
      paymentId: input.paymentId,
      proofKind: 'manual_rent_payment',
      tenantId: input.tenantId,
    },
  });

  return {
    proofImageContentType: contentType,
    proofImageFileName: storageFileName,
    proofImageOriginalFileName: originalFileName,
    proofImageSizeBytes: blob.size,
    proofImageStoragePath: storagePath,
  };
}
