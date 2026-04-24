# Contributing

## Development Checks

Run the relevant checks before opening a pull request:

```bash
npm run typecheck
cd backend
npm run typecheck
npm test
```

## Security Requirements

- Do not commit secrets, local env files, service-account JSON, keystores, or generated credentials.
- Validate backend inputs with the existing schema patterns.
- Keep payment wording accurate: payments are simulated until a real provider is integrated and verified.
- Keep changes scoped to the behavior being changed.

## Pull Requests

Use the pull request template and include the validation commands you ran.
