'use strict';
const assert = require('node:assert/strict');
for (const source of ['cases', 'cases-extra', 'case-context', 'case-reading-a', 'case-reading-b', 'shell', 'locales/cases-a', 'locales/cases-b', 'locales/cases-c', 'i18n']) require('../src/' + source + '.js');
const cases = Object.fromEntries(globalThis.LOG_LAB_CASES.map(c => [c.id, c]));
const rows = text => text.trimEnd().split('\n');
const auth = '/var/log/auth.log', access = '/var/log/nginx/access.log', audit = '/var/log/app/audit.log';
const failures = rows(cases.ssh.files[auth]).filter(line => line.includes('Failed password'));
const byIp = failures.reduce((counts, line) => {
  const ip = line.match(/ from (\S+) port /)[1]; counts[ip] = (counts[ip] || 0) + 1; return counts;
}, {});
assert.deepEqual(byIp, { '203.0.113.44': 12, '198.51.100.25': 7, '198.51.100.73': 60 });
assert(rows(cases.ssh.files[auth]).every(line => /^Aug 12 \d\d:\d\d:\d\d edge-01 /.test(line)));
assert(cases.ssh.files[auth].includes('Invalid user admin'));
assert(cases.ssh.files[auth].includes('pam_unix(sshd:auth): authentication failure;'));
assert(cases.ssh.files[auth].includes('[preauth]'));
assert(cases.ssh.files[auth].includes('sudo: deploy :'));
assert(rows(cases.ssh.files[auth]).filter(line => line.includes('sudo: deploy :')).length === 2);
// Adding companion authentication events must not inflate event-specific counts.
const sshShell = new LogLabShell(cases.ssh.files);
assert.equal(sshShell.run("grep 'Failed password' /var/log/auth.log | awk '{print $(NF-3)}' | sort | uniq -c | sort -nr").stdout.trim().split('\n')[0].trim(), '60 198.51.100.73');
const selected = failures.filter(line => line.includes('198.51.100.73'));
const lastFailure = selected.at(-1).match(/^Aug 12 (\S+)/)[1];
const accepted = rows(cases.ssh.files[auth]).find(line => line.includes('Accepted password for deploy'));
const acceptedTime = accepted.match(/^Aug 12 (\S+)/)[1];
assert.equal(acceptedTime, '09:18:42');
assert.equal((Date.parse('2026-08-12T'+acceptedTime+'Z') - Date.parse('2026-08-12T'+lastFailure+'Z')) / 1000, 50);
assert(cases.ssh.files[auth+'.1'].startsWith('Aug 11 '));
assert(cases.ssh.files[auth+'.2.gz'].startsWith('Aug  9 '));
assert.equal(cases.ssh.baselineFiles[auth+'.2.gz'], cases.ssh.files[auth+'.2.gz']);
assert(!cases.ssh.baselineFiles[auth].includes('198.51.100.73'));
assert.equal(sshShell.run("zgrep -c 'Failed password' /var/log/auth.log.2.gz").stdout.trim(), '1');
assert(!cases.ssh.logPaths.includes(auth+'.1'), 'history must not be treated as the current normal comparison');
assert(cases.ssh.context.period.includes('2026/08/12 08:55:00'));
assert(!cases.ssh.context.period.includes('2026/08/09'));
// A shared request ID must match the same instant after applying the numeric offset.
for (const line of rows(cases.web.files[audit])) {
  const rid = line.match(/request_id=(\S+)/)[1];
  const matched = rows(cases.web.files[access]).find(accessLine => accessLine.endsWith('request_id='+rid));
  if (!matched) continue;
  const time = matched.match(/\[(\d+)\/Aug\/(\d+):(\d\d:\d\d:\d\d) ([+-]\d\d)(\d\d)\]/);
  assert(time, matched);
  assert.equal(time[4]+time[5], '+0900');
  assert.equal(Date.parse(`${time[2]}-08-${time[1]}T${time[3]}${time[4]}:${time[5]}`), Date.parse(line.split(' ')[0]));
}
assert(cases.web.context.period.includes('10:20:06'));
for (const c of Object.values(cases)) {
  if (c.files[access]) for (const line of rows(c.files[access]).filter(line => /" 302 /.test(line))) assert(Number(line.match(/" 302 (\d+) /)[1]) > 0, 'redirect fixture should include a plausible response body');
}
assert(!rows(cases.tamper.files[auth]).some(line => /sshd.*request_id=/.test(line)), 'raw OpenSSH must not inherit Web request IDs');
const proxy = rows(cases.egress.files['/var/log/proxy/access.log']).filter(line => line.includes('path=/v1/upload '));
const bytes = proxy.map(line => Number(line.match(/bytes_out=(\d+)/)[1]));
assert.equal(proxy.length, 4);
assert.equal(new Set(bytes).size, 4);
assert.equal(bytes.reduce((sum,n) => sum+n, 0), 1048576);
const intervals = proxy.slice(1).map((line,i) => Date.parse(line.split(' ')[0])-Date.parse(proxy[i].split(' ')[0]));
assert(new Set(intervals).size > 1, 'upload intervals must vary');
assert(rows(cases.egress.files['/var/log/named/query.log']).every(line => line.includes(' normalized_dns ')));
const sumHint = cases.egress.tasks.find(t => t.id === 'upload-bytes').hints.at(-1).command;
assert.equal(new LogLabShell(cases.egress.files).run(sumHint).stdout.trim(), '1048576');
// Execute the actual teaching commands against changed fixtures, and verify every evidence location.
let commandCount = 0;
for (const c of Object.values(cases)) {
  const files = {...c.files, ...Object.fromEntries(Object.entries(c.baselineFiles).map(([p,text]) => ['/baseline'+p,text]))};
  const shell = new LogLabShell(files);
  for (const command of [...c.walkthrough.map(w=>w.command), ...c.tasks.flatMap(t=>t.hints.map(h=>h.command).filter(Boolean))]) {
    const result = shell.run(command); assert.equal(result.stderr, '', c.id+': '+command); assert([0,1].includes(result.code), c.id+': '+command); assert(result.stdout.trim(), c.id+': '+command); commandCount++;
  }
  for (const task of c.tasks) for (const evidence of task.evidence) assert.equal(c.files[evidence.path].split('\n')[evidence.line-1], evidence.quote);
}
for (const language of ['en', 'th']) {
  const local = Object.fromEntries(LogroomI18n.localizeCases(Object.values(cases), language).map(c => [c.id, c]));
  for (const key of ['files', 'baselineFiles']) {
    const webReadme = local.web[key]['/home/analyst/README.txt'];
    assert(webReadme.includes('+0900') && webReadme.includes('10:12:08Z'));
    assert(!webReadme.includes('All log timestamps are UTC'));
    assert(!webReadme.includes('เวลาของบันทึกทั้งหมดเป็น UTC'));
    assert(local.ssh[key]['/home/analyst/README.txt'].includes('auth.log.2.gz'));
  }
  assert(local.web.clockNote.includes('+0900'));
  assert(local.egress.tasks.find(t => t.id === 'upload-bytes').explanation.includes('196608'));
}
console.log(`Case realism: authentication counts, rotations, mixed zones, variable transfers, localization, and ${commandCount} teaching commands verified.`);
