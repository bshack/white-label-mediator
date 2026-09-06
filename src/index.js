import EventEmitter from 'events';

(() => {

    'use strict';

    const Mediator = class extends EventEmitter {

        constructor() {

            super();

        }

        initialize() {

            return this;

        }

        destroy() {

            // Release subscriber references when a mediator leaves the application lifecycle.
            this.removeAllListeners();

            return this;
        }

    };

    module.exports = Mediator;

})(EventEmitter);
