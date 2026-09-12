'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

test('public package entrypoint resolves from built output', () => {
    const Mediator = require('white-label-mediator');
    assert.equal(typeof Mediator, 'function');
});
