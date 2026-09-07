/** @module src/index */
import EventEmitter from 'events';
declare class Mediator extends EventEmitter {
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
