'use strict';

const path = require('node:path');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const tests = ['ui.js', 'vi.js', 'gameover.js', 'sl.js', 'i18n.js', 'language-defaults.js', 'practice.js', 'curriculum.js'];

function annotateFailure(test, result) {
  if (process.env.GITHUB_ACTIONS !== 'true') return;
  const status = result.status !== null ? `exit ${result.status}` : result.signal ? `signal ${result.signal}` : 'no exit status';
  // Keep the normal logs intact; expose a bounded diagnostic tail in the check annotation.
  const output = [result.stdout, result.stderr].filter(Boolean).join('\n').slice(-6000);
  const message = `Browser suite ${test} failed (${status}).` +
    (result.error ? `\nRunner error: ${result.error.message}` : '') + (output ? `\n${output}` : '');
  const escaped = message.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
  if (result.stderr && !/[\r\n]$/.test(result.stderr) && !result.error) process.stderr.write('\n');
  console.error(`::error title=Browser test failure::${escaped}`);
}

for (const test of tests) {
  console.log(`Browser suite: ${test}`);
  const result = spawnSync(process.execPath, [path.join(root, 'tests/browser', test)], {
    cwd: root, stdio: 'pipe', encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 180_000
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) console.error(result.error.message);
  if (result.error || result.status !== 0) {
    annotateFailure(test, result);
    process.exit(result.status || 1);
  }
}
console.log(`All ${tests.length} browser test suites passed.`);
