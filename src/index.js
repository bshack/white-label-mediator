import EventEmitter from 'events';
import util from 'util';


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
