'use strict';
const assert = require('node:assert/strict');
require('../src/cases.js');
const cases = Object.fromEntries(LOG_LAB_CASES.map(c => [c.id, c]));
const lines = text => text.trimEnd().split('\n');
const value = (line, key) => line.match(new RegExp('(?:^| )' + key + '=([^ ]+)'))?.[1];
const accessPath = '/var/log/nginx/access.log';
const auditPath = '/var/log/app/audit.log';
const request = line => ({id:value(line,'request_id'),ip:line.split(' ')[0],method:line.match(/"(\S+) /)[1],path:line.match(/"\S+ (\S+) /)[1],status:Number(line.match(/HTTP\/1\.1" (\d+)/)[1]),bytes:Number(line.match(/HTTP\/1\.1" \d+ (\d+)/)[1])});

// Every application observation is backed by the same HTTP request, source and instant.
const access = lines(cases.web.files[accessPath]).map(line => ({...request(line), line}));
const audit = lines(cases.web.files[auditPath]);
for (const event of audit) {
  const http = access.filter(r => r.id === value(event,'request_id'));
  assert.equal(http.length,1,event);
  assert.equal(http[0].ip,value(event,'src_ip'));
  const [, date, time, zone] = http[0].line.match(/\[(\d+)\/Aug\/2026:(\d\d:\d\d:\d\d) ([+-]\d{4})\]/);
  assert.equal(Date.parse(`2026-08-${date}T${time}${zone.slice(0,3)}:${zone.slice(3)}`),Date.parse(event.split(' ')[0]));
}
for (const actor of ['staff-a','staff-b']) {
  const events = audit.filter(row => value(row,'actor') === actor);
  const login = events.find(row => value(row,'action') === 'login');
  assert(login,actor);
  assert(events.filter(row=>value(row,'action')==='page_view').length > 1);
  assert.equal(new Set(events.map(row=>value(row,'src_ip'))).size,1);
  assert.equal(new Set(events.map(row=>value(row,'session_id'))).size,1);
  assert(events.every(row=>Date.parse(row.split(' ')[0]) >= Date.parse(login.split(' ')[0])));
}
const targetAccess = access.filter(row=>row.ip==='203.0.113.88');
const histogram = targetAccess.reduce((acc,row)=>(acc[row.status]=(acc[row.status]||0)+1,acc),{});
assert.deepEqual(histogram,{200:4,302:1,401:8,403:1,404:5});
assert.equal(Number(cases.web.tasks.find(t=>t.id==='not-found-count').answer),histogram[404]);
for (const id of ['req-scan-0','req-scan-7','req-2031']) assert.equal(access.find(row=>row.id===id).status,401);
assert.equal(access.find(row=>row.id==='req-2049').status,403);
// Immutable resources retain stable body sizes; dynamic pages can vary.
for (const path of ['/assets/app.css','/assets/app.js','/favicon.ico']) {
  assert.equal(new Set(access.filter(row=>row.path===path&&row.status===200).map(row=>row.bytes)).size,1);
}

// Sudo activity is enclosed by the invoking account's SSH session and its own PAM pair.
const auth = lines(cases.ssh.files['/var/log/auth.log']);
const opsSudo = auth.find(row=>row.includes('sudo: ops :'));
const at = row => row.slice(7,15);
const sessionOpen = auth.filter(row=>row.includes('pam_unix(sshd:session): session opened for user ops'));
assert(sessionOpen.some(open=> {
  const pid=open.match(/sshd\[(\d+)\]/)[1];
  const close=auth.find(row=>row.includes(`sshd[${pid}]`)&&row.includes('session closed'));
  return close && at(open)<=at(opsSudo) && at(opsSudo)<=at(close);
}));
assert(auth.some(row=>row.includes('pam_unix(sudo:session): session opened')&&row.includes('by ops')));
assert(auth.some(row=>row.includes('sudo[1810]: pam_unix(sudo:session): session closed')));

// Each process start has one matching termination in the same request, including normal runs.
for (const state of ['files','baselineFiles']) {
  const processes = lines(cases.cmdinj[state]['/var/log/process/exec.log']);
  const starts = processes.filter(row=>value(row,'event')==='exec');
  const exits = processes.filter(row=>value(row,'event')==='exit');
  assert.equal(starts.length,exits.length);
  for (const start of starts) {
    const matches=exits.filter(row=>value(row,'pid')===value(start,'pid')&&value(row,'request_id')===value(start,'request_id'));
    assert.equal(matches.length,1,start);
    assert(Date.parse(matches[0].split(' ')[0])>=Date.parse(start.split(' ')[0]));
  }
}

// An endpoint has one query-construction mode, independent of whether input is malicious.
const sqlAccess = lines(cases.sqli.files[accessPath]).map(request);
const db = lines(cases.sqli.files['/var/log/db/query.log']);
for (const row of db) {
  const http=sqlAccess.find(r=>r.id===value(row,'request_id'));
  assert(http,row);
  assert.equal(value(row,'mode'),http.path.startsWith('/api/search-legacy?')?'interpolated':'prepared');
}
assert.equal(db.filter(row=>value(row,'mode')==='prepared').length,25);

// Submission clients resolve HTTP hosts; the mail server resolves its delivery route.
const dns = lines(cases.egress.files['/var/log/named/query.log']);
const related=dns.filter(row=>value(row,'qname').endsWith('archive-sync.example'));
const client=related.filter(row=>value(row,'client').startsWith('192.0.2.34#'));
assert.equal(client.length,2);
assert(client.every(row=>value(row,'qtype')==='A'&&value(row,'qname')==='archive-sync.example'));
assert.equal(new Set(client.map(row=>value(row,'qname'))).size,Number(cases.egress.tasks.find(t=>t.id==='dns-names').answer));
const server=related.filter(row=>value(row,'client').startsWith('192.0.2.24#'));
assert.deepEqual(server.map(row=>value(row,'qtype')),['MX','A']);
assert.equal(value(server[0],'answer').split(':')[1],value(server[1],'qname'));
const mail=lines(cases.egress.files['/var/log/mail.log']);
assert.equal(new Set(mail.filter(row=>row.includes('postfix/qmgr[')).map(row=>row.match(/qmgr\[(\d+)\]/)[1])).size,1);
for (const queued of mail.filter(row=>row.includes(' (queue active)'))) {
  const id=queued.match(/postfix\/qmgr\[\d+\]: (\S+):/)[1];
  assert.equal(mail.filter(row=>row.includes(`: ${id}: message-id=`)).length,1,id);
}
const accepted=mail.find(row=>row.includes('client=ws-34.'));
const delivered=mail.find(row=>row.includes('to=<drop@archive-sync.example>'));
assert(server.every(row=>Date.parse(row.split(' ')[0])>=Date.parse(accepted.split(' ')[0])&&Date.parse(row.split(' ')[0])<=Date.parse(delivered.split(' ')[0])));
console.log('Core coherence: request joins, sessions, authorization, query modes, process lifecycles and mail routing verified.');
