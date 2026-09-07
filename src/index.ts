/** @module src/index */
import EventEmitter from 'events';




class Mediator extends EventEmitter {

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
