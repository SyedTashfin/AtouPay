# Security Policy

## Supported Branches

Security fixes are applied to `main` unless a release branch is explicitly created.

## Reporting a Vulnerability

Do not open a public issue for secrets, authentication bypasses, payment-flow defects, or data-access issues.

Use a private GitHub security advisory when available, or contact the repository owner directly with:

- affected role or endpoint
- reproduction steps
- expected and actual access boundaries
- logs or screenshots with secrets redacted

## Secret Handling

Never commit local env files, Firebase service-account JSON files, keystores, mobile provisioning credentials, or payment-provider credentials. Local examples must use placeholders only.
