/** @module src/index */

type EventListenerFor<Detail> = {bivarianceHack(event: CustomEvent<Detail>): void}['bivarianceHack'];

// The published declarations must compile for DOM consumers and for Node-only
// consumers whose @types/node globals omit the DOM-only EventListenerObject and
// AddEventListenerOptions names. These aliases match the DOM shapes structurally
// using only globals both environments declare.
/** Listener object shape accepted by EventTarget: an object with a handleEvent method. */
type EventListenerObjectLike = {handleEvent(object: Event): void};
/** Listener options accepted by EventTarget.addEventListener(). */
type AddListenerOptions = EventListenerOptions & {
    once?: boolean;
    passive?: boolean;
    signal?: AbortSignal;
};
type Listener = EventListenerOrEventListenerObject;

type ListenerOptions = {
    capture: boolean;
    once: boolean;
    passive: boolean;
    signal?: AbortSignal;
};

type ListenerRecord = {
    type: string;
    callback: Listener;
    listener: Listener;
    capture: boolean;
    signal?: AbortSignal;
};

type SignalRecord = {
    signal: AbortSignal;
    listeners: Set<ListenerRecord>;
    abort: EventListener;
};

const abortSignalAborted = Object.getOwnPropertyDescriptor(AbortSignal.prototype, 'aborted')!.get!;

// One private dependent signal per caller signal, shared by every registration and
// mediator that uses it. Allocating a new AbortSignal.any() result each time a
// long-lived signal regains a listener grows the source signal's dependant list.
const dependentSignals = new WeakMap<AbortSignal, AbortSignal>();

function getDependentSignal(signal: AbortSignal) {
    let dependentSignal = dependentSignals.get(signal);
    if (!dependentSignal) {
        dependentSignal = AbortSignal.any([signal]);
        dependentSignals.set(signal, dependentSignal);
    }
    return dependentSignal;
}

/**
 * Standards-based synchronous application event bus.
 *
 * Event payloads travel in CustomEvent.detail. Mediator tracks the native
 * EventTarget registrations it owns so destroy() can remove them deterministically.
 */
class Mediator<Events extends object = Record<string, unknown>> extends EventTarget {
    // Registrations indexed by capture mode, then type, then callback. Splitting on
    // capture first avoids allocating a per-callback map for every registration.
    #bubbleRegistrations = new Map<string, Map<Listener, ListenerRecord>>();
    #captureRegistrations = new Map<string, Map<Listener, ListenerRecord>>();
    #signals = new Map<AbortSignal, SignalRecord>();
    // Token of the innermost dispatch in progress, or 0 when none is active.
    #dispatchToken = 0;
    #nextDispatchToken = 0;

    /** Start this instance and return it for lifecycle chaining. */
    initialize() {
        return this;
    }

    /** Add an owned listener with standard EventTarget options and optional typed CustomEvent detail. */
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
        // Tokens increase monotonically and dispatches nest strictly, so an active
        // dispatch whose token was issued before this registration is exactly a
        // dispatch that was already in progress when the listener was added.
        const blockedThroughToken = this.#dispatchToken === 0 ? 0 : this.#nextDispatchToken;
        const needsWrapper = normalized.once
            || normalized.signal !== undefined
            || typeof normalizedCallback !== 'function'
            || blockedThroughToken !== 0;
        const listener: Listener = needsWrapper
            ? function(this: EventTarget, event: Event) {
                // DOM dispatch invokes a clone of the listener list. Node walks a
                // live list, so a registration must stay out of every dispatch
                // that was already active when it was added. Later nested
                // dispatches use new tokens and can observe the registration.
                const dispatchToken = thisMediator.#dispatchToken;
                if (dispatchToken !== 0 && dispatchToken <= blockedThroughToken) {return;}
                if (normalized.signal !== undefined
                    && Boolean(Reflect.apply(abortSignalAborted, normalized.signal, []))) {return;}
                if (normalized.once) {thisMediator.#removeRecord(record);}
                if (typeof normalizedCallback === 'function') {
                    normalizedCallback.call(this, event);
                } else {
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

        // Listener objects are wrapped so Node never touches handleEvent during
        // registration. That keeps Web IDL callback lookup at dispatch time and
        // prevents user getters from mutating signal state mid-registration.
        super.addEventListener(normalizedType, listener, {
            capture: normalized.capture,
            passive: normalized.passive
        });
        this.#storeRecord(record);

        if (normalized.signal !== undefined) {
            this.#trackSignal(normalized.signal, record);
        }
    }

    /** Remove a previously registered listener using standard EventTarget matching rules. */
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

        super.removeEventListener(normalizedType, normalizedCallback, {capture});
    }

    /** Dispatch with DOM-style listener snapshot semantics across supported runtimes. */
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

    /** Remove every listener owned by this mediator and leave it reusable. */
    destroy() {
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

    #normalizeCallback(callback: unknown): Listener | null {
        if (callback === null || callback === undefined) {return null;}
        if (typeof callback === 'function' || typeof callback === 'object') {
            return callback as Listener;
        }
        throw new TypeError('Event listener must be a function, object, null, or undefined.');
    }

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

    #removeRecord(record: ListenerRecord) {
        // Use the object form consistently; supported Node versions have differed
        // in boolean-capture removal behavior when both capture modes are present.
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
