import EventEmitter from 'events';
import util from 'util';

((EventEmitter, util) => {

    'use strict';

    /*
    MEDIATOR
    */

    let baseMediator = {
        initialize: () => {}
    };

    const Mediator = function(overrideMediator) {

        let overrideProp;
        let baseProp;

        //extend base mediator
        for (overrideProp in overrideMediator) {
            baseMediator[overrideProp] = overrideMediator[overrideProp];
        }

        //add view properties to this
        for (baseProp in baseMediator) {
            this[baseProp] = baseMediator[baseProp];
        }

        // run it on instantiation
        this.initialize();

    };

    // this sets up the events
    util.inherits(Mediator, EventEmitter);

    module.exports = Mediator;

})(EventEmitter, util);
