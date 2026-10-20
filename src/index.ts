/** @module src/index */

// A listener function for one event name. The method-property form makes TypeScript
// check the event parameter bivariantly, the same way the DOM's own listener types
// do, so ordinary `(event: CustomEvent<Detail>) => void` callbacks are accepted.
type EventListenerFor<Detail> = {bivarianceHack(event: CustomEvent<Detail>): void}['bivarianceHack'];

// These two types appear in the published declarations. They copy the shape of the
// DOM's EventListenerObject and AddEventListenerOptions using only names that both
// the DOM lib and @types/node declare, so projects without the DOM lib still compile.
/** A listener object: any object with a `handleEvent(event)` method. */
type EventListenerObjectLike = {handleEvent(object: Event): void};
/** Options accepted by `addEventListener()`: `capture`, `once`, `passive`, and `signal`. */
type AddListenerOptions = EventListenerOptions & {
    once?: boolean;
    passive?: boolean;
    signal?: AbortSignal;
};
type Listener = EventListenerOrEventListenerObject;

// addEventListener() options after converting each field to its final value.
type ListenerOptions = {
    capture: boolean;
    once: boolean;
    passive: boolean;
    signal?: AbortSignal;
};

// What Mediator remembers about one registration. `callback` is what the caller
// passed (and will pass again to remove it); `listener` is what was actually given
// to EventTarget, which is either the callback itself or a wrapper around it.
type ListenerRecord = {
    type: string;
    callback: Listener;
    listener: Listener;
    capture: boolean;
    signal?: AbortSignal;
};

// The registrations that share one caller signal, plus the abort handler that
// removes them all. `signal` is the private dependent signal, not the caller's.
type SignalRecord = {
    signal: AbortSignal;
    listeners: Set<ListenerRecord>;
    abort: EventListener;
};

// The native `aborted` getter. Calling it directly reads the real abort state and
// throws for anything that is not a genuine AbortSignal, even if the caller's object
// overrides or fakes an `aborted` property.
const abortSignalAborted = Object.getOwnPropertyDescriptor(AbortSignal.prototype, 'aborted')!.get!;

// Caller signal -> the private signal Mediator listens to for it. Each call to
// AbortSignal.any() adds an entry to the source signal's internal list of dependants,
// so creating a fresh one every time a long-lived signal gains a listener would grow
// memory without bound. Instead one is created per caller signal and reused by every
// registration and every mediator. The WeakMap lets both be garbage-collected.
const dependentSignals = new WeakMap<AbortSignal, AbortSignal>();

/** Return the shared dependent signal for `signal`, creating it on first use. */
function getDependentSignal(signal: AbortSignal) {
    let dependentSignal = dependentSignals.get(signal);
    if (!dependentSignal) {
        dependentSignal = AbortSignal.any([signal]);
        dependentSignals.set(signal, dependentSignal);
    }
    return dependentSignal;
}

/**
 * A synchronous application event bus built on the native `EventTarget`.
 *
 * Send data in `CustomEvent.detail`. Mediator keeps a record of every listener added
 * through it, so `destroy()` can remove them all at once and the instance stays
 * reusable afterwards.
 *
 * @typeParam Events - Optional map of event name to `detail` type. It only affects
 * type checking: listener registration is limited to the map's names and listeners
 * receive the matching `CustomEvent<Detail>`. Nothing is validated at runtime.
 */
class Mediator<Events extends object = Record<string, unknown>> extends EventTarget {
    // Registrations by event type, then by original callback: one map for bubble
    // listeners and one for capture listeners. EventTarget treats the same callback
    // in each capture mode as a separate listener, and so does this lookup.
    #bubbleRegistrations = new Map<string, Map<Listener, ListenerRecord>>();
    #captureRegistrations = new Map<string, Map<Listener, ListenerRecord>>();
    #signals = new Map<AbortSignal, SignalRecord>();
    // Each dispatchEvent() call gets a new, increasing token. #dispatchToken holds
    // the token of the innermost dispatch currently running, or 0 when none is.
    #dispatchToken = 0;
    #nextDispatchToken = 0;

