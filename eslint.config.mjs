import babelParser from '@babel/eslint-parser';
import js from '@eslint/js';

const sharedRules = {curly: ['error', 'all'], eqeqeq: ['error', 'always'], 'no-eval': 'error', 'no-implied-eval': 'error', 'no-new-wrappers': 'error', 'no-var': 'error', 'prefer-const': 'error'};

// Runtime globals the CommonJS tests and benchmarks use (all present in Node.js and
// browsers). Listed explicitly rather than adding a globals package for eight names.
const runtimeGlobals = Object.fromEntries([
  '__dirname', 'AbortController', 'AbortSignal', 'CustomEvent', 'Event', 'EventTarget', 'console', 'process',
].map(name => [name, 'readonly']));

export default [
  {ignores: ['dist/**', 'coverage/**', 'node_modules/**']},
  {
    files: ['src/**/*.ts'],
    languageOptions: {parser: babelParser, parserOptions: {requireConfigFile: false, sourceType: 'unambiguous', babelOptions: {presets: ['@babel/preset-typescript']}}},
    rules: {...js.configs.recommended.rules, 'no-undef': 'off', 'no-unused-vars': 'off', ...sharedRules},
  },
  {
    files: ['test/**/*.js', 'benchmark/**/*.js'],
    languageOptions: {ecmaVersion: 'latest', sourceType: 'commonjs', globals: runtimeGlobals},
    rules: {...js.configs.recommended.rules, ...sharedRules},
  },
  {
    // Bundled and run inside Chromium by test/browser/chromium.test.js.
    files: ['test/browser/page-checks.js'],
    languageOptions: {globals: {window: 'readonly'}},
  },
];
