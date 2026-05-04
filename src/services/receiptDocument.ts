import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import QRCodeCore from 'qrcode/lib/core/qrcode';

import { ReceiptRecord } from '@/src/types';
import { formatCurrency } from '@/src/utils/currency';
import { formatDateLabel, formatDateTimeLabel } from '@/src/utils/dates';
import { formatPaymentStatusLabel } from '@/src/utils/paymentStatus';
import { isReceiptSimulated } from '@/src/utils/receipts';

const receiptPdfFailureMessage =
  'Impossible de générer la quittance pour le moment. Réessayez dans quelques instants.';

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function getReceiptPdfFailureMessage() {
  return receiptPdfFailureMessage;
}

export function buildReceiptQrSvg(value: string) {
  const qrCode = QRCodeCore.create(value, {
    errorCorrectionLevel: 'M',
  });
  const margin = 4;
  const matrixSize = qrCode.modules.size;
  const viewBoxSize = matrixSize + margin * 2;
  const pathData: string[] = [];

  for (let row = 0; row < matrixSize; row += 1) {
    for (let col = 0; col < matrixSize; col += 1) {
      if (qrCode.modules.get(row, col)) {
        pathData.push(`M${col + margin} ${row + margin}h1v1h-1z`);
      }
    }
  }

  return `
    <svg
      aria-label="QR de vérification AtouPay"
      class="qr-svg"
      role="img"
      viewBox="0 0 ${viewBoxSize} ${viewBoxSize}"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect fill="#ffffff" height="${viewBoxSize}" width="${viewBoxSize}" />
      <path d="${pathData.join(' ')}" fill="#0F5132" />
    </svg>
  `;
}

function valueOrFallback(value: string | null | undefined, fallback: string) {
  const normalized = value?.trim();

  return normalized && normalized.length > 0 ? normalized : fallback;
}

function buildLineItems(receipt: ReceiptRecord) {
  const rows: Array<[string, string]> = [
    ['Loyer payé', formatCurrency(receipt.grossAmount)],
  ];

  return rows
    .map(
      ([label, value]) => `
        <tr>
          <td>${escapeHtml(label)}</td>
          <td class="amount">${escapeHtml(value)}</td>
        </tr>
      `,
    )
    .join('');
}

function buildSituationRows(receipt: ReceiptRecord) {
  const rows: Array<[string, string | undefined]> = [
    ['Statut du paiement', formatPaymentStatusLabel(receipt.paymentStatus)],
    ['Date de paiement', receipt.paidAt ? formatDateTimeLabel(receipt.paidAt) : formatDateLabel(receipt.issuedAt)],
    ['Mode de paiement', receipt.paymentMethod ?? undefined],
    ['Référence paiement', receipt.paymentId],
  ];

  return rows
    .filter(([, value]) => value && value.trim().length > 0)
    .map(
      ([label, value]) => `
        <tr>
          <td>${escapeHtml(label)}</td>
          <td class="amount">${escapeHtml(value!)}</td>
        </tr>
      `,
    )
    .join('');
}

