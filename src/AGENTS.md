# white-label-mediator source instructions

These instructions are more specific than the repository-root agent guide for files under `src/`.

## Mediator 5 public contract

- Mediator is a small application event boundary built directly on native `EventTarget`, `CustomEvent`, and listener options. Preserve those semantics instead of creating a parallel event API.
- Keep the package independently useful. Existing server-rendered applications, progressively enhanced page regions, Node.js modules, and framework-based applications should be able to use Mediator without adopting any other White Label package.
- Treat incremental adoption as a first-class use case: modules may be introduced one feature at a time, so event naming and listener ownership must not assume one global application bootstrap or one framework runtime.
- Mediator moves application intent; it does not own state, rendering, routing, networking, persistence, retries, queues, or cross-process delivery.
- Do not turn the core package into adapters for React/Vue/SFCC/CMS/cloud services when the standards-based EventTarget contract is sufficient. Product-specific vocabulary belongs in application subclasses or consuming code.
- Preserve synchronous delivery and native `dispatchEvent()` cancellation semantics. The boolean return value is not a listener-count signal.
- Preserve deterministic cleanup. `destroy()` releases listeners owned by the Mediator while caller-provided `AbortSignal` behavior remains native and independently effective.
- Optional TypeScript event-detail maps are compile-time ergonomics only. Do not silently add runtime payload validation to `dispatchEvent()`.

## Verification

Run lint, build/type checks, runtime tests, 100% per-file coverage, audit, packed-package, npm/Yarn/pnpm, and supported-Node checks before treating a source change as release-ready. Do not weaken EventTarget compatibility or cleanup assertions to satisfy an implementation change.
