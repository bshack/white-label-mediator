type EventName = string | symbol;
type Listener = (...args: any[]) => void;
type RawListener = Listener & {
    listener?: Listener;
};
/** Browser EventEmitter compatibility backed by EventEmitter3 dispatch.
 * Node builds continue using node:events. Keep this file identical in Model and Mediator.
 */
declare class BrowserEventEmitter {
    static EventEmitter: typeof BrowserEventEmitter;
    static listenerCount(emitter: {
        listenerCount(event: EventName): number;
    }, event: EventName): number;
    /** Promise helper retained from the previous browser emitter, including error cleanup. */
    static once(emitter: BrowserEventEmitter | EventTarget, event: EventName): Promise<any[]>;
    private static defaultLimit;
    static get defaultMaxListeners(): number;
    static set defaultMaxListeners(limit: number);
    private channels;
    private limit?;
    getMaxListeners(): number;
    setMaxListeners(limit: number): this;
    /** Replace the dispatch channel so an in-flight emit retains its listener snapshot. */
    private store;
    private add;
    on(event: EventName, listener: Listener): this;
    addListener(event: EventName, listener: Listener): this;
    once(event: EventName, listener: Listener): this;
    prependListener(event: EventName, listener: Listener): this;
    prependOnceListener(event: EventName, listener: Listener): this;
    emit(event: EventName, ...args: any[]): boolean;
    removeListener(event: EventName, listener: Listener): this;
    off(event: EventName, listener: Listener): this;
    removeAllListeners(event?: EventName): this;
    listeners(event: EventName): Listener[];
    rawListeners(event: EventName): RawListener[];
    listenerCount(event: EventName, listener?: Listener): number;
    eventNames(): EventName[];
}
export = BrowserEventEmitter;