export function buildReceiptHtml(receipt: ReceiptRecord, qrSvg?: string | null) {
  const simulated = isReceiptSimulated(receipt);
  const agencyName = valueOrFallback(receipt.agencyDisplayName, 'Agence ATouPay');
  const ownerName = valueOrFallback(receipt.ownerDisplayName ?? receipt.ownerEmail, 'Propriétaire enregistré');
  const tenantName = valueOrFallback(receipt.tenantDisplayName ?? receipt.tenantEmail, 'Locataire enregistré');
  const propertyReference = valueOrFallback(
    [receipt.propertyLabel, receipt.unitLabel].filter(Boolean).join(' - '),
    receipt.unitId,
  );
  const shortToken = receipt.qrVerificationToken.slice(0, 12).toUpperCase();
  const paidOrIssuedAt = receipt.paidAt ?? receipt.issuedAt;

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          @page {
            margin: 0;
            size: A4;
          }
          body {
            background: #ffffff;
            color: #111813;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            margin: 0;
          }
          .page {
            box-sizing: border-box;
            min-height: 297mm;
            padding: 24mm 18mm 18mm;
            position: relative;
          }
          .top {
            display: grid;
            grid-template-columns: 1fr 1.05fr;
            gap: 16mm;
            margin-bottom: 12mm;
          }
          .brand-row {
            align-items: center;
            display: flex;
            gap: 10px;
            margin-bottom: 12px;
          }
          .mark {
            align-items: center;
            background: #0F5132;
            border-radius: 11px;
            color: #ffffff;
            display: flex;
            font-size: 24px;
            font-weight: 900;
            height: 46px;
            justify-content: center;
            letter-spacing: -0.05em;
            width: 46px;
          }
          .brand-name {
            color: #0F5132;
            font-size: 18px;
            font-weight: 900;
            letter-spacing: 0.02em;
            text-transform: uppercase;
          }
          .brand-subtitle,
          .muted {
            color: #59635B;
            font-size: 10px;
            line-height: 1.45;
          }
          .agency-block,
          .tenant-block,
          .info-box {
            font-size: 11px;
            line-height: 1.42;
          }
          .agency-block strong,
          .tenant-block strong {
            color: #111813;
            display: block;
            font-size: 12px;
            margin-bottom: 3px;
          }
          .doc-title {
            color: #0F5132;
            font-size: 27px;
            font-weight: 900;
            letter-spacing: 0.04em;
            line-height: 1;
            margin: 2px 0 5px;
            text-align: right;
            text-transform: uppercase;
          }
          .doc-meta {
            color: #59635B;
            font-size: 12px;
            line-height: 1.4;
            text-align: right;
          }
          .notice {
            border: 1px solid #DDE4DC;
            border-radius: 7px;
            color: #59635B;
            font-size: 10px;
            line-height: 1.35;
            margin-top: 10mm;
            padding: 8px 9px;
          }
          .parties {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16mm;
            margin: 8mm 0 11mm;
          }
          .reference {
            font-size: 12px;
            font-weight: 800;
            margin-bottom: 6px;
          }
          .section-grid {
            display: grid;
            grid-template-columns: 1.12fr 1fr;
            gap: 14mm;
          }
          .section-title {
            align-items: center;
            color: #0F5132;
            display: flex;
            font-size: 12px;
            font-weight: 900;
            gap: 6px;
            letter-spacing: 0.02em;
            margin: 0 0 8px;
            text-transform: uppercase;
          }
          .section-title::before {
            background: #B8E986;
            border-radius: 999px;
            content: "";
            height: 9px;
            width: 9px;
          }
          .panel {
            background: #F7F8F5;
            border: 1px solid #DDE4DC;
            border-radius: 8px;
            overflow: hidden;
          }
          table {
            border-collapse: collapse;
            width: 100%;
          }
          th {
            background: #EEF2EC;
            color: #59635B;
            font-size: 9px;
            font-weight: 800;
            padding: 7px 9px;
            text-align: left;
            text-transform: uppercase;
          }
          td {
            border-top: 1px solid #DDE4DC;
            font-size: 11px;
            padding: 7px 9px;
            vertical-align: top;
          }
          .amount {
            font-weight: 800;
            text-align: right;
            white-space: nowrap;
          }
          .total-row td {
            background: #E3F3EA;
            color: #0A3622;
            font-size: 12px;
            font-weight: 900;
          }
          .payment-box {
            background: #E3F3EA;
            border: 1px solid #B7D8C5;
            border-radius: 8px;
            margin-top: 8px;
            padding: 9px 10px;
          }
          .payment-box .line {
            display: flex;
            font-size: 11px;
            justify-content: space-between;
            line-height: 1.45;
          }
          .payment-box .due {
            border-top: 1px solid #B7D8C5;
            color: #0A3622;
            font-size: 15px;
            font-weight: 900;
            margin-top: 7px;
            padding-top: 7px;
          }
          .simulation {
            background: #FFF4D6;
            border: 1px solid #E2B453;
            border-radius: 8px;
            color: #6F4300;
            font-size: 11px;
            font-weight: 800;
            line-height: 1.45;
            margin: 9mm 0 0;
            padding: 9px 11px;
          }
          .bottom {
            border-top: 1px dashed #8A938B;
            display: grid;
            grid-template-columns: 35mm 1fr 52mm;
            gap: 10mm;
            margin-top: 16mm;
            padding-top: 9mm;
          }
          .qr-card {
            align-items: center;
            border: 2px solid #0F5132;
            border-radius: 6px;
            display: flex;
            flex-direction: column;
            gap: 5px;
            justify-content: center;
            min-height: 48mm;
            padding: 7px;
            text-align: center;
          }
          .qr-title {
            color: #0F5132;
            font-size: 10px;
            font-weight: 900;
            text-transform: uppercase;
          }
          .qr-svg {
            display: block;
            height: 92px;
            shape-rendering: crispEdges;
            width: 92px;
          }
          .token {
            color: #59635B;
            font-family: "Courier New", monospace;
            font-size: 8px;
            word-break: break-all;
          }
          .signature-box {
            border: 1px solid #DDE4DC;
            display: grid;
            grid-template-columns: 1fr 1fr;
            margin-top: 8px;
            min-height: 28mm;
          }
          .signature-box div {
            color: #59635B;
            font-size: 10px;
            padding: 9px;
          }
          .footer-address {
            font-size: 10px;
            line-height: 1.35;
          }
          .machine-line {
            border-top: 1px solid #111813;
            font-family: "Courier New", monospace;
            font-size: 12px;
            letter-spacing: 0.08em;
            margin-top: 6mm;
            padding-top: 5px;
            text-align: center;
            white-space: nowrap;
          }
          .fine-print {
            bottom: 8mm;
            color: #59635B;
            font-size: 8px;
            left: 18mm;
            line-height: 1.35;
            margin: 0;
            position: absolute;
            right: 18mm;
          }
        </style>
      </head>
      <body>
        <main class="page">
          <section class="top">
            <div>
              <div class="brand-row">
                <div class="mark">A</div>
                <div>
                  <div class="brand-name">ATouPay</div>
                  <div class="brand-subtitle">Gestion loyers & quittances</div>
                </div>
              </div>
              <div class="agency-block">
                <strong>${escapeHtml(agencyName)}</strong>
                Plateforme de suivi locatif et de quittances<br />
                Référence agence: ${escapeHtml(valueOrFallback(receipt.agencyId, 'non renseignée'))}<br />
                Contact propriétaire: ${escapeHtml(valueOrFallback(receipt.ownerEmail, ownerName))}
              </div>
            </div>
            <div>
              <h1 class="doc-title">Quittance de loyer</h1>
              <div class="doc-meta">
                N° ${escapeHtml(receipt.receiptNumber)} du ${escapeHtml(formatDateLabel(paidOrIssuedAt))}<br />
                Émise le ${escapeHtml(formatDateTimeLabel(receipt.issuedAt))}
              </div>
              <div class="notice">
                Cette quittance est générée par AtouPay à partir des informations enregistrées dans le système.
                Elle peut servir de justificatif selon ces informations, sans certification bancaire ou gouvernementale automatique.
              </div>
            </div>
          </section>

          <section class="parties">
            <div>
              <div class="reference">Référence client: ${escapeHtml(receipt.tenantId.slice(0, 12).toUpperCase())}</div>
              <div class="info-box">
                <strong>Adresse du bien principal</strong><br />
                ${escapeHtml(propertyReference)}<br />
                Propriétaire: ${escapeHtml(ownerName)}
              </div>
            </div>
            <div class="tenant-block">
              <strong>${escapeHtml(tenantName)}</strong>
              Locataire enregistré<br />
              ${receipt.tenantEmail ? `${escapeHtml(receipt.tenantEmail)}<br />` : ''}
              ${escapeHtml(propertyReference)}
            </div>
          </section>

          <section class="section-grid">
            <div>
              <h2 class="section-title">Détail de la quittance</h2>
              <div class="panel">
                <table>
                  <thead>
                    <tr>
                      <th>Logement ${escapeHtml(valueOrFallback(receipt.unitLabel, receipt.unitId))}</th>
                      <th class="amount">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${buildLineItems(receipt)}
                    <tr class="total-row">
                      <td>Total encaissé</td>
                      <td class="amount">${escapeHtml(formatCurrency(receipt.grossAmount))}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h2 class="section-title">Situation du compte</h2>
              <div class="panel">
                <table>
                  <thead>
                    <tr>
                      <th>Information</th>
                      <th class="amount">Valeur</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${buildSituationRows(receipt)}
                  </tbody>
                </table>
              </div>
              <div class="payment-box">
                <div class="line">
                  <span>Loyer payé</span>
                  <strong>${escapeHtml(formatCurrency(receipt.grossAmount))}</strong>
                </div>
              </div>
            </div>
          </section>

          ${
            simulated
              ? `
          <section class="simulation">
            Paiement simulé: ce document reflète une opération enregistrée dans ATouPay pour test ou démonstration.
            Aucun débit bancaire réel, encaissement réel ou virement automatique n'a été exécuté.
          </section>
          `
              : ''
          }

          <section class="bottom">
            <div class="qr-card">
              <div class="qr-title">Vérifier</div>
              ${qrSvg ?? '<div class="muted">QR non disponible</div>'}
              <div class="token">${escapeHtml(shortToken)}</div>
            </div>
            <div>
              <div class="footer-address">
                <strong>Vérification publique</strong><br />
                ${escapeHtml(receipt.verificationUrl ?? 'Lien de vérification non disponible')}<br />
                Jeton complet: ${escapeHtml(receipt.qrVerificationToken)}
              </div>
              <div class="signature-box">
                <div>Date et lieu</div>
                <div>Signature / validation</div>
              </div>
            </div>
            <div class="footer-address">
              <strong>Montant: ${escapeHtml(formatCurrency(receipt.grossAmount))}</strong><br /><br />
              ${escapeHtml(tenantName)}<br />
              ${escapeHtml(propertyReference)}<br /><br />
              ATouPay<br />
              Quittance N° ${escapeHtml(receipt.receiptNumber)}
            </div>
          </section>

          <div class="machine-line">
            ${escapeHtml(receipt.receiptNumber)} ${escapeHtml(shortToken)} ${escapeHtml(formatCurrency(receipt.grossAmount))}
          </div>

          <p class="fine-print">
            Document généré par AtouPay le ${escapeHtml(formatDateTimeLabel(receipt.issuedAt))}.
            La vérification confirme uniquement l'existence de cette quittance et les données enregistrées dans le système AtouPay.
            Elle ne constitue pas une certification bancaire, gouvernementale ou judiciaire automatique.
          </p>
        </main>
      </body>
    </html>
  `;
}

export async function exportReceiptPdf(receipt: ReceiptRecord) {
  let qrSvg: string | null = null;

  if (receipt.verificationUrl) {
    try {
      qrSvg = buildReceiptQrSvg(receipt.verificationUrl);
    } catch (error) {
      console.warn('[receipt-pdf] QR generation failed, continuing without QR', error);
    }
  }

  let uri: string;

  try {
    const result = await Print.printToFileAsync({
      html: buildReceiptHtml(receipt, qrSvg),
    });

    uri = result.uri;
  } catch (error) {
    if (!qrSvg) {
      throw error;
    }

    console.warn('[receipt-pdf] PDF generation failed with QR, retrying without QR', error);
    const result = await Print.printToFileAsync({
      html: buildReceiptHtml(receipt, null),
    });

    uri = result.uri;
  }

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      dialogTitle: 'Partager la quittance ATouPay',
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
    });
  }

  return {
    uri,
  };
}
