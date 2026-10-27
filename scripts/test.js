'use strict';

const path = require('node:path');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const tests = [
  'shell-test.js',
  'command-options-test.js',
  'shell-realism-test.js',
  'awk-sort-review-test.js',
  'case-realism-test.js',
  'practice-test.js',
  'vi-test.js',
  'sl-test.js',
  'cases-test.js',
  'cases-extra-test.js',
  'i18n-test.js',
  'curriculum-test.js',
  'release-check.js'
];

for (const test of tests) {
  const result = spawnSync(process.execPath, [path.join(root, 'tests', test)], {
    cwd: root, stdio: 'inherit', timeout: 120_000
  });
  if (result.error) console.error(result.error.message);
  if (result.error || result.status !== 0) process.exit(result.status || 1);
}
console.log(`All ${tests.length} core test suites passed.`);
