(function (global, factory) {
    if (typeof define === "function" && define.amd) {
        define(['module', 'events', 'util'], factory);
    } else if (typeof exports !== "undefined") {
        factory(module, require('events'), require('util'));
    } else {
        var mod = {
            exports: {}
        };
        factory(mod, global.events, global.util);
        global.index = mod.exports;
    }
})(this, function (module, _events, _util) {
    'use strict';

    var _events2 = _interopRequireDefault(_events);

    var _util2 = _interopRequireDefault(_util);

    function _interopRequireDefault(obj) {
        return obj && obj.__esModule ? obj : {
            default: obj
        };
    }

    (function (EventEmitter, util) {

        'use strict';

        /*
        MEDIATOR
        */

        var baseMediator = {
            initialize: function initialize() {}
        };

        var Mediator = function Mediator(overrideMediator) {

            var overrideProp = void 0;
            var baseProp = void 0;

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
    })(_events2.default, _util2.default);
});
