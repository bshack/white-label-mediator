"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
/** @module src/index */
const events_1 = __importDefault(require("events"));
/** Synchronous event bus with optional compile-time event and payload contracts. */
class Mediator extends events_1.default {
    on(eventName, listener) {
        return super.on(eventName, listener);
    }
    once(eventName, listener) {
        return super.once(eventName, listener);
    }
    emit(eventName, ...arguments_) {
        return super.emit(eventName, ...arguments_);
    }
    removeListener(eventName, listener) {
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
}
;
module.exports = Mediator;
//# sourceMappingURL=index.js.map