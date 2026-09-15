/** @module src/index */

type EventListenerFor<Detail> = {bivarianceHack(event: CustomEvent<Detail>): void}['bivarianceHack'];
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

/**
 * Standards-based synchronous application event bus.
 *
 * Event payloads travel in CustomEvent.detail. Mediator tracks the native
 * EventTarget registrations it owns so destroy() can remove them deterministically.
 */
class Mediator<Events extends object = Record<string, unknown>> extends EventTarget {
    #listeners = new Set<ListenerRecord>();
    #registrations = new Map<string, Map<Listener, Map<boolean, ListenerRecord>>>();
    #signals = new Map<AbortSignal, SignalRecord>();

    /** Start this instance and return it for lifecycle chaining. */
    initialize() {
        return this;
    }

    /** Add an owned listener with standard EventTarget options and optional typed CustomEvent detail. */
    override addEventListener<Name extends keyof Events & string>(
        type: Name,
        callback: EventListenerFor<Events[Name]> | EventListenerObject | null,
        options?: boolean | AddEventListenerOptions
    ): void;
    override addEventListener(
        type: string,
        callback: Listener | null,
        options?: boolean | AddEventListenerOptions
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

        const dependentSignal = normalized.signal === undefined
            ? undefined
            : this.#prepareSignal(normalized.signal);
        const thisMediator = this;
        const needsWrapper = normalized.once || typeof normalizedCallback !== 'function';
        const listener: Listener = needsWrapper
            ? function(this: EventTarget, event: Event) {
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

        if (normalized.signal !== undefined && dependentSignal) {
            this.#trackSignal(normalized.signal, dependentSignal, record);
        }
    }

    /** Remove a previously registered listener using standard EventTarget matching rules. */
    override removeEventListener<Name extends keyof Events & string>(
        type: Name,
        callback: EventListenerFor<Events[Name]> | EventListenerObject | null,
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

    /** Remove every listener owned by this mediator and leave it reusable. */
    destroy() {
        for (const record of [...this.#listeners]) {
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

    #normalizeAddOptions(options?: boolean | AddEventListenerOptions): ListenerOptions {
        const value: unknown = options;
        if (value === undefined || value === null) {
            return {capture: false, once: false, passive: false};
        }

        if (typeof value !== 'object' && typeof value !== 'function') {
            return {capture: Boolean(value), once: false, passive: false};
        }

        const dictionary = value as AddEventListenerOptions;
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

    #prepareSignal(signal: AbortSignal): AbortSignal {
        const current = this.#signals.get(signal);
        return current?.signal ?? AbortSignal.any([signal]);
    }

    #getRecord(type: string, callback: Listener, capture: boolean) {
        return this.#registrations.get(type)?.get(callback)?.get(capture);
    }

    #storeRecord(record: ListenerRecord) {
        let callbacks = this.#registrations.get(record.type);
        if (!callbacks) {
            callbacks = new Map();
            this.#registrations.set(record.type, callbacks);
        }

        let captures = callbacks.get(record.callback);
        if (!captures) {
            captures = new Map();
            callbacks.set(record.callback, captures);
        }

        captures.set(record.capture, record);
        this.#listeners.add(record);
    }

    #removeRecord(record: ListenerRecord) {
        this.#listeners.delete(record);

        // Use the object form consistently; supported Node versions have differed
        // in boolean-capture removal behavior when both capture modes are present.
        super.removeEventListener(record.type, record.listener, {capture: record.capture});

        const callbacks = this.#registrations.get(record.type)!;
        const captures = callbacks.get(record.callback)!;
        captures.delete(record.capture);
        if (captures.size === 0) {callbacks.delete(record.callback);}
        if (callbacks.size === 0) {this.#registrations.delete(record.type);}

        if (record.signal) {
            const signalRecord = this.#signals.get(record.signal)!;
            signalRecord.listeners.delete(record);
            if (signalRecord.listeners.size === 0) {
                signalRecord.signal.removeEventListener('abort', signalRecord.abort);
                this.#signals.delete(record.signal);
            }
        }
    }

    #trackSignal(signal: AbortSignal, dependentSignal: AbortSignal, record: ListenerRecord) {
        let signalRecord = this.#signals.get(signal);
        if (!signalRecord) {
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