    /**
     * Lifecycle hook for symmetry with other White Label components. It does nothing
     * else; the mediator is ready to use as soon as it is constructed.
     *
     * @returns This mediator, for chaining.
     */
    initialize() {
        return this;
    }

    /**
     * Add a listener, exactly like `EventTarget.addEventListener()`, and record it so
     * `destroy()` can remove it later.
     *
     * Adding the same callback for the same type and capture mode again does nothing.
     * A listener added while an event is being dispatched does not run for that
     * dispatch, matching browser behaviour.
     *
     * @param type - Event name. With a typed event map, only names in the map are allowed.
     * @param callback - Function or `{handleEvent}` object to call. `null` and
     *   `undefined` are ignored.
     * @param options - `true`/`false` for capture, or an object with `capture`, `once`,
     *   `passive`, and `signal`. Aborting `signal` removes the listener; an
     *   already-aborted signal means the listener is never added.
     * @throws TypeError if fewer than two arguments are passed, `callback` is not a
     *   function, object, `null`, or `undefined`, `type` is a symbol, or `signal` is
     *   not an AbortSignal.
     */
    override addEventListener<Name extends keyof Events & string>(
        type: Name,
        callback: EventListenerFor<Events[Name]> | EventListenerObjectLike | null,
        options?: boolean | AddListenerOptions
    ): void;
    override addEventListener(
        type: string,
        callback: Listener | null,
        options?: boolean | AddListenerOptions
    ): void {
        if (arguments.length < 2) {throw new TypeError('addEventListener requires a type and callback.');}

        const normalizedType = typeof type === 'string' ? type : `${type}`;
        const normalizedCallback = this.#normalizeCallback(callback);
        const normalized = this.#normalizeAddOptions(options);
        const signalAborted = normalized.signal === undefined
            ? false
            : Boolean(Reflect.apply(abortSignalAborted, normalized.signal, []));

        if (!normalizedCallback) {return;}
        if (this.#getRecord(normalizedType, normalizedCallback, normalized.capture)) {return;}
        if (signalAborted) {return;}

        const thisMediator = this;
        // If a dispatch is running, remember the highest token issued so far. Every
        // dispatch already in progress has a token at or below it; any dispatch that
        // starts later gets a higher one. 0 means no dispatch needs to be skipped.
        const blockedThroughToken = this.#dispatchToken === 0 ? 0 : this.#nextDispatchToken;
        // Plain function listeners with no special handling are registered directly,
        // which keeps the common case as fast as native EventTarget.
        const needsWrapper = normalized.once
            || normalized.signal !== undefined
            || typeof normalizedCallback !== 'function'
            || blockedThroughToken !== 0;
        const listener: Listener = needsWrapper
            ? function(this: EventTarget, event: Event) {
                // Browsers dispatch to a copy of the listener list taken when the
                // dispatch starts. Node walks the live list, so a listener added
                // mid-dispatch could run in that same dispatch. Skip any dispatch
                // that was already running when this listener was added; nested
                // dispatches that start later have higher tokens and do run it.
                const dispatchToken = thisMediator.#dispatchToken;
                if (dispatchToken !== 0 && dispatchToken <= blockedThroughToken) {return;}
                if (normalized.signal !== undefined
                    && Boolean(Reflect.apply(abortSignalAborted, normalized.signal, []))) {return;}
                // Remove a once listener before calling it, so it is gone even if
                // it throws or dispatches the same event again.
                if (normalized.once) {thisMediator.#removeRecord(record);}
                if (typeof normalizedCallback === 'function') {
                    normalizedCallback.call(this, event);
                } else {
                    // Look up handleEvent on every call, as browsers do.
                    const handleEvent = normalizedCallback.handleEvent;
                    handleEvent.call(normalizedCallback, event);
                }
            }
            : normalizedCallback;
        const record: ListenerRecord = normalized.signal === undefined
            ? {type: normalizedType, callback: normalizedCallback, listener, capture: normalized.capture}
            : {
                type: normalizedType,
                callback: normalizedCallback,
                listener,
                capture: normalized.capture,
                signal: normalized.signal
            };

        // `once` and `signal` are handled by Mediator, not passed to EventTarget, so
        // its own records stay in step with what is registered. Listener objects are
        // always wrapped so Node never reads handleEvent during registration, where a
        // user-defined getter could run code (for example, abort the signal) midway.
        super.addEventListener(normalizedType, listener, {
            capture: normalized.capture,
            passive: normalized.passive
        });
        this.#storeRecord(record);

        if (normalized.signal !== undefined) {
            this.#trackSignal(normalized.signal, record);
        }
    }

    /**
     * Remove a listener, exactly like `EventTarget.removeEventListener()`. A listener
     * matches when the type, callback, and capture mode are the same as when it was
     * added; `once`, `passive`, and `signal` do not matter. Removing a listener that
     * is not registered does nothing.
     *
     * @param type - Event name used when the listener was added.
     * @param callback - The same function or object that was added. `null` and
     *   `undefined` are ignored.
     * @param options - `true`/`false` for capture, or an object with `capture`.
     * @throws TypeError if fewer than two arguments are passed, `callback` is not a
     *   function, object, `null`, or `undefined`, or `type` is a symbol.
     */
    override removeEventListener<Name extends keyof Events & string>(
        type: Name,
        callback: EventListenerFor<Events[Name]> | EventListenerObjectLike | null,
        options?: boolean | EventListenerOptions
    ): void;
    override removeEventListener(
        type: string,
        callback: Listener | null,
        options?: boolean | EventListenerOptions
    ): void {
        if (arguments.length < 2) {throw new TypeError('removeEventListener requires a type and callback.');}

        const normalizedType = typeof type === 'string' ? type : `${type}`;
        const normalizedCallback = this.#normalizeCallback(callback);
        const capture = this.#normalizeCapture(options);
        if (!normalizedCallback) {return;}

        const record = this.#getRecord(normalizedType, normalizedCallback, capture);
        if (record) {
            this.#removeRecord(record);
            return;
        }

        // Not one of ours (for example, added with EventTarget.prototype directly):
        // pass the removal through to the native EventTarget unchanged.
        super.removeEventListener(normalizedType, normalizedCallback, {capture});
    }

    /**
     * Dispatch an event synchronously, exactly like `EventTarget.dispatchEvent()`.
     * Every matching listener has run by the time this returns. Listeners added
     * during the dispatch do not run until a later dispatch, as in browsers.
     *
     * A listener that throws does not stop the other listeners and does not make
     * this method throw; the runtime reports the error asynchronously instead.
     *
     * @param event - The event to deliver, usually a `CustomEvent` carrying `detail`.
     * @returns `false` if the event is cancelable and a listener called
     *   `preventDefault()`, otherwise `true`. It does not say whether any listener ran.
     */
    override dispatchEvent(event: Event): boolean {
        const previousToken = this.#dispatchToken;
        const token = ++this.#nextDispatchToken;
        this.#dispatchToken = token;
        try {
            return super.dispatchEvent(event);
        } finally {
            this.#dispatchToken = previousToken;
        }
    }

    /**
     * Remove every listener that was added through this mediator. Use it when the
     * mediator itself is finished; components should remove their own listeners.
     * The mediator can be used again afterwards.
     *
     * @returns This mediator, for chaining.
     */
    destroy() {
        // Copy first: removing records while iterating the maps would skip entries.
        const records: ListenerRecord[] = [];
        for (const registrations of [this.#bubbleRegistrations, this.#captureRegistrations]) {
            for (const callbacks of registrations.values()) {
                for (const record of callbacks.values()) {records.push(record);}
            }
        }
        for (const record of records) {
            this.#removeRecord(record);
        }
        return this;
    }

    // Accept what EventTarget accepts: a function, any object (handleEvent is checked
    // later, at dispatch), or null/undefined meaning "no listener".
    #normalizeCallback(callback: unknown): Listener | null {
        if (callback === null || callback === undefined) {return null;}
        if (typeof callback === 'function' || typeof callback === 'object') {
            return callback as Listener;
        }
        throw new TypeError('Event listener must be a function, object, null, or undefined.');
    }

    // Read addEventListener() options the way EventTarget does: a non-object is the
    // capture flag, and each object field is read once and converted to a boolean.
    // Reading through normal property access includes inherited and non-enumerable
    // properties, as the web platform does.
    #normalizeAddOptions(options?: boolean | AddListenerOptions): ListenerOptions {
        const value: unknown = options;
        if (value === undefined || value === null) {
            return {capture: false, once: false, passive: false};
        }

        if (typeof value !== 'object' && typeof value !== 'function') {
            return {capture: Boolean(value), once: false, passive: false};
        }

        const dictionary = value as AddListenerOptions;
        const capture = Boolean(dictionary.capture);
        const once = Boolean(dictionary.once);
        const passive = Boolean(dictionary.passive);
        const signal = dictionary.signal;

        return signal === undefined
            ? {capture, once, passive}
            : {capture, once, passive, signal};
    }

    // Same as above for removeEventListener(), which only reads `capture`.
    #normalizeCapture(options?: boolean | EventListenerOptions): boolean {
        const value: unknown = options;
        if (value === undefined || value === null) {return false;}
        if (typeof value !== 'object' && typeof value !== 'function') {return Boolean(value);}
        return Boolean((value as EventListenerOptions).capture);
    }

