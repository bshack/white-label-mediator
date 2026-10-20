'use strict';

// Bundles test/browser/page-checks.js with the built package and runs it in a real
// Chromium page. Run with `npm run test:browser` after `npm run build`. It is not
// part of `npm test` or coverage; CI runs it in the `browser` job.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {after, before, test} = require('node:test');
const esbuild = require('esbuild');
const {chromium} = require('playwright');

const root = path.join(__dirname, '..', '..');
let browser;
let results;

before(async () => {
    assert.ok(fs.existsSync(path.join(root, 'dist', 'index.js')), 'dist/index.js is missing; run `npm run build` first');
    const bundle = await esbuild.build({
        entryPoints: [path.join(__dirname, 'page-checks.js')],
        bundle: true,
        write: false,
        format: 'iife',
        platform: 'browser',
        target: 'es2022',
        logLevel: 'silent'
    });
    browser = await chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined});
    const page = await browser.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error));
    await page.setContent('<!doctype html><html lang="en"><head><title>Mediator browser checks</title></head><body></body></html>');
    await page.addScriptTag({content: bundle.outputFiles[0].text});
    results = await page.evaluate('window.mediatorBrowserResults');
    assert.ok(Array.isArray(results), `page checks did not run: ${pageErrors.map(String).join('\n')}`);
});

after(async () => {
    await browser?.close();
});

const expected = [
    'existing smoke script',
    'EventTarget subclassing',
    'CustomEvent detail',
    'once',
    'capture matching',
    'passive',
    'AbortSignal removal and AbortSignal.any caching',
    'listener errors reach window error without stopping later listeners',
    'destroy()'
];

test('every page check ran', () => {
    assert.deepEqual(results.map(result => result.name), expected);
});

for (const name of expected) {
    test(`Chromium: ${name}`, () => {
        const result = results.find(entry => entry.name === name);
        assert.ok(result, `${name} did not run`);
        assert.equal(result.error, undefined, result.error);
    });
}
