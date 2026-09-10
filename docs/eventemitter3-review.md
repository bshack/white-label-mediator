# EventEmitter3 5.0.4 implementation review

Reviewed September 9, 2026 against upstream tag `5.0.4`, commit
`b0144e940ace8add8f335a8adfbed9284eb419f3`. The installed runtime, ESM entry,
declarations, and README match that tag byte-for-byte. This review covers the
complete tagged repository: README, runtime and inline documentation, ESM entry,
TypeScript declarations, both test files, all nine benchmark programs and their
README/runner/template, package metadata, Rollup configuration, CI, and license.
It is not a review of every historical issue or unversioned third-party article.

## Findings applied to this adapter

### Appending already preserves an active emission

`emit()` captures either the single listener or the current listener array and
its length before invoking callbacks. `on()` appends to that array or replaces
the single-listener representation with an array. Thus a newly appended listener
does not extend the current emission; a nested emission sees the updated list.
This lets the adapter append through public `on('dispatch', raw, emitter)` without
copying every registration and rebuilding every EventEmitter3 object.

The adapter now caches each channel lazily. Prepend/removal invalidates that cache;
the next emission rebuilds it once. Any emission already in progress keeps its
old channel. Tests cover one-to-two and multi-listener append, prepend/removal
during recursive emission, and cleanup/re-registration during active dispatch.

### Direct removal would change duplicate semantics

EventEmitter3 removes every registration matching the function and optional
context/once filters. Our contract removes one match, scanning from the end.
Passing the same function and emitter context directly to EventEmitter3 removal
would delete duplicates that must survive. Unique forwarding wrappers could
differentiate registrations, but would add allocations and an extra function call
per delivered callback. Keeping our registration list and invalidating a cached
channel is the smaller change, and batches repeated mutations before dispatch.

The context parameter is valuable for `this` binding, but is not a free identity
slot: using a registration object as context would change application callbacks'
receiver unless forwarding wrappers were introduced. We retain the emitter as
the context and avoid unnecessary `bind()` or forwarding calls.

### Native EventEmitter3 once is insufficient for our recursive contract

The upstream once flag removes registrations before calling them, but the saved
outer listener array can still contain an already-fired listener. Reproduced with
the installed 5.0.4 runtime:

```js
const emitter = new EventEmitter3();
const calls = [];
emitter.once('data', () => { calls.push('first'); emitter.emit('data'); });
emitter.once('data', () => calls.push('second'));
emitter.emit('data');
// Raw EventEmitter3: ['first', 'second', 'second']
// Our required contract: ['first', 'second']
```

We keep the existing fired guard and register raw once wrappers with EventEmitter3
`on`, not `once`. This also preserves cancellation, `rawListeners().listener`,
receiver identity, and removal notifications. Existing differential tests assert
the required behavior against Node and npm events, so an upstream change cannot
silently weaken it.

### Bulk cleanup does not need repeated dispatch rebuilding

Upstream can clear storage directly because it has no removal notifications.
The adapter can similarly clear its own channels when no `removeListener`
observers exist. When observers do exist, it still removes in reverse order and
emits notifications after each removal. Cache invalidation avoids rebuilding the
removed event between these notifications. An observer that recursively emits
the changing event can still trigger rebuilds; this cost follows observable work.

### Counting should not allocate a listener array

Upstream `listenerCount()` reads its storage length; `listeners()` returns a copy.
The adapter formerly implemented counts by creating and sometimes filtering that
copy. It now reads registration length directly, or scans without allocating for
a callback-filtered count. Inspection methods still return independent arrays.

### Dispatch cost depends on argument count

The single-listener path specializes zero through five payload arguments; the
multi-listener path specializes zero through three. Larger arities use an argument
array and `apply`. Tests now cover zero through six and ten payloads with one and
multiple listeners, including reference and receiver identity. Benchmarks separate
one-argument and six-argument dispatch and include cold dispatch, preventing a
deferred setup cost from being mistaken for a universally faster operation.

## Compatibility boundaries retained

- Upstream deliberately omits unhandled-error throwing, listener lifecycle
  notifications, listener-limit APIs, and prepend methods. The adapter supplies
  these behaviors; a direct constructor substitution is not equivalent.
- Upstream `removeAllListeners(event)` checks truthiness, so an empty-string event
  takes its all-events path. The adapter keeps its own event map and an explicit
  undefined check, preserving empty-string events and unrelated listeners.
- Public event names remain strings/symbols. The dispatch channel uses the fixed
  name `dispatch`, while the adapter handles prototype-like and numeric-looking
  names and required event-name ordering.
- The upstream ES3 compatibility claim does not apply to our TypeScript output,
  which already uses modern classes, Map, and other platform APIs.
- CJS and ESM exports resolve to the same runtime. Type declarations do not supply
  missing Node functionality in browsers. Release 5.0.4 restored earlier type
  definitions; no dependency or public-type change is needed for this optimization.
- No private `_events`, `_eventsCount`, or EventEmitter3 listener records are read
  or modified by the adapter. The version stays pinned and behavior is checked by
  our regression suite.

## What the upstream benchmarks do not establish

The benchmark README contains historical results including EventEmitter3 0.1.6.
Its benchmark dependencies also include unpinned `latest` packages. Several
workloads measure raw emitter behavior with different compatibility guarantees.
Those figures do not establish the performance of our wrapper, current engines,
or a downstream application. We reviewed their workload design rather than
installing the historical benchmark dependency set. Our harness compares the
actual previous browser emitter and both versions of this adapter with the same
dependency, workloads, runtime, and callback behavior.

See [measured results and remaining costs](events-performance.md). In particular,
individual removal and prepend are still linear; large once batches can still
have quadratic total removal work. This optimization substantially reduces the
original adapter's overhead without claiming to outperform npm events everywhere.

## Primary references

- [Tagged README and API differences](https://github.com/primus/eventemitter3/blob/5.0.4/README.md)
- [Complete runtime and inline documentation](https://github.com/primus/eventemitter3/blob/5.0.4/index.js)
- [Type declarations](https://github.com/primus/eventemitter3/blob/5.0.4/index.d.ts)
- [Upstream tests](https://github.com/primus/eventemitter3/blob/5.0.4/test/test.js)
- [Benchmark source and historical results](https://github.com/primus/eventemitter3/tree/5.0.4/benchmarks)
- [5.0.4 release notes](https://github.com/primus/eventemitter3/releases/tag/5.0.4)
