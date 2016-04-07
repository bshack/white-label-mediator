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
        let self = this;
        this.initFunction = function() {};
        spyOn(this,'initFunction');
        const MediatorTest = class extends Mediator {
            initialize() {
                self.initFunction();
            }
            extendedFunction() {

            }
        };
        mediator = new MediatorTest();
        this.callback = function(data) {};
        spyOn(this, 'callback');
        mediator.on('main-menu', this.callback);
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
    it("has a emit function", function() {
        expect(mediator.emit).toEqual(jasmine.any(Function));
    });
    it("has a on function", function() {
        expect(mediator.on).toEqual(jasmine.any(Function));
    });
    it("emits an event on emit", function() {
        mediator.emit('main-menu', {
            state: 'open'
        });
        expect(this.callback).toHaveBeenCalled();
    });
    it("emits an event on emit with data", function() {
        mediator.emit('main-menu', {
            state: 'open'
        });
        expect(this.callback).toHaveBeenCalledWith({
            state: 'open'
        });
    });
    it("emits an event on emit without data", function() {
        mediator.emit('main-menu');
        expect(this.callback).toHaveBeenCalledWith();
    });
    it("executes the initialize function on Instantiation", function() {
        expect(this.initFunction).toHaveBeenCalled();
    });
    it("is extendable", function() {
        expect(mediator.extendedFunction).toEqual(jasmine.any(Function));
    });
});
