import EventEmitter from 'events';
import util from 'util';

((EventEmitter, util) => {

    'use strict';

    /*
    MEDIATOR
    */

    const Mediator = function(modelData) {

        // this is called whenever the mediator is instantiated
        this.initialize = () => {};

        this.publish = this.emit;

        this.subscribe = this.on;

        // run it on instantiation
        this.initialize();

        this.publish('initialized');

    };

    // this sets up the events
    util.inherits(Mediator, EventEmitter);

    module.exports = Mediator;

})(EventEmitter, util);
