import EventEmitter from 'events';
import util from 'util';

((EventEmitter, util) => {

    'use strict';

    /*
    MEDIATOR
    */

    const Mediator = function(modelData) {

        // this is called whenever the model is instantiated
        this.initialize = () => {
            this.emit('initialized');
        };

        this.publish = this.emit;

        this.subscribe = this.on;

        // run it on instantiation
        this.initialize();

    };

    // this sets up the events
    util.inherits(Mediator, EventEmitter);

    module.exports = Mediator;

})(EventEmitter, util);
