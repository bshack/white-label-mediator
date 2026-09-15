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
    listeners: Set<ListenerRecord>;
    abort: EventListener;
};

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
        if (!callback) {return;}

        const normalized = this.#normalizeOptions(options);
        if (this.#getRecord(type, callback, normalized.capture)) {return;}
        if (normalized.signal && AbortSignal.any([normalized.signal]).aborted) {return;}

        const thisMediator = this;
        const listener: Listener = normalized.once
            ? function(this: EventTarget, event: Event) {
                thisMediator.#removeRecord(record);
                if (typeof callback === 'function') {
                    callback.call(this, event);
                } else {
                    callback.handleEvent(event);
                }
            }
            : callback;
        const record: ListenerRecord = normalized.signal
            ? {type, callback, listener, capture: normalized.capture, signal: normalized.signal}
            : {type, callback, listener, capture: normalized.capture};

        super.addEventListener(type, listener, {
            capture: normalized.capture,
            passive: normalized.passive
        });
        this.#storeRecord(record);

        if (normalized.signal) {
            this.#trackSignal(normalized.signal, record);
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
        if (!callback) {return;}

        const capture = typeof options === 'boolean' ? options : Boolean(options?.capture);
        const record = this.#getRecord(type, callback, capture);
        if (record) {
            this.#removeRecord(record);
            return;
        }

        super.removeEventListener(type, callback, options);
    }

    /** Remove every listener owned by this mediator and leave it reusable. */
    destroy() {
        for (const record of [...this.#listeners]) {
            this.#removeRecord(record);
        }
        return this;
    }

    #normalizeOptions(options?: boolean | AddEventListenerOptions): ListenerOptions {
        if (typeof options === 'boolean') {
            return {capture: options, once: false, passive: false};
        }

        if (!options) {
            return {capture: false, once: false, passive: false};
        }

        const capture = Boolean(options.capture);
        const once = Boolean(options.once);
        const passive = Boolean(options.passive);
        const signal = options.signal;

        if (signal === undefined) {
            return {capture, once, passive};
        }

        // AbortSignal.any performs platform brand validation without wiring every
        // listener through Node's signal-backed EventTarget registration path.
        AbortSignal.any([signal]);
        return {capture, once, passive, signal};
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
        if (!this.#listeners.delete(record)) {return;}

        // Use the object form consistently; supported Node versions have differed
        // in boolean-capture removal behavior when both capture modes are present.
        super.removeEventListener(record.type, record.listener, {capture: record.capture});

        const callbacks = this.#registrations.get(record.type);
        const captures = callbacks?.get(record.callback);
        captures?.delete(record.capture);
        if (captures?.size === 0) {callbacks?.delete(record.callback);}
        if (callbacks?.size === 0) {this.#registrations.delete(record.type);}

        if (record.signal) {
            const signalRecord = this.#signals.get(record.signal);
            signalRecord?.listeners.delete(record);
            if (signalRecord?.listeners.size === 0) {
                record.signal.removeEventListener('abort', signalRecord.abort);
                this.#signals.delete(record.signal);
            }
        }
    }

    #trackSignal(signal: AbortSignal, record: ListenerRecord) {
        let signalRecord = this.#signals.get(signal);
        if (!signalRecord) {
            const abort: EventListener = () => {
                const current = this.#signals.get(signal);
                if (!current) {return;}
                for (const listenerRecord of [...current.listeners]) {
                    this.#removeRecord(listenerRecord);
                }
            };
            signalRecord = {listeners: new Set(), abort};
            this.#signals.set(signal, signalRecord);
            signal.addEventListener('abort', abort, {once: true});
        }
        signalRecord.listeners.add(record);
    }
}

export = Mediator;
