import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const translationsPath = resolve(process.cwd(), 'src/i18n/translations.ts');
const source = readFileSync(translationsPath, 'utf8');

const requiredPhrases = [
  'Bienvenue sur ATouPay',
  'Choisissez votre espace',
  'Payer mon loyer',
  'Voir ma quittance',
  'Mon compte',
  'Voir mes unités',
  'Inviter un locataire',
  'Ajouter un propriétaire',
  'Voir les comptes',
  'Aider les clients',
  'Paiement simulé',
  'Télécharger / partager le PDF',
  'Se déconnecter',
  'Conditions d’utilisation',
  'Aide & support',
];

function getObjectBlock(name) {
  const start = source.indexOf(`const ${name}: Record<string, string> = {`);

  if (start < 0) {
    throw new Error(`Missing ${name} dictionary`);
  }

  const end = source.indexOf('\n};', start);

  if (end < 0) {
    throw new Error(`Missing ${name} dictionary closing brace`);
  }

  return source.slice(start, end);
}

const enBlock = getObjectBlock('enCopy');
const arBlock = getObjectBlock('arCopy');

const missing = [];

for (const phrase of requiredPhrases) {
  if (!enBlock.includes(phrase)) {
    missing.push(`enCopy: ${phrase}`);
  }

  if (!arBlock.includes(phrase)) {
    missing.push(`arCopy: ${phrase}`);
  }
}

if (missing.length > 0) {
  throw new Error(`Missing required i18n phrases:\n${missing.join('\n')}`);
}

const enCount = (enBlock.match(/:\s*'/g) ?? []).length + (enBlock.match(/:\s*"/g) ?? []).length;
const arCount = (arBlock.match(/:\s*'/g) ?? []).length + (arBlock.match(/:\s*"/g) ?? []).length;

if (enCount < 120 || arCount < 120) {
  throw new Error(`Expected broad i18n dictionaries, got en=${enCount}, ar=${arCount}`);
}

console.log(`i18n coverage check passed: en=${enCount}, ar=${arCount}`);
