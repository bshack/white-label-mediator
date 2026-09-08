/** @module src/index */
import EventEmitter from 'events';




type EventArguments<T> = T extends unknown[] ? T : never;

/** Synchronous event bus with optional compile-time event and payload contracts. */
class Mediator<Events extends object = Record<string | symbol, any[]>> extends EventEmitter {

    override on<Name extends keyof Events & (string | symbol)>(
        eventName: Name,
        listener: (...arguments_: EventArguments<Events[Name]>) => void
    ): this {
        return super.on(eventName, listener);
    }

    override once<Name extends keyof Events & (string | symbol)>(
        eventName: Name,
        listener: (...arguments_: EventArguments<Events[Name]>) => void
    ): this {
        return super.once(eventName, listener);
    }

    override emit<Name extends keyof Events & (string | symbol)>(
        eventName: Name,
        ...arguments_: EventArguments<Events[Name]>
    ): boolean {
        return super.emit(eventName, ...arguments_);
    }

    override removeListener<Name extends keyof Events & (string | symbol)>(
        eventName: Name,
        listener: (...arguments_: EventArguments<Events[Name]>) => void
    ): this {
        return super.removeListener(eventName, listener);
    }

    /**
     * Create an instance with its own state and listener references.
     */
    constructor() {

        super();

    }

    /**
     * Start this instance and return it for lifecycle chaining.
     * @returns This instance for chaining.
     */
    initialize() {

        return this;

    }

    /**
     * Release owned state and listeners so the instance can leave the application lifecycle.
     * @returns This instance after cleanup.
     */
    destroy() {

        // Release subscriber references when a mediator leaves the application lifecycle.
        this.removeAllListeners();

        return this;
    }

};




export = Mediator;
