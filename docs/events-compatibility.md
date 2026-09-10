# Event backend compatibility

## Runtime selection

Node entry points use `node:events`, preserving native inheritance, static helpers, and public types. The package's `browser` mapping replaces `dist/event-emitter.js` with `dist/browser-event-emitter.js` in browser-aware bundlers. That adapter uses pinned `eventemitter3@5.0.4` for dispatch. `events@3.3.0` is retained only as a development dependency to compare the previous browser behavior; it is no longer a production dependency.

Consumers must use a bundler that honors the `browser` field. Loading CommonJS output directly in a browser is not supported. Current Node type declarations do not imply that every Node feature exists in the browser.

## Preserved behavior

The same contract cases run through Model/Collection or Mediator with Node, the previous npm browser emitter, and the new adapter:

- Synchronous ordered dispatch, original payload references, receiver identity, and boolean emit results.
- Listener aliases and chaining; once listeners, cancellation, and recursive emission.
- Removal of only the most recently registered duplicate.
- Stable listener snapshots while dispatch is in progress.
- String and symbol events, prepend APIs, listener inspection, and scoped/all removal.
- Listener lifecycle notifications and unhandled error propagation.
- Listener validation and per-instance listener limits.
- Lifecycle cleanup; Model/Collection mutation ordering, silent operations, validation, and cross-backend namespaced relay.

Additional differential tests cover numeric/prototype-like/empty event names, raw once wrappers, teardown order, and the inherited static `once`, `listenerCount`, and `EventEmitter` helpers. Adapter tests check listener-limit warnings and cleanup. Node 24 and the previous browser package differ in the callback reported during bulk removal of a once listener; each backend retains its existing behavior.

This contract does not claim every modern Node feature in browsers. Capture-rejection options, Node-only static helpers, internal `_events` access, exact error text, and legacy constructor initialization internals are outside the supported browser contract. Node builds retain their native behavior. Browser listener-limit warnings use `console.warn`, as the previous browser implementation did.

## Adapter design and ownership

Each event has a registration list and a lazily cached EventEmitter3 dispatch channel. Ordinary additions append to an existing channel through the public API. Removal or prepend invalidates the cache; the next emission rebuilds it once. Active emissions retain their original dispatch snapshot. Once wrappers remove themselves before calling application code and guard against repeated invocation during recursion. Bulk cleanup clears channels directly when no removal observers exist; otherwise it preserves reverse-order notifications. The adapter does not modify EventEmitter3's internals or global module resolution.

Appending a registration is amortized constant work. Prepending and individual removal still cost linear work in the listener count; the first emission after cache invalidation also costs linear setup. Repeated invalidations before dispatch coalesce into one rebuild. Listener counting without a callback filter no longer allocates an array. See [measured performance](events-performance.md) and [the EventEmitter3 source review](eventemitter3-review.md): the optimized adapter is substantially faster than the original adapter for many mutation workloads, but does not consistently beat the previous browser emitter.

Model and Mediator contain identical adapter source and adapter tests. Keep these copies synchronized when fixing compatibility behavior. This avoids introducing a new shared package or forcing Model to depend on a particular Mediator release, but creates an explicit maintenance responsibility.

## Validation

Run `npm test`, `npm run typecheck`, and `npm run coverage`. The 100% per-file coverage gate includes the adapter. The compatibility loader substitutes only the local event-backend boundary, using an isolated cache and original source-map coordinates; ordinary tests exercise the real Node entry point.

`test/browser-smoke.js` is a browser-bundler entry point that imports the package normally. Bundle it with a browser-aware bundler, load the output in a browser, and check `globalThis.whiteLabelSmokePassed === true`. For example, with esbuild installed in a temporary tooling directory:

```sh
esbuild test/browser-smoke.js --bundle --platform=browser --outfile=/tmp/white-label-smoke.js
```

Load that output from a local HTML page with a script tag. A thrown error or missing success flag indicates failure. The smoke test covers dispatch, duplicate removal, prepend/once, reentrancy, errors, and destruction. Inspect the bundle input list to confirm EventEmitter3 is included and `events` is absent.

The implementation was validated with Node 24.19.0, esbuild browser bundles, and smoke tests in the Codex in-app browser. This is not a complete browser-version or bundler matrix. Full downstream applications and performance have not been tested.

## Dependency review

EventEmitter3 5.0.4 is MIT-licensed. Its documented API differences require the adapter; replacing imports directly fails the existing contract. Installation audits reported no known vulnerabilities. That is a point-in-time check, not a security guarantee.

- [EventEmitter3 source, license, and API differences](https://github.com/primus/eventemitter3)
- [Previous browser emitter](https://github.com/browserify/events)
- [Node EventEmitter API](https://nodejs.org/api/events.html)
