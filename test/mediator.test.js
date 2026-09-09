'use strict';

const assert = require('node:assert/strict');
const {describe, it, beforeEach, afterEach, mock} = require('node:test');
const {isDeepStrictEqual} = require('node:util');

afterEach(() => mock.restoreAll());

const Mediator = require('../dist/index');
let mediator = {};

// canary
describe("A suite", function() {
    it("contains spec with an expectation", function() {
        assert.equal(true, true);
    });
});

describe("A Mediator", function() {
    let callback, initFunction;
    beforeEach(function() {
        initFunction = mock.fn();
        const MediatorTest = class extends Mediator {
            initialize() {
                initFunction();
            }
            extendedFunction() {

            }
        };
        mediator = new MediatorTest();
        callback = mock.fn();
        mediator.on('main-menu', callback);
    });
    afterEach(function() {
        mediator = {};
        callback = undefined;
    });
    it("is an object", function() {
        assert.ok(mediator instanceof Object);
    });
    it("has an initialize function", function() {
        assert.ok(typeof mediator.initialize === 'function');
    });
    it("has a emit function", function() {
        assert.ok(typeof mediator.emit === 'function');
    });
    it("has a on function", function() {
        assert.ok(typeof mediator.on === 'function');
    });
    it("emits an event on emit", function() {
        mediator.emit('main-menu', {
            state: 'open'
        });
        assert.ok(callback.mock.callCount() > 0);
    });
    it("emits an event on emit with data", function() {
        mediator.emit('main-menu', {
            state: 'open'
        });
        assert.ok(callback.mock.calls.some(call => isDeepStrictEqual(call.arguments, [{
            state: 'open'
        }])));
    });
    it("emits an event on emit without data", function() {
        mediator.emit('main-menu');
        assert.ok(callback.mock.calls.some(call => isDeepStrictEqual(call.arguments, [])));
    });
    it("executes the initialize function", function() {
        mediator.initialize();
        assert.ok(initFunction.mock.callCount() > 0);
    });
    it("executes the initialize function and returns 'this'", function() {
        let mediator = new Mediator();
        let result = mediator.initialize();
        assert.ok(result instanceof Object);
    });
    it("removes event listeners when destroyed", function() {
        mediator.destroy();
        assert.deepEqual(mediator.listenerCount('main-menu'), 0);
    });
    it("supports one-time and explicitly removed typed listeners", function() {
        const callback = mock.fn();
        mediator.once('ready', callback);
        mediator.emit('ready', 'Ada');
        mediator.emit('ready', 'Grace');
        assert.deepEqual(callback.mock.calls.map(call => call.arguments), [['Ada']]);
        mediator.on('stopped', callback);
        mediator.removeListener('stopped', callback);
        mediator.emit('stopped');
        assert.equal(callback.mock.callCount(), 1);
    });
    it("is extendable", function() {
        assert.ok(typeof mediator.extendedFunction === 'function');
    });
});
