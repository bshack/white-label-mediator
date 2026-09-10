# EventEmitter compatibility and dependency assessment

## Runtime resolution

White Label imports `events`. Node resolves that name to its built-in EventEmitter; browser bundlers resolve the installed `events` npm package. The lockfile currently selects `events@3.3.0`. Tests that only run the normal package import under Node do not verify the npm implementation.

## Contract under test

`test/events-compatibility.test.js` exercises compiled White Label classes against both implementations using the same contract cases. Preserve these existing behaviors when evaluating replacements:

- Synchronous, ordered dispatch; listeners receive the emitter as `this`, all arguments, and the original payload references. `emit()` returns whether listeners handled the event.
- `on`/`addListener`, `once`, `removeListener`/`off`, scoped and complete `removeAllListeners`, and chaining where the inherited API returns the emitter.
- One-time listeners are removed before invocation, including recursive emission; their original callback can cancel them before execution.
- Duplicate registrations remain distinct; one removal removes the most recently registered match.
- Adding/removing listeners during an emission affects subsequent emissions without changing the current listener snapshot.
- String and symbol event names, prepend methods, `eventNames`, `listeners`, `rawListeners`, and `listenerCount`.
- `newListener` notification before insertion and `removeListener` notification after removal.
- Unhandled `error` events throw; handled errors reach their listeners; exceptions thrown by listeners propagate synchronously.
- Listener argument validation and per-instance maximum-listener settings.

The package-specific cases also cover lifecycle cleanup. Model/Collection cases cover mutation order, full-state payload identity, silent mutations, invalid Model updates, array/Map collections, and local/namespaced relay using each combination of the two event backends. State teardown must not unsubscribe unrelated mediator listeners.

This is a regression contract for existing behavior, not a complete implementation of every Node EventEmitter feature. Newer Node-only static helpers, promise rejection capture, exact diagnostics/warning delivery, and every overload are not asserted to work in browsers. Public types inherited from current Node declarations are not by themselves evidence of browser support.

## How the tests select the implementation

The helper explicitly loads `require('events/')` to bypass built-in-module precedence and asserts that it is a different constructor from `require('node:events')`. It loads compiled package modules with an isolated module cache and substitutes only the `events` import. The tests assert that the resulting instances inherit the selected constructor. Global module resolution and the regular tests' require cache are not modified.

The loader uses `vm.compileFunction` with the original filename and source, preserving source-map coordinates for the existing c8 gate. Only local `dist` imports and the selected event backend are allowed; unexpected dependencies fail the test.

Run `npm test` or `npm run coverage`; the regular `test/*.test.js` command discovers these tests automatically. To run just the compatibility suite after building:

```sh
node --test test/events-compatibility.test.js
```

These are dependency-contract tests under Node, not real-browser or bundler tests. They do not establish full browser support, dependency security, or 100% coverage of the third-party emitter. The existing c8 requirement applies to White Label implementation files and remains unchanged.

## Decision after source review (September 10, 2026)

Retain pinned `events@3.3.0` as the runtime dependency. Node resolves the direct `events` import to its built-in module; browser bundlers resolve the npm implementation. The EventEmitter3 adapter and browser override have been removed. The previous adapter implementation and measurements remain in Git history.

The review covered the complete events runtime and test sources, README, changelog, security policy, and upstream history. The old implementation already specializes single-listener storage and supports inexpensive registration and cleanup. Earlier synthetic measurements did not establish a consistent adapter advantage. An isolated full-API minified browser comparison produced 2,126 gzip bytes for events versus 2,245 for the optimized adapter plus EventEmitter3; this is not a full-application size estimate.

Regression tests now protect two behaviors the adapter missed: direct raw once-wrapper invocation returns the callback result, and `removeAllListeners(undefined)` preserves unrelated events. The latter is different from calling `removeAllListeners()` with no arguments; an explicitly supplied undefined addresses the string-coerced event name `undefined` in the retained backend. Wrapper helpers must preserve argument count if they intend to forward these semantics.

### Symbol cleanup notifications

In events 3.3.0, `removeAllListeners()` removes symbol listeners but does not send their `removeListener` notifications. Current Node does send those notifications. Explicit `removeListener(symbol, callback)` or `removeAllListeners(symbol)` sends the notification in both backends. Tests cover the existing difference and the explicit-removal path.

If cleanup depends on observing a symbol listener's removal, remove that listener explicitly before bulk cleanup or destruction. Prefer explicit resource cleanup over relying on removal notifications. Component teardown should remove only its own callbacks from a shared mediator. We retain upstream behavior rather than introducing a custom emitter or patching dependencies.

### Maintenance and API limits

Upstream's latest reviewed commit is from February 27, 2021; the runtime matches release 3.3.0. This raises maintenance and modern-API coverage concerns, but does not by itself establish a vulnerability. The MIT-licensed package has no runtime dependencies. Its README targets the Node 11.13 API, and its changelog also records EventTarget support in static `once` from Node 12.11. Current Node types do not guarantee equivalent browser support for newer helpers or rejection capture. Historical browser-test configuration is not evidence of a current browser-version matrix.

Before reconsidering a replacement, require compatible regression results and representative downstream workload and bundle measurements. Keep the backend decision consistent across Model and Mediator.

### Browser verification

`test/browser-smoke.js` imports the package normally. Bundle with a browser-aware bundler, for example:

```sh
esbuild test/browser-smoke.js --bundle --platform=browser --metafile=/tmp/white-label-meta.json --outfile=/tmp/white-label-smoke.js
```

Load the bundle as a script in a browser and check `globalThis.whiteLabelSmokePassed === true`. Inspect the metafile to confirm the npm `events/events.js` implementation is included and EventEmitter3 is absent. The smoke covers dispatch, duplicate removal, recursive once, raw once return values, explicit undefined, explicit symbol removal notifications, errors, and destruction. This does not replace downstream application testing or establish a complete browser matrix.

### Validation of the retained implementation

On September 10, 2026, Node 24.19.0 passed all 41 package tests, consumer type tests, typechecking, and the 100% per-file coverage gate. Rebuilding produced identical dist output. Package dry runs contained no adapter artifacts. esbuild 0.25.10 bundle manifests included npm events and excluded EventEmitter3; both package smoke tests passed in the Codex in-app browser. Clean locked installations reported zero known vulnerabilities. No dedicated lint or formatter is configured; whitespace checks passed. No full downstream application or browser-version matrix was run.

Sources:

- [events 3.3.0 source](https://github.com/browserify/events/blob/v3.3.0/events.js)
- [Changelog, including the raw once return-value fix](https://github.com/browserify/events/blob/v3.3.0/History.md)
- [Upstream history](https://github.com/browserify/events/commits/main/)
- [Security policy](https://github.com/browserify/events/blob/main/security.md)
