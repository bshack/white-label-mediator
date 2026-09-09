'use strict';

const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {createRequire} = require('node:module');
const path = require('node:path');
const {compileFunction} = require('node:vm');

const nativeEvents = require('node:events');
// The trailing slash deliberately bypasses Node's built-in-module precedence.
const browserEvents = require('events/');
assert.notEqual(browserEvents, nativeEvents);

/** Load compiled package code with an isolated cache and an explicit event backend. */
function loadPackage(EventEmitter) {
    const root = path.resolve(__dirname, '../../dist');
    const cache = new Map();
    function load(filename) {
        assert.ok(filename.startsWith(root + path.sep), 'Only package dist modules may be loaded');
        if (cache.has(filename)) return cache.get(filename).exports;
        const module = {exports: {}};
        cache.set(filename, module);
        function requireDependency(id) {
            if (id === './event-emitter') return EventEmitter;
            assert.ok(id.startsWith('./'), `Unexpected dependency: ${id}`);
            return load(createRequire(filename).resolve(id));
        }
        const execute = compileFunction(readFileSync(filename, 'utf8'),
            ['exports', 'require', 'module', '__filename', '__dirname'], {filename});
        execute(module.exports, requireDependency, module, filename, path.dirname(filename));
        return module.exports;
    }
    return load(path.join(root, 'index.js'));
}

module.exports = {loadPackage, backends: [['Node', nativeEvents], ['npm browser implementation', browserEvents], ['EventEmitter3 adapter', require('../../dist/browser-event-emitter')]]};
