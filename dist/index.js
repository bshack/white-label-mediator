(function (global, factory) {
  if (typeof define === "function" && define.amd) {
    define(["events"], factory);
  } else if (typeof exports !== "undefined") {
    factory(require("events"));
  } else {
    var mod = {
      exports: {}
    };
    factory(global.events);
    global.index = mod.exports;
  }
})(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : this, function (_events) {
  "use strict";

  _events = _interopRequireDefault(_events);
  function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
  (() => {
    'use strict';

    const Mediator = class extends _events.default {
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
  })(_events.default);
});
