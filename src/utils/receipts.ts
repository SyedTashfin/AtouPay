import { ReceiptRecord } from '@/src/types';

export function isReceiptSimulated(receipt: ReceiptRecord) {
  return receipt.simulated === true || receipt.issuanceSource === 'simulate-complete';
}
