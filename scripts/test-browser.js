'use strict';

const path = require('node:path');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const tests = ['ui.js', 'vi.js', 'gameover.js', 'sl.js', 'i18n.js'];

for (const test of tests) {
  console.log(`Browser suite: ${test}`);
  const result = spawnSync(process.execPath, [path.join(root, 'tests/browser', test)], {
    cwd: root, stdio: 'inherit', timeout: 180_000
  });
  if (result.error) console.error(result.error.message);
  if (result.error || result.status !== 0) process.exit(result.status || 1);
}
console.log(`All ${tests.length} browser test suites passed.`);
