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

## Replacement assessment

Assessment date: September 9, 2026. Candidate differences below come from their published APIs; candidates were not installed or executed in this change.

| Option | Compatibility assessment |
| --- | --- |
| Keep pinned `events` | Both current backends pass the tested contract. Its README targets Node 11.13's API and describes a small maintenance team. An old release alone does not establish abandonment or a vulnerability. |
| `eventemitter3` | Not a transparent replacement: it documents different unhandled-error and duplicate-removal behavior, and omits listener lifecycle notifications, prepend methods, and maximum-listener APIs. |
| `mitt` | Its smaller `on`/`off`/`emit` API is not the inherited EventEmitter interface. It would require adaptation or an intentional public API change. |
| Native `EventTarget` | Uses `addEventListener`/`removeEventListener`/`dispatchEvent` and event objects; it is not an EventEmitter-compatible substitution. |
| A White Label-owned emitter | Removes the external dependency but transfers implementation, compatibility, security, and maintenance responsibilities to this project. |

Recommendation: retain the pinned dependency for now while using these tests as a replacement acceptance gate. Do not silently substitute another emitter. If removing the dependency is a requirement, choose either a compatibility adapter with equivalent behavior and type tests, or an explicitly approved major release with migration documentation. Before adoption, run the candidate through the contract and downstream browser integration, review its current maintenance/security/license status, and preserve the same choice across Model and Mediator where their contracts require it.

Sources:

- [events source and maintenance statement](https://github.com/browserify/events)
- [EventEmitter3 documented differences](https://github.com/primus/eventemitter3)
- [mitt API](https://github.com/developit/mitt)
- [Node EventTarget and EventEmitter comparison](https://nodejs.org/api/events.html#eventtarget-and-event-api)
