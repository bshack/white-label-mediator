'use strict';

const Mediator = require('../dist/index');
let mediator = {};

// canary
describe("A suite", function() {
    it("contains spec with an expectation", function() {
        expect(true).toBe(true);
    });
});

describe("A Mediator", function() {
    beforeEach(function() {
        mediator = new Mediator();
        this.callback = function(data) {};
        spyOn(this, 'callback');
        mediator.subscribe('main-menu', this.callback);
    });
    afterEach(function() {
        mediator = {};
        delete this.callback;
    });
    it("is an object", function() {
        expect(mediator).toEqual(jasmine.any(Object));
    });
    it("has an initialize function", function() {
        expect(mediator.initialize).toEqual(jasmine.any(Function));
    });
    it("has a publish function", function() {
        expect(mediator.publish).toEqual(jasmine.any(Function));
    });
    it("has a subscribe function", function() {
        expect(mediator.subscribe).toEqual(jasmine.any(Function));
    });
    it("emits an event on publish", function() {
        mediator.publish('main-menu', {
            state: 'open'
        });
        expect(this.callback).toHaveBeenCalled();
    });
    it("emits an event on publish with data", function() {
        mediator.publish('main-menu', {
            state: 'open'
        });
        expect(this.callback).toHaveBeenCalledWith({
            state: 'open'
        });
    });
    it("emits an event on publish without data", function() {
        mediator.publish('main-menu');
        expect(this.callback).toHaveBeenCalledWith();
    });
});
