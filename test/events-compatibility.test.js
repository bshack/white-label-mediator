'use strict';

const assert = require('node:assert/strict');
const {it} = require('node:test');
const {backends, loadPackage} = require('./helpers/events-backend');
const eventsContract = require('./helpers/events-contract');

for (const [name, Backend] of backends) {
    const Mediator = loadPackage(Backend);
    eventsContract(`Mediator / ${name}`, () => new Mediator(), Backend);

    it(`Mediator / ${name}: lifecycle chaining releases all named and symbol listeners`, () => {
        const mediator = new Mediator();
        assert.equal(mediator.initialize(), mediator);
        mediator.on('data', () => {});
        mediator.once(Symbol('ready'), () => {});
        assert.equal(mediator.destroy(), mediator);
        assert.deepEqual(mediator.eventNames(), []);
        assert.equal(mediator.emit('data'), false);
    });
}