    #registrationsFor(capture: boolean) {
        return capture ? this.#captureRegistrations : this.#bubbleRegistrations;
    }

    #getRecord(type: string, callback: Listener, capture: boolean) {
        return this.#registrationsFor(capture).get(type)?.get(callback);
    }

    #storeRecord(record: ListenerRecord) {
        const registrations = this.#registrationsFor(record.capture);
        let callbacks = registrations.get(record.type);
        if (!callbacks) {
            callbacks = new Map();
            registrations.set(record.type, callbacks);
        }

        callbacks.set(record.callback, record);
    }

    // Remove one registration from EventTarget and from every Mediator record,
    // including its signal group. Stops watching the signal once no listener uses it.
    #removeRecord(record: ListenerRecord) {
        // Always pass {capture} as an object. Supported Node versions have handled a
        // plain boolean differently when one callback is registered in both modes.
        super.removeEventListener(record.type, record.listener, {capture: record.capture});

        const registrations = this.#registrationsFor(record.capture);
        const callbacks = registrations.get(record.type)!;
        callbacks.delete(record.callback);
        if (callbacks.size === 0) {registrations.delete(record.type);}

        if (record.signal) {
            const signalRecord = this.#signals.get(record.signal)!;
            signalRecord.listeners.delete(record);
            if (signalRecord.listeners.size === 0) {
                signalRecord.signal.removeEventListener('abort', signalRecord.abort);
                this.#signals.delete(record.signal);
            }
        }
    }

    // Add a registration to the group for its caller signal. The first registration
    // for a signal subscribes to that signal's shared dependent signal; aborting it
    // removes every registration in the group. Listening to the private dependent
    // signal, rather than the caller's, means application code cannot block cleanup
    // with stopImmediatePropagation() or trigger it by dispatching a fake 'abort'.
    #trackSignal(signal: AbortSignal, record: ListenerRecord) {
        let signalRecord = this.#signals.get(signal);
        if (!signalRecord) {
            const dependentSignal = getDependentSignal(signal);
            const listeners = new Set<ListenerRecord>();
            const abort: EventListener = () => {
                for (const listenerRecord of [...listeners]) {
                    this.#removeRecord(listenerRecord);
                }
            };
            signalRecord = {signal: dependentSignal, listeners, abort};
            this.#signals.set(signal, signalRecord);
            dependentSignal.addEventListener('abort', abort, {once: true});
        }
        signalRecord.listeners.add(record);
    }
}

export = Mediator;
