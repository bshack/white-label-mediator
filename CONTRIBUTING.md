# Contributing

Thanks for improving `white-label-mediator`.

## Setup

Use the Node and npm versions documented in `README.md` and `package.json`.

```sh
npm ci --ignore-scripts
npm run lint
npm run typecheck
npm test
npm run coverage
npm run audit
npm pack --dry-run
```

## Pull requests

Keep changes focused, preserve the documented EventEmitter-compatible contract, and avoid adding runtime coupling to other White Label packages. Add or update tests when behavior changes, and do not weaken coverage, lint, type, or security checks to make a change pass.

Before requesting review, inspect the complete diff for generated-file drift, credentials, private data, debugging code, and unrelated formatting changes. Breaking public API changes require a SemVer major release rather than compatibility shims.

## Security

Do not include exploit details, credentials, secrets, or private data in public issues. Follow `SECURITY.md` for suspected vulnerabilities.