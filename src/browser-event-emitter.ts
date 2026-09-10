import EventEmitter3 from 'eventemitter3';

type EventName = string | symbol;
type Listener = (...args: any[]) => void;
type RawListener = Listener & {listener?: Listener};
type Registration = {original: Listener; raw: RawListener};
type Channel = {registrations: Registration[]; bus?: EventEmitter3; warned: boolean};

function validateListener(listener: Listener): void {
    if (typeof listener !== 'function') throw new TypeError('The listener must be a function');
}

function validateLimit(limit: number): void {
    if (typeof limit !== 'number' || Number.isNaN(limit) || limit < 0) {
        throw new RangeError('The listener limit must be a non-negative number');
    }
}

/** Browser EventEmitter compatibility backed by EventEmitter3 dispatch.
 * Node builds continue using node:events. Keep this file identical in Model and Mediator.
 */
class BrowserEventEmitter {
    static EventEmitter = BrowserEventEmitter;
    static listenerCount(emitter: {listenerCount(event: EventName): number}, event: EventName): number {
        return emitter.listenerCount(event);
    }

    /** Promise helper retained from the previous browser emitter, including error cleanup. */
    static once(emitter: BrowserEventEmitter | EventTarget, event: EventName): Promise<any[]> {
        return new Promise((resolve, reject) => {
            if ('on' in emitter) {
                const failed = (error: unknown) => {
                    emitter.removeListener(event, ready);
                    reject(error);
                };
                const ready = (...args: any[]) => {
                    emitter.removeListener('error', failed);
                    resolve(args);
                };
                emitter.once(event, ready);
                if (event !== 'error') emitter.once('error', failed);
            } else if (typeof emitter.addEventListener === 'function') {
                const ready = (value: Event) => {
                    emitter.removeEventListener(event as string, ready);
                    resolve([value]);
                };
                emitter.addEventListener(event as string, ready);
            } else {
                throw new TypeError('Expected an EventEmitter or EventTarget');
            }
        });
    }

    private static defaultLimit = 10;
    static get defaultMaxListeners(): number { return this.defaultLimit; }
    static set defaultMaxListeners(limit: number) {
        validateLimit(limit);
        this.defaultLimit = limit;
    }

    private channels = new Map<EventName, Channel>();
    private limit?: number;

    getMaxListeners(): number { return this.limit ?? BrowserEventEmitter.defaultMaxListeners; }
    setMaxListeners(limit: number): this {
        validateLimit(limit);
        this.limit = limit;
        return this;
    }

    private add(event: EventName, listener: Listener, once: boolean, prepend: boolean): this {
        validateListener(listener);
        this.emit('newListener', event, listener);
        let raw: RawListener = listener;
        if (once) {
            let fired = false;
            const emitter = this;
            raw = function (...args: any[]) {
                if (fired) return;
                fired = true;
                emitter.removeListener(event, raw);
                listener.apply(emitter, args);
            };
            raw.listener = listener;
        }
        const channel: Channel = this.channels.get(event) ?? {registrations: [], warned: false};
        const registrations = channel.registrations;
        const registration = {original: listener, raw};
        if (prepend) {
            registrations.unshift(registration);
            channel.bus = undefined;
        } else {
            registrations.push(registration);
            // EventEmitter3 captures the listener count before dispatch, so appending
            // does not extend an emission already in progress.
            channel.bus?.on('dispatch', raw, this);
        }
        let warned = channel.warned;
        const limit = this.getMaxListeners();
        const exceeded = limit > 0 && registrations.length > limit && !warned;
        if (exceeded) warned = true;
        channel.warned = warned;
        this.channels.set(event, channel);
        if (exceeded) {
            const warning = Object.assign(new Error('Possible EventEmitter memory leak detected'), {
                name: 'MaxListenersExceededWarning', emitter: this, type: event, count: registrations.length
            });
            console.warn(warning);
        }
        return this;
    }

    on(event: EventName, listener: Listener): this { return this.add(event, listener, false, false); }
    addListener(event: EventName, listener: Listener): this { return this.on(event, listener); }
    once(event: EventName, listener: Listener): this { return this.add(event, listener, true, false); }
    prependListener(event: EventName, listener: Listener): this { return this.add(event, listener, false, true); }
    prependOnceListener(event: EventName, listener: Listener): this { return this.add(event, listener, true, true); }

    emit(event: EventName, ...args: any[]): boolean {
        const channel = this.channels.get(event);
        if (!channel && event === 'error') {
            if (args[0] instanceof Error) throw args[0];
            throw Object.assign(new Error('Unhandled error event'), {context: args[0]});
        }
        if (!channel) return false;
        // Cache a dispatch snapshot until removal or prepend changes its order.
        // In-flight emissions retain their old bus, including during recursion.
        if (!channel.bus) {
            const bus = new EventEmitter3();
            for (const registration of channel.registrations) bus.on('dispatch', registration.raw, this);
            channel.bus = bus;
        }
        return channel.bus.emit('dispatch', ...args);
    }

    removeListener(event: EventName, listener: Listener): this {
        validateListener(listener);
        const channel = this.channels.get(event);
        if (!channel) return this;
        const registrations = channel.registrations;
        for (let i = registrations.length - 1; i >= 0; i--) {
            const registration = registrations[i];
            if (registration.original === listener || registration.raw === listener) {
                registrations.splice(i, 1);
                if (registrations.length) channel.bus = undefined;
                else this.channels.delete(event);
                this.emit('removeListener', event, registration.original);
                break;
            }
        }
        return this;
    }
    off(event: EventName, listener: Listener): this { return this.removeListener(event, listener); }

    removeAllListeners(event?: EventName): this {
        // Without observers there is no reason to remove registrations individually.
        if (!this.channels.has('removeListener')) {
            if (event === undefined) this.channels.clear();
            else this.channels.delete(event);
            return this;
        }
        if (event === undefined) {
            for (const name of this.eventNames()) {
                if (name !== 'removeListener') this.removeAllListeners(name);
            }
            this.removeAllListeners('removeListener');
            this.channels.clear();
        } else {
            const listeners = this.rawListeners(event);
            for (let i = listeners.length - 1; i >= 0; i--) this.removeListener(event, listeners[i]);
            this.channels.delete(event);
        }
        return this;
    }

    listeners(event: EventName): Listener[] {
        const channel = this.channels.get(event);
        return channel ? channel.registrations.map(registration => registration.original) : [];
    }
    rawListeners(event: EventName): RawListener[] {
        const channel = this.channels.get(event);
        return channel ? channel.registrations.map(registration => registration.raw) : [];
    }
    listenerCount(event: EventName, listener?: Listener): number {
        const channel = this.channels.get(event);
        if (!channel) return 0;
        if (listener === undefined) return channel.registrations.length;
        let count = 0;
        for (const registration of channel.registrations) {
            if (registration.original === listener) count++;
        }
        return count;
    }
    eventNames(): EventName[] {
        return Reflect.ownKeys(Object.fromEntries(Array.from(this.channels.keys(), name => [name, true])));
    }
}

export = BrowserEventEmitter;
