/** @module src/index */

type EventListenerFor<Detail> = {bivarianceHack(event: CustomEvent<Detail>): void}['bivarianceHack'];

/**
 * Standards-based synchronous application event bus.
 *
 * Event payloads travel in CustomEvent.detail. Listeners added through this
 * instance are automatically scoped to its lifecycle and are removed by destroy().
 */
class Mediator<Events extends object = Record<string, unknown>> extends EventTarget {
    #controller = new AbortController();

    /** Start this instance and return it for lifecycle chaining. */
    initialize() {
        return this;
    }

    /** Add a lifecycle-scoped listener with optional typed CustomEvent detail. */
    override addEventListener<Name extends keyof Events & string>(
        type: Name,
        callback: EventListenerFor<Events[Name]> | EventListenerObject | null,
        options?: boolean | AddEventListenerOptions
    ): void;
    override addEventListener(
        type: string,
        callback: EventListenerOrEventListenerObject | null,
        options?: boolean | AddEventListenerOptions
    ): void {
        if (!callback) {return;}

        const normalizedOptions = typeof options === 'boolean' ? {capture: options} : {...options};
        const signal = normalizedOptions.signal
            ? AbortSignal.any([this.#controller.signal, normalizedOptions.signal])
            : this.#controller.signal;

        super.addEventListener(type, callback, {...normalizedOptions, signal});
    }

    /** Remove a previously registered listener using standard EventTarget matching rules. */
    override removeEventListener<Name extends keyof Events & string>(
        type: Name,
        callback: EventListenerFor<Events[Name]> | EventListenerObject | null,
        options?: boolean | EventListenerOptions
    ): void;
    override removeEventListener(
        type: string,
        callback: EventListenerOrEventListenerObject | null,
        options?: boolean | EventListenerOptions
    ): void {
        super.removeEventListener(type, callback, options);
    }

    /**
     * Remove listeners registered through this instance and reset lifecycle scope.
     * The mediator can be initialized and subscribed again after destruction.
     */
    destroy() {
        this.#controller.abort();
        this.#controller = new AbortController();
        return this;
    }
}

export = Mediator;
