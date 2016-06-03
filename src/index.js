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

            return this;

        }

    };

    module.exports = Mediator;

})(EventEmitter);
