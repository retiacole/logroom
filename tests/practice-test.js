'use strict';
const assert = require('node:assert/strict');
const {gunzipSync} = require('node:zlib');
for (const source of ['shell','cases','cases-extra','case-context','case-reading-a','case-reading-b','locales/ui','locales/cases-a','locales/cases-b','locales/cases-c','i18n','practice']) require('../src/' + source + '.js');
const p = LogroomPractice, originals = JSON.stringify(LOG_LAB_CASES);
assert.equal(p.normalizeAnswer('　１９８．５１．１００．７３。　'), '198.51.100.73');
assert.equal(p.normalizeAnswer('６０，'), '60');
assert.equal(p.normalizeAnswer('/USR/BIN/systemctl   restart nginx'), '/usr/bin/systemctl restart nginx');
for (const language of ['ja','en','th']) {
  const variants = p.variantCases(LogroomI18n.localizeCases(LOG_LAB_CASES, language), {seed:'review-42',advanced:true});
  const ssh = variants[0];
  assert.notEqual(ssh.tasks[0].answer, LOG_LAB_CASES[0].tasks[0].answer);
  assert.ok(ssh.files['/var/log/auth.log'].split('\n').length > 20000);
  assert.ok(Buffer.byteLength(ssh.files['/var/log/auth.log']) < 2097152);
  for (const c of variants) for (const task of c.tasks) for (const e of task.evidence) assert.equal(c.files[e.path].split('\n')[e.line-1], e.quote, c.id + ':' + task.id);
  const shell = new LogLabShell(ssh.files,{groups:['analyst']});
  assert.match(shell.run('cat /var/log/auth.log').stderr,/Permission denied/);
  const ip = ssh.tasks[0].answer;
  const aggregate = shell.run(`sudo grep 'Failed password' /var/log/auth.log | grep '${ip}' | wc -l`);
  assert.equal(aggregate.stdout,'60\n');
  assert.equal(p.checkTimeline(ssh,shell.files),false);
  const command=`sudo grep '${ip}' /var/log/auth.log | sort -k1,1M -k2,2n -k3,3 > /home/analyst/timeline.txt`;
  const result = shell.run(command); assert.equal(result.code,0,JSON.stringify(result));
  assert.equal(p.checkTimeline(ssh,shell.files),true,command);
  shell.files['/home/analyst/timeline.txt'] += 'invented evidence\n';
  assert.equal(p.checkTimeline(ssh,shell.files),false);
}
assert.equal(JSON.stringify(LOG_LAB_CASES), originals,'variants must not mutate canonical data');
assert.deepEqual(p.variantCases(LOG_LAB_CASES,{seed:'same'}), p.variantCases(LOG_LAB_CASES,{seed:'same'}));
assert.notDeepEqual(p.variantCases(LOG_LAB_CASES,{seed:'one'}), p.variantCases(LOG_LAB_CASES,{seed:'two'}));
for (const seed of ['95','185',...Array.from({length:20},(_,i)=>String(i))]) {
  const ssh=p.variantCases(LOG_LAB_CASES,{seed})[0], shell=new LogLabShell(ssh.files),ip=ssh.tasks[0].answer;
  assert.equal(shell.run(`grep 'Failed password' /var/log/auth.log | grep '${ip}' | wc -l`).stdout,'60\n',seed);
  assert.ok(p.timeline(ssh).text.split('\n').filter(Boolean).every(line=>new RegExp('(?:^|[^0-9.])'+ip.replace(/\./g,'\\.')+'(?:$|[^0-9.])').test(line)));
}
async function archiveTest() {
  const files = {'/var/log/auth.log':'Aug 12 09:00:00 test\n','/var/log/auth.log.2.gz':'Aug  9 09:00:00 history\n','/home/analyst/timeline.txt':'proof\n','/baseline/var/log/auth.log':'omit\n'};
  const blob = await p.logArchive(files, 'ssh'), bytes = Buffer.from(await blob.arrayBuffer());
  const unpacked = {};
  for (let at = 0; bytes[at];) {
    const header = bytes.subarray(at, at+512), name = header.subarray(0,100).toString().replace(/\0.*/, ''), size = parseInt(header.subarray(124,136).toString(),8);
    assert.ok(!name.startsWith('/') && !name.includes('..'));
    const checksum = parseInt(header.subarray(148,156).toString(),8);
    const expected = header.reduce((sum,byte,index)=>sum+(index>=148&&index<156?32:byte),0);
    assert.equal(checksum,expected,'tar header checksum');
    unpacked[name] = bytes.subarray(at+512,at+512+size); at += 512 + Math.ceil(size/512)*512;
  }
  assert.equal(unpacked['logroom-ssh/var/log/auth.log'].toString(),files['/var/log/auth.log']);
  assert.equal(gunzipSync(unpacked['logroom-ssh/var/log/auth.log.2.gz']).toString(),files['/var/log/auth.log.2.gz']);
  assert.equal(unpacked['logroom-ssh/home/analyst/timeline.txt'].toString(),'proof\n');
  assert.ok(unpacked['logroom-ssh/HOWTO.txt']);
  assert.ok(!Object.keys(unpacked).some(path=>path.includes('baseline')));
  console.log('Practice tests passed: NFKC answers, 3-language seeded evidence, 20k log aggregation, timeline validation, valid tar and real gzip.');
}
archiveTest().catch(error=>{console.error(error);process.exitCode=1;});
