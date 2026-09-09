/** @module src/index */
import EventEmitter = require('./event-emitter');
type EventArguments<T> = T extends unknown[] ? T : never;
/** Synchronous event bus with optional compile-time event and payload contracts. */
declare class Mediator<Events extends object = Record<string | symbol, any[]>> extends EventEmitter {
    on<Name extends keyof Events & (string | symbol)>(eventName: Name, listener: (...arguments_: EventArguments<Events[Name]>) => void): this;
    once<Name extends keyof Events & (string | symbol)>(eventName: Name, listener: (...arguments_: EventArguments<Events[Name]>) => void): this;
    emit<Name extends keyof Events & (string | symbol)>(eventName: Name, ...arguments_: EventArguments<Events[Name]>): boolean;
    removeListener<Name extends keyof Events & (string | symbol)>(eventName: Name, listener: (...arguments_: EventArguments<Events[Name]>) => void): this;
    /**
     * Create an instance with its own state and listener references.
     */
    constructor();
    /**
     * Start this instance and return it for lifecycle chaining.
     * @returns This instance for chaining.
     */
    initialize(): this;
    /**
     * Release owned state and listeners so the instance can leave the application lifecycle.
     * @returns This instance after cleanup.
     */
    destroy(): this;
}
export = Mediator;
