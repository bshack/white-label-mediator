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

        var Mediator = function Mediator(modelData) {

            // this is called whenever the mediator is instantiated
            this.initialize = function () {};

            this.publish = this.emit;

            this.subscribe = this.on;

            // run it on instantiation
            this.initialize();

            this.publish('initialized');
        };

        // this sets up the events
        util.inherits(Mediator, EventEmitter);

        module.exports = Mediator;
    })(_events2.default, _util2.default);
});
