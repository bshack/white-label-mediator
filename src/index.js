import EventEmitter from 'events';

(() => {

    'use strict';

    /*
    VIEW
    */

    const Mediator = class extends EventEmitter {

        constructor() {

            super();
            this.initialize();

        }

        initialize() {

            return this;

        }

    };

    module.exports = Mediator;

})();
