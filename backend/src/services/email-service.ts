import { Resend } from 'resend';

import type { AppConfig } from '../config/env.js';

interface EmailLogger {
  info(input: Record<string, unknown>, message: string): void;
  warn(input: Record<string, unknown>, message: string): void;
}

export interface OwnerAccessInviteEmailInput {
  agencyName: string;
  email: string | null;
  expiresAt: string;
  inviteCode: string;
  inviteLink: string;
}

export interface TenantInviteEmailInput {
  email: string | null;
  expiresAt: string;
  inviteCode: string;
  inviteLink: string;
  ownerName: string;
  propertyLabel: string;
  unitLabel: string;
}

export interface InviteEmailService {
  sendOwnerAccessInvite(input: OwnerAccessInviteEmailInput): Promise<void>;
  sendTenantInvite(input: TenantInviteEmailInput): Promise<void>;
}

export const noopInviteEmailService: InviteEmailService = {
  async sendOwnerAccessInvite() {},
  async sendTenantInvite() {},
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatExpiry(value: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(value));
}

function buildEmailHtml(input: {
  body: string[];
  code: string;
  expiresAt: string;
  inviteLink: string;
  title: string;
}) {
  const paragraphs = input.body
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join('');
  const code = escapeHtml(input.code);
  const inviteLink = escapeHtml(input.inviteLink);

  return [
    '<div style="font-family:Inter,Arial,sans-serif;color:#17251d;line-height:1.55">',
    `<h1 style="font-size:22px;margin:0 0 16px">${escapeHtml(input.title)}</h1>`,
    paragraphs,
    '<div style="margin:20px 0;padding:16px;border:1px solid #d8e4dc;border-radius:14px;background:#f6fbf7">',
    '<p style="margin:0 0 8px;color:#607066">Code d’invitation</p>',
    `<p style="font-size:24px;font-weight:700;letter-spacing:0.04em;margin:0">${code}</p>`,
    '</div>',
    `<p><a href="${inviteLink}" style="color:#007a52;font-weight:700">Ouvrir l’invitation ATouPay</a></p>`,
    `<p style="color:#607066;font-size:13px">Cette invitation est à usage unique et expire le ${escapeHtml(formatExpiry(input.expiresAt))} UTC.</p>`,
    '<p style="color:#607066;font-size:13px">Les paiements ATouPay restent simulés dans cette version: aucun débit réel n’est effectué.</p>',
    '</div>',
  ].join('');
}

function buildEmailText(input: {
  body: string[];
  code: string;
  expiresAt: string;
  inviteLink: string;
  title: string;
}) {
  return [
    input.title,
    '',
    ...input.body,
    '',
    `Code d’invitation: ${input.code}`,
    `Lien: ${input.inviteLink}`,
    `Expiration: ${formatExpiry(input.expiresAt)} UTC`,
    '',
    'Cette invitation est à usage unique.',
    'Les paiements ATouPay restent simulés dans cette version: aucun débit réel n’est effectué.',
  ].join('\n');
}

export function createInviteEmailService(
  config: AppConfig,
  logger?: EmailLogger,
): InviteEmailService {
  if (!config.isEmailEnabled || !config.resendApiKey || !config.emailFrom) {
    logger?.info(
      {
        enabled: false,
      },
      'invite-email-disabled',
    );
    return noopInviteEmailService;
  }

  const resend = new Resend(config.resendApiKey);

  async function send(input: {
    html: string;
    subject: string;
    tags: Array<{ name: string; value: string }>;
    text: string;
    to: string | null;
  }) {
    if (!input.to) {
      return;
    }

    try {
      const response = await resend.emails.send({
        from: config.emailFrom!,
        html: input.html,
        ...(config.emailReplyTo ? { replyTo: config.emailReplyTo } : {}),
        subject: input.subject,
        tags: input.tags,
        text: input.text,
        to: input.to,
      });

      if (response.error) {
        logger?.warn(
          {
            error: response.error.message,
            name: response.error.name,
            to: input.to,
          },
          'invite-email-send-failed',
        );
        return;
      }

      logger?.info(
        {
          emailId: response.data?.id ?? null,
          to: input.to,
        },
        'invite-email-sent',
      );
    } catch (error) {
      logger?.warn(
        {
          err: error,
          to: input.to,
        },
        'invite-email-send-failed',
      );
    }
  }

  return {
    async sendOwnerAccessInvite(input) {
      const title = 'Votre invitation propriétaire ATouPay';
      const body = [
        `${input.agencyName} vous invite à activer un espace propriétaire ATouPay.`,
        'Connectez-vous avec Google ou e-mail, puis saisissez ce code si le lien ne s’ouvre pas automatiquement.',
      ];

      await send({
        html: buildEmailHtml({
          body,
          code: input.inviteCode,
          expiresAt: input.expiresAt,
          inviteLink: input.inviteLink,
          title,
        }),
        subject: title,
        tags: [{ name: 'type', value: 'owner_access_invite' }],
        text: buildEmailText({
          body,
          code: input.inviteCode,
          expiresAt: input.expiresAt,
          inviteLink: input.inviteLink,
          title,
        }),
        to: input.email,
      });
    },
    async sendTenantInvite(input) {
      const title = 'Votre invitation locataire ATouPay';
      const body = [
        `${input.ownerName} vous invite à rejoindre ${input.propertyLabel} - ${input.unitLabel} sur ATouPay.`,
        'Connectez-vous avec Google ou e-mail, puis saisissez ce code si le lien ne s’ouvre pas automatiquement.',
      ];

      await send({
        html: buildEmailHtml({
          body,
          code: input.inviteCode,
          expiresAt: input.expiresAt,
          inviteLink: input.inviteLink,
          title,
        }),
        subject: title,
        tags: [{ name: 'type', value: 'tenant_invite' }],
        text: buildEmailText({
          body,
          code: input.inviteCode,
          expiresAt: input.expiresAt,
          inviteLink: input.inviteLink,
          title,
        }),
        to: input.email,
      });
    },
  };
}
