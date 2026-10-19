# Contributing

Thanks for improving `white-label-mediator`.

## Setup

Use Node.js `^22.18.0 || >=24.11.0` (CI uses Node 24 and also runs the tests on 22.18.0) and npm 11 or newer. Run commands from the repository root.

```sh
npm ci --ignore-scripts
```

## Checks

While iterating:

```sh
npm run build && node --test test/mediator.test.js
```

Before opening a pull request, run the full gate:

```sh
npm run lint && npm run coverage && npm run audit
```

- `npm run lint` fails on any warning.
- `npm run coverage` builds `dist/` (which typechecks `src/`), type-checks the consumer tests in `test-types/` with the DOM lib (`tsconfig.consumer.json`) and without it (`tsconfig.consumer-node.json`), runs every test in `test/`, and requires 100% statement, branch, function, and line coverage per source file. It covers `npm run typecheck` and `npm test`, so they need no separate run.
- `npm run audit` fails on high or critical advisories.

CI additionally runs `npm pack --dry-run --ignore-scripts`, then installs the packed tarball with npm, Yarn, and pnpm and checks that it delivers an event. To inspect the package contents locally, run `npm pack --dry-run --ignore-scripts` after the gate.

`dist/` is tracked and the build rewrites it. If you did not mean to change it, restore it before reviewing your diff with `git checkout -- dist` and remove any new untracked files under `dist/`.

## Benchmarks

```sh
npm run benchmark
```

The benchmark compares Mediator with native `EventTarget` and Node's `EventEmitter`. It is diagnostic only, is not part of the gate or CI, and is slow: a full run takes more than 30 minutes, mostly because Node's native `EventTarget` baseline is quadratic in two of the measured cases. Run it only when you are working on performance, and expect most of the time to go to the native baseline rows.

## Pull requests

Keep changes focused, preserve the documented standards-based EventTarget contract, and avoid adding runtime coupling to other White Label packages. Add or update tests when behavior changes, and do not weaken coverage, lint, type, or security checks to make a change pass.

Before requesting review, inspect the complete diff for unintended `dist/` changes, credentials, private data, debugging code, and unrelated formatting changes. Breaking public API changes require a SemVer major release rather than compatibility shims.

## Security

Do not include exploit details, credentials, secrets, or private data in public issues. Follow `SECURITY.md` for suspected vulnerabilities.
