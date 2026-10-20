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

- `npm run lint` checks `src/`, `test/`, and `benchmark/` and fails on any warning.
- `npm run coverage` builds `dist/` (which typechecks `src/`), type-checks the consumer tests in `test-types/` with the DOM lib (`tsconfig.consumer.json`) and without it (`tsconfig.consumer-node.json`), runs every test in `test/`, and requires 100% statement, branch, function, and line coverage per source file. It covers `npm run typecheck` and `npm test`, so they need no separate run.
- `npm run audit` fails on high or critical advisories.

CI additionally runs `npm run bench:ci` (see below), the Chromium check (`npm run test:browser`, below), `npm pack --dry-run --ignore-scripts`, then installs the packed tarball with npm, Yarn, and pnpm and checks that it delivers an event. To inspect the package contents locally, run `npm pack --dry-run --ignore-scripts` after the gate.

`dist/` is build output and is not tracked in git; the build, the test scripts, and the `prepare` script (which runs for git installs and `npm pack`) regenerate it.

### Browser check

```sh
npm run build && npm run test:browser
```

Bundles the built package with esbuild and runs `test/browser/page-checks.js` in a real Chromium page through Playwright: EventTarget subclassing, `CustomEvent.detail`, `once`, capture matching, `passive`, AbortSignal removal and dependent-signal caching, listener errors reported through the window `error` event, and `destroy()`. It is not part of `npm test` or coverage. It needs a Chromium: run `npx playwright install chromium` once, or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to an existing Chromium binary.

## Benchmarks

```sh
npm run benchmark
```

The benchmark compares Mediator with native `EventTarget` and Node's `EventEmitter`. It is diagnostic only, enforces no thresholds, and takes a few seconds. Node's native `EventTarget` is quadratic in two signal cases (shared signal add + abort, duplicate add with signal), so their native baseline columns are skipped by default; include them with `npm run benchmark -- --include-native-quadratic`, which takes more than 30 minutes.

```sh
npm run bench:ci
```

The short CI benchmark measures only Mediator paths (dispatch to 1 and 10 listeners, add + remove, `once`, signal add + remove, `destroy()`) in a few seconds and compares the median time per operation with `benchmark/baseline.json`. It fails when a case is more than 3x slower than the baseline (a deliberately generous margin for runner noise) or when the `AbortSignal.any()` call counts, which are deterministic, differ. After an intended performance change, refresh the baseline on a quiet machine with `npm run bench:ci -- --update-baseline` and commit `benchmark/baseline.json`.

## Pull requests

Keep changes focused, preserve the documented standards-based EventTarget contract, and avoid adding runtime coupling to other White Label packages. Add or update tests when behavior changes, and do not weaken coverage, lint, type, or security checks to make a change pass.

Before requesting review, inspect the complete diff for credentials, private data, debugging code, and unrelated formatting changes. Breaking public API changes require a SemVer major release rather than compatibility shims.

## Security

Do not include exploit details, credentials, secrets, or private data in public issues. Follow `SECURITY.md` for suspected vulnerabilities.
