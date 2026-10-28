'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const scriptDir = path.resolve(__dirname, '../scripts');
const source = fs.readFileSync(path.join(scriptDir, 'test-browser.js'), 'utf8');
class Exit extends Error { constructor(code) { super('runner exit'); this.code = code; } }
function run(results, githubActions = 'true') {
  const calls = [], logs = [], errors = [], stdout = [], stderr = [];
  let exitCode = 0;
  const context = {
    __dirname: scriptDir,
    require(name) {
      if (name === 'node:path') return path;
      assert.equal(name, 'node:child_process');
      return {spawnSync(...args) {
        calls.push(args);
        return results[calls.length - 1] || {status: 0, stdout: '', stderr: ''};
      }};
    },
    console: {log: text => logs.push(text), error: text => errors.push(text)},
    process: {
      execPath: process.execPath, env: {GITHUB_ACTIONS: githubActions},
      stdout: {write: text => stdout.push(text)}, stderr: {write: text => stderr.push(text)},
      exit(code) { throw new Exit(code); }
    }
  };
  try { vm.runInNewContext(source, context); }
  catch (error) { if (!(error instanceof Exit)) throw error; exitCode = error.code; }
  return {calls, logs, errors, stdout, stderr, exitCode};
}

// Successful children retain their output and all suites run exactly once.
const passed = run([{status: 0, stdout: 'normal output\n', stderr: 'ordinary warning\n'}]);
assert.equal(passed.exitCode, 0);
assert.equal(passed.calls.length, 8);
assert.deepEqual(passed.stdout, ['normal output\n']);
assert.deepEqual(passed.stderr, ['ordinary warning\n']);
assert.deepEqual(passed.errors, []);
assert.equal(passed.logs.at(-1), 'All 8 browser test suites passed.');
for (const [executable, args, options] of passed.calls) {
  assert.equal(executable, process.execPath);
  assert.equal(args.length, 1);
  assert.equal(options.stdio, 'pipe');
  assert.equal(options.encoding, 'utf8');
  assert.ok(options.maxBuffer >= 10 * 1024 * 1024);
  assert.equal(options.timeout, 180_000);
}

// Stop on the first failure, preserve its exit code, and escape annotation data.
const failure = {status: 7, stdout: 'before failure\n', stderr: 'Assertion failed at 100%\r\n::warning::literal test text\n'};
const failed = run([{status: 0}, failure]);
assert.equal(failed.exitCode, 7);
assert.equal(failed.calls.length, 2, 'a failed suite is not retried and later suites do not run');
assert.deepEqual(failed.stdout, [failure.stdout]);
assert.deepEqual(failed.stderr, [failure.stderr]);
assert.equal(failed.errors.length, 1);
assert.match(failed.errors[0], /^::error title=Browser test failure::Browser suite vi\.js failed \(exit 7\)\./);
assert.ok(failed.errors[0].includes('100%25%0D%0A::warning::literal test text%0A'));
assert.doesNotMatch(failed.errors[0], /[\r\n]/);
assert.deepEqual(run([failure], 'false').errors, []);
assert.deepEqual(run([failure], '').errors, []);
const noNewline = run([{status: 1, stderr: 'unterminated diagnostic'}]);
assert.deepEqual(noNewline.stderr, ['unterminated diagnostic', '\n'], 'annotation begins on its own line');

// Spawn errors/timeouts remain failures even when no exit status is available.
const timedOut = run([{status: null, signal: 'SIGTERM', error: new Error('spawn ETIMEDOUT'), stderr: 'last child diagnostic'}]);
assert.equal(timedOut.exitCode, 1);
assert.equal(timedOut.calls.length, 1);
assert.equal(timedOut.errors[0], 'spawn ETIMEDOUT');
assert.match(timedOut.errors[1], /Browser suite ui\.js failed \(signal SIGTERM\)/);
assert.ok(timedOut.errors[1].includes('Runner error: spawn ETIMEDOUT%0Alast child diagnostic'));

// Full output is kept in the log while the annotation contains only the tail.
const longOutput = 'BEGIN_REMOVED' + 'x'.repeat(7000) + '\nFINAL DIAGNOSTIC\n';
const bounded = run([{status: 1, stdout: longOutput}]);
assert.deepEqual(bounded.stdout, [longOutput]);
assert.ok(bounded.errors[0].endsWith('%0AFINAL DIAGNOSTIC%0A'));
assert.equal(bounded.errors[0].includes('BEGIN_REMOVED'), false);
assert.ok(bounded.errors[0].length < 6500);
console.log('Browser runner checks passed: successful output, fail-fast exit codes, CI-only annotations, escaping, timeout diagnostics, and bounded tails.');
