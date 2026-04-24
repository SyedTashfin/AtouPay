import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as QRCode from 'qrcode';

import { ReceiptRecord } from '@/src/types';
import { formatCurrency } from '@/src/utils/currency';
import { formatDateLabel, formatDateTimeLabel } from '@/src/utils/dates';
import { formatPaymentStatusLabel } from '@/src/utils/paymentStatus';

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function buildReceiptRows(receipt: ReceiptRecord) {
  const rows: Array<[string, string | undefined]> = [
    ['Quittance', receipt.receiptNumber],
    ['Date de paiement', receipt.paidAt ? formatDateTimeLabel(receipt.paidAt) : formatDateLabel(receipt.issuedAt)],
    ['Date d’émission', formatDateTimeLabel(receipt.issuedAt)],
    ['Locataire', receipt.tenantDisplayName ?? receipt.tenantEmail],
    ['Propriétaire', receipt.ownerDisplayName ?? receipt.ownerEmail],
    ['Agence', receipt.agencyDisplayName ?? undefined],
    [
      'Bien',
      [receipt.propertyLabel, receipt.unitLabel].filter(Boolean).join(' • '),
    ],
    ['Statut', formatPaymentStatusLabel(receipt.paymentStatus)],
    ['Montant brut', formatCurrency(receipt.grossAmount)],
    ['Commission agence', formatCurrency(receipt.agencyFeeAmount)],
    ['Net propriétaire', formatCurrency(receipt.ownerNetAmount)],
    ['Mode de paiement', receipt.paymentMethod],
    ['Simulation', receipt.simulated ? 'Paiement simulé - aucun débit réel' : 'Non simulé'],
    ['Référence vérification', receipt.qrVerificationToken.slice(0, 12).toUpperCase()],
  ];

  return rows
    .filter(([, value]) => value && value.trim().length > 0)
    .map(
      ([label, value]) => `
        <tr>
          <td class="label">${escapeHtml(label)}</td>
          <td class="value">${escapeHtml(value!)}</td>
        </tr>
      `,
    )
    .join('');
}

export function buildReceiptHtml(receipt: ReceiptRecord, qrDataUrl?: string | null) {
  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body {
            color: #172033;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            margin: 32px;
          }
          .wrap {
            border: 1px solid #d9dde6;
            border-radius: 18px;
            padding: 28px;
          }
          h1 {
            margin: 0 0 6px;
            font-size: 22px;
          }
          .subtle {
            color: #596173;
            font-size: 13px;
            line-height: 1.5;
            margin: 0 0 20px;
          }
          .pill {
            background: #eef7f4;
            border-radius: 999px;
            color: #0f6a46;
            display: inline-block;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.03em;
            margin-bottom: 20px;
            padding: 8px 12px;
            text-transform: uppercase;
          }
          table {
            border-collapse: collapse;
            width: 100%;
          }
          tr + tr td {
            border-top: 1px solid #edf0f5;
          }
          td {
            padding: 12px 0;
            vertical-align: top;
          }
          .label {
            color: #596173;
            font-size: 12px;
            width: 42%;
          }
          .value {
            font-size: 14px;
            font-weight: 600;
          }
          .footer {
            color: #7a8090;
            font-size: 11px;
            line-height: 1.6;
            margin-top: 22px;
          }
          .qr {
            align-items: center;
            border: 1px solid #edf0f5;
            border-radius: 14px;
            display: flex;
            gap: 8px;
            margin: 20px 0 8px;
            padding: 16px;
            text-align: center;
          }
          .qr img {
            height: 132px;
            width: 132px;
          }
          .qr p {
            color: #596173;
            font-size: 12px;
            margin: 0;
          }
        </style>
      </head>
      <body>
        <div class="wrap">
          <div class="pill">Paiement simulé</div>
          <h1>Quittance générée par AtouPay</h1>
          <p class="subtle">
            Ce document peut servir de justificatif de paiement selon les informations enregistrées dans le système.
            Si le paiement est marqué comme simulé, aucun débit bancaire réel ni aucun virement automatique n’ont été effectués.
          </p>
          <table>
            ${buildReceiptRows(receipt)}
          </table>
          ${
            qrDataUrl
              ? `
          <div class="qr">
            <img src="${escapeHtml(qrDataUrl)}" alt="QR de vérification AtouPay" />
            <p>QR de vérification publique du reçu</p>
          </div>
          `
              : ''
          }
          <p class="footer">
            Vérification publique: ${escapeHtml(receipt.verificationUrl ?? 'non disponible')}<br />
            Jeton: ${escapeHtml(receipt.qrVerificationToken)}<br />
            Généré le ${escapeHtml(formatDateTimeLabel(receipt.issuedAt))} par AtouPay
          </p>
        </div>
      </body>
    </html>
  `;
}

export async function exportReceiptPdf(receipt: ReceiptRecord) {
  const qrDataUrl = receipt.verificationUrl
    ? await QRCode.toDataURL(receipt.verificationUrl, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 180,
      })
    : null;
  const { uri } = await Print.printToFileAsync({
    html: buildReceiptHtml(receipt, qrDataUrl),
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
    });
  }

  return {
    uri,
  };
}
