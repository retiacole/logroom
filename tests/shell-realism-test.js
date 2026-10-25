'use strict';
const assert=require('node:assert/strict');
require('../src/shell.js');

const files={
  '/home/analyst/note.txt':'home note\n',
  '/home/analyst/.hidden':'hidden\n',
  '/tmp/good':'ok\n',
  '/tmp/digits':'123\nddd\n\\d\n',
  '/var/log/auth.log':'Aug 12 09:20:11 edge sshd[4]: Accepted password\n',
  '/var/log/auth.log.1':'Aug 11 23:40:00 edge sshd[3]: Failed password\n',
  '/var/log/auth.log.2.gz':'Aug 10 23:40:00 edge sshd[2]: Failed password archived\n',
  '/var/log/nginx/access.log':'192.0.2.1 - - [12/Aug/2026:18:20:12 +0900] "GET / HTTP/1.1" 200 5\n',
  '/var/log/app.log':'2026-08-12T09:20:13Z ready\n2026-08-12T08:00:00Z older line\n',
  '/etc/hostname':'training-edge\n'
};
let count=0;
const test=(name,body)=>{body();count++;};
const shell=()=>new LogLabShell(files,{now:'2026-08-13T10:15:00Z'});
const result=(sh,command,stdout,code=0,stderr='')=>{const actual=sh.run(command);assert.equal(actual.stdout,stdout,command);assert.equal(actual.stderr,stderr,command);assert.equal(actual.code,code,command);return actual;};

test('grep BRE and ERE reject digit shorthand with portable alternatives',()=>{
  const sh=shell();for(const command of [String.raw`grep '\d' /tmp/digits`,String.raw`grep -E '\D' /tmp/digits`,String.raw`grep -e 'x' -e '\d' /tmp/digits`]){const r=sh.run(command);assert.equal(r.code,2);assert.match(r.stderr,/\[0-9\].*\[\[:digit:\]\]/);}
  result(sh,"grep '[[:digit:]]' /tmp/digits",'123\n');
});
test('literal backslashes and fixed grep patterns remain usable',()=>{
  const sh=shell();result(sh,String.raw`grep -F '\d' /tmp/digits`,'\\d\n');result(sh,String.raw`grep '\\d' /tmp/digits`,'\\d\n');
});
test('ripgrep still accepts its digit shorthand',()=>result(shell(),String.raw`rg '\d+' /tmp/digits`,'123\n'));
test('nested repetition explains a bounded IPv4 alternative',()=>{
  const r=shell().run(String.raw`grep -E '([0-9]+\.)+' /tmp/digits`);assert.equal(r.code,2);assert.match(r.stderr,/\[0-9\]\{1,3\}/);
  result(shell(),String.raw`echo 192.0.2.1 | grep -E '[0-9]{1,3}(\.[0-9]{1,3}){3}'`,'192.0.2.1\n');
});
test('tilde expands only an unquoted initial tilde',()=>{
  const sh=shell();result(sh,String.raw`echo ~ ~/note.txt '~' "~/note.txt" \~ x~ ''~`,'/home/analyst /home/analyst/note.txt ~ ~/note.txt ~ x~ ~\n');
  result(sh,'cat ~/note.txt','home note\n');result(sh,'echo ~/*.txt','/home/analyst/note.txt\n');result(sh,'cd /tmp; cd ~; pwd','/home/analyst\n');
  result(sh,String.raw`echo ~"/foo" ~'' ~/'foo' ~""/foo`,'~/foo ~ /home/analyst/foo ~/foo\n');
});
test('stdout and stderr are separate by default',()=>result(shell(),'cat /missing /tmp/good','ok\n',1,'cat: /missing: No such file or directory\n'));
test('stderr to dev null preserves status and stdout',()=>{
  const sh=shell();result(sh,'cat /missing /tmp/good 2>/dev/null','ok\n',1);assert.equal(sh.isFile('/dev/null'),false);
  result(sh,'cat /dev/null','');result(sh,'cat /missing 2>/dev/null || echo handled','handled\n');
});
test('duplicate descriptor before output file preserves original stdout',()=>{
  const sh=shell();result(sh,'cat /missing /tmp/good 2>&1 > /tmp/output','cat: /missing: No such file or directory\n',1);result(sh,'cat /tmp/output','ok\n');
});
test('duplicate descriptor after output file redirects both in command order',()=>{
  const sh=shell();result(sh,'cat /missing /tmp/good > /tmp/output 2>&1','',1);result(sh,'cat /tmp/output','cat: /missing: No such file or directory\nok\n');
});
test('cat numbering preserves stderr order and lines spanning input files',()=>{
  const sh=shell();result(sh,'cat -n /missing /tmp/good 2>&1','cat: /missing: No such file or directory\n     1\tok\n',1);
  result(sh,"printf partial >/tmp/partial; cat -n /tmp/partial /missing /tmp/good 2>&1",'     1\tpartialcat: /missing: No such file or directory\nok\n',1);
});
test('independent same-file redirects reject incorrect offset simulation',()=>{
  const sh=shell(),r=sh.run('cat /missing /tmp/good > /tmp/shared 2> /tmp/./shared');assert.equal(r.code,2);assert.match(r.stderr,/independent redirects.*same file/);result(sh,'echo ok >/dev/null 2>/dev/null','');
});
test('stderr duplication feeds the pipe',()=>result(shell(),'cat /missing 2>&1 | grep -c "No such file"','1\n'));
test('stdout duplicate to stderr follows an already assigned descriptor',()=>{
  const sh=shell();result(sh,'echo text 2>/tmp/error 1>&2','');result(sh,'cat /tmp/error','text\n');
});
test('stderr append and quoted numeric arguments are parsed correctly',()=>{
  const sh=shell();result(sh,'cat /missing 2>/tmp/error','',1);result(sh,'cat /other 2>>/tmp/error','',1);result(sh,'cat /tmp/error','cat: /missing: No such file or directory\ncat: /other: No such file or directory\n');
  result(sh,"echo '2' > /tmp/number",'');result(sh,'cat /tmp/number','2\n');result(sh,'echo 2 >/tmp/number','');result(sh,'cat /tmp/number','2\n');
});
test('redirection failures use preceding stderr redirection',()=>result(shell(),'echo text 2>/dev/null >/missing/output','',1));
test('unsupported file descriptors fail explicitly',()=>{assert.match(shell().run('echo text 3>/tmp/three').stderr,/file descriptor/);assert.match(shell().run('echo text 2>&9').stderr,/only 1 and 2/);});
test('grep keeps readable-file output and reports failed input',()=>result(shell(),"grep ok /missing /tmp/good 2>/dev/null",'/tmp/good:ok\n',2));
test('ls long output retains GNU-style positional fields',()=>{
  const sh=shell(),row=sh.run('ls -l /var/log/auth.log').stdout.trim().split(/\s+/);assert.deepEqual(row.slice(0,4),['-rw-r-----','1','syslog','adm']);assert.deepEqual(row.slice(5),['Aug','12','09:20','/var/log/auth.log']);assert.equal(row.length,9);
  result(sh,"ls -l /var/log/auth.log | awk '{print $9}'",'/var/log/auth.log\n');
});
test('ls multiple file operands do not insert blank lines',()=>{const r=shell().run('ls -l /var/log/auth.log /var/log/auth.log.1');assert.equal(r.code,0);assert.equal(r.stdout.trimEnd().split('\n').length,2);assert.ok(!r.stdout.includes('\n\n'));});
test('ls time order reflects ISO nginx and yearless syslog timestamps',()=>{
  const sh=shell();result(sh,'ls -t /var/log/auth.log /var/log/nginx/access.log /var/log/app.log','/var/log/app.log\n/var/log/nginx/access.log\n/var/log/auth.log\n');
  result(sh,'ls --sort=time -r /var/log/auth.log /var/log/app.log','/var/log/auth.log\n/var/log/app.log\n');
});
test('stat and ls share metadata',()=>result(shell(),"stat -c '%a %U %G %Y' /var/log/auth.log",'640 syslog adm '+Date.parse('2026-08-12T09:20:11Z')/1000+'\n'));
test('metadata overrides and touch update ordering',()=>{
  const sh=new LogLabShell(files,{now:'2026-08-14T00:00:00Z',metadata:{'/tmp/good':{mode:'600',owner:'analyst',mtime:'2026-08-13T00:00:00Z'}}});
  result(sh,"stat -c '%a' /tmp/good",'600\n');result(sh,'touch /home/analyst/note.txt; ls -t /tmp/good /home/analyst/note.txt','/home/analyst/note.txt\n/tmp/good\n');
});
test('default analyst has adm read access',()=>{result(shell(),'cat /var/log/auth.log',files['/var/log/auth.log']);result(shell(),'id -nG','analyst adm\n');});
test('advanced mode denies protected auth rotation files',()=>{
  const sh=new LogLabShell(files,{groups:[]});for(const file of ['/var/log/auth.log','/var/log/auth.log.1','/var/log/auth.log.2.gz']){const r=sh.run((file.endsWith('.gz')?'zcat ':'cat ')+file);assert.equal(r.code,1);assert.match(r.stderr,/Permission denied/);}
  assert.match(sh.run('grep Accepted /var/log/auth.log').stderr,/Permission denied/);assert.match(sh.run('view /var/log/auth.log').stderr,/Permission denied/);
});
test('sudo elevation is scoped including errors and pipelines',()=>{
  const sh=new LogLabShell(files,{groups:[]});result(sh,'sudo cat /var/log/auth.log',files['/var/log/auth.log']);result(sh,'sudo whoami; whoami','root\nanalyst\n');
  result(sh,'sudo grep Accepted /var/log/auth.log | wc -l','1\n');sh.run('sudo cat /missing');assert.match(sh.run('cat /var/log/auth.log').stderr,/Permission denied/);
  assert.match(sh.run('sudo cat < /var/log/auth.log').stderr,/Permission denied/);
});
test('adm read access does not grant write access',()=>{
  const sh=shell(),before=sh.files['/var/log/auth.log'];
  for(const command of ['echo replaced > /var/log/auth.log','echo replaced | tee /var/log/auth.log','cp /tmp/good /var/log/auth.log',"sed -i 's/Accepted/Changed/' /var/log/auth.log",'touch /var/log/auth.log','rm /var/log/auth.log','mv /var/log/auth.log /tmp/stolen','mv /tmp/good /var/log/auth.log']){assert.match(sh.run(command).stderr,/Permission denied/,command);assert.equal(sh.files['/var/log/auth.log'],before,command);}
});
test('sudo tee writes protected files while shell redirects remain unprivileged',()=>{
  const sh=shell();result(sh,'echo appended | sudo tee -a /var/log/auth.log','appended\n');assert.ok(sh.files['/var/log/auth.log'].endsWith('appended\n'));assert.match(sh.run('sudo echo replaced > /var/log/auth.log').stderr,/Permission denied/);assert.equal(sh.getMetadata('/var/log/auth.log').owner,'syslog');
});
test('unprivileged copies cannot bypass read permissions and elevated editors are explicit',()=>{
  const sh=new LogLabShell(files,{groups:[]});assert.match(sh.run('cp /var/log/auth.log /tmp/copy').stderr,/Permission denied/);assert.equal(sh.isFile('/tmp/copy'),false);
  for(const command of ['sudo vi /var/log/auth.log','sudo view /var/log/auth.log','sudo sudo cat /var/log/auth.log']){const r=sh.run(command);assert.equal(r.code,2);assert.equal(r.editor,undefined);assert.match(r.stderr,/unsupported/);}
});
test('sudo cannot change the parent shell working directory',()=>{
  const sh=shell();assert.equal(sh.run('sudo cd /tmp').code,2);result(sh,'pwd','/home/analyst\n');for(const command of ['sudo history','sudo clear','sudo pwd'])assert.equal(sh.run(command).code,2);
});
test('root-owned directories reject unprivileged creation and deletion',()=>{
  const sh=shell();for(const command of ['mkdir -p /var/log/new/deep','touch /var/log/new.log'])assert.match(sh.run(command).stderr,/Permission denied/);
  result(sh,'sudo mkdir /var/log/new','');assert.equal(sh.getMetadata('/var/log/new').owner,'root');assert.match(sh.run('rmdir /var/log/new').stderr,/Permission denied/);result(sh,'sudo rmdir /var/log/new','');
});
test('rename preserves owner mode and mtime without content read privilege',()=>{
  const sh=shell(),original={...sh.getMetadata('/var/log/auth.log')};result(sh,'sudo mv /var/log/auth.log /tmp/moved-auth','');assert.deepEqual(sh.getMetadata('/tmp/moved-auth'),original);assert.equal(sh.metadata['/var/log/auth.log'],undefined);assert.equal(sh.isFile('/var/log/auth.log'),false);
  result(sh,'mkdir /tmp/dir; touch /tmp/dir/file; mv /tmp/dir /tmp/renamed','');assert.ok(sh.metadata['/tmp/renamed/file']);assert.equal(sh.metadata['/tmp/dir/file'],undefined);
});
test('metadata numbers survive construction round trips',()=>{
  const sh=shell();sh.run('touch /home/analyst/note.txt');const restored=new LogLabShell(sh.files,{metadata:JSON.parse(JSON.stringify(sh.metadata))});assert.deepEqual(restored.getMetadata('/home/analyst/note.txt'),sh.getMetadata('/home/analyst/note.txt'));
});
test('protected metadata stays visible without file read permissions',()=>{const r=new LogLabShell(files,{groups:[]}).run('ls -l /var/log/auth.log');assert.equal(r.code,0);assert.match(r.stdout,/syslog adm/);});
test('ordinary readers cannot silently read decompressed gz backing text',()=>{
  const sh=shell();for(const command of ['cat','less','head','strings','vi']){const r=sh.run(command+' /var/log/auth.log.2.gz');assert.equal(r.code,1);assert.match(r.stderr,/zcat, zgrep, or zless/);assert.equal(r.stdout,'');}
});
test('z commands simulate decompression and pager behavior',()=>{
  const sh=shell();result(sh,'zcat /var/log/auth.log.2.gz',files['/var/log/auth.log.2.gz']);result(sh,"zgrep -c 'Failed' /var/log/auth.log.2.gz",'1\n');assert.equal(result(sh,'zless /var/log/auth.log.2.gz',files['/var/log/auth.log.2.gz']).pager,true);
  assert.match(sh.run('cat /var/log/auth.log.2.gz').stderr,/gzip fixture/);
});
test('gzip fixture metadata survives copy and rename independent of filename',()=>{
  const sh=shell();result(sh,'cp /var/log/auth.log.2.gz /tmp/copied; sudo mv /var/log/auth.log.2.gz /tmp/renamed','');for(const path of ['/tmp/copied','/tmp/renamed']){assert.equal(sh.getMetadata(path).compressed,true);assert.match(sh.run('cat '+path).stderr,/gzip fixture/);assert.match(sh.run('file '+path).stdout,/gzip compressed data/);result(sh,'zcat '+path,files['/var/log/auth.log.2.gz']);}
});
test('filename extensions do not create compression and writes replace fixture type',()=>{
  const sh=shell();result(sh,'echo plain > /tmp/plain.gz; cat /tmp/plain.gz','plain\n');assert.equal(sh.getMetadata('/tmp/plain.gz').compressed,false);assert.match(sh.run('zcat /tmp/plain.gz').stderr,/not in gzip format/);
  result(sh,'echo replacement | sudo tee /var/log/auth.log.2.gz','replacement\n');result(sh,'cat /var/log/auth.log.2.gz','replacement\n');assert.equal(sh.getMetadata('/var/log/auth.log.2.gz').compressed,false);
  const restored=new LogLabShell(sh.files,{metadata:sh.metadata});result(restored,'cat /tmp/plain.gz','plain\n');
});
test('binary append cannot expose a compressed fixture backing text',()=>{
  const sh=shell(),before=sh.files['/var/log/auth.log.2.gz'];assert.match(sh.run('echo added | sudo tee -a /var/log/auth.log.2.gz').stderr,/appending binary bytes/);assert.equal(sh.files['/var/log/auth.log.2.gz'],before);assert.equal(sh.getMetadata('/var/log/auth.log.2.gz').compressed,true);
});
test('file identifies the gzip simulation boundary',()=>{assert.match(shell().run('file /var/log/auth.log.2.gz').stdout,/gzip compressed data \(simulated fixture/);});
test('identity and help teach the host distinction',()=>{
  const sh=shell();result(sh,'whoami','analyst\n');result(sh,'hostname','training-edge\n');result(sh,'id -u','1000\n');result(sh,'which grep','/usr/bin/grep\n');assert.equal(sh.run('which cd').code,1);assert.match(sh.run('help help').stdout,/In Bash, help documents shell builtins/);assert.equal(sh.run('man grep').pager,true);
});
test('GNU-style root failsafe preserves data',()=>{
  const sh=shell(),before=JSON.stringify(sh.files);for(const command of ['rm -rf /','rm -fr /','rm --recursive --force /','rm -r /','rm -rf /./']){const r=sh.run(command);assert.equal(r.code,1);assert.equal(r.gameOver,undefined);assert.match(r.stderr,/dangerous to operate recursively/);assert.equal(JSON.stringify(sh.files),before);}
});
test('game over requires explicit standalone no-preserve-root',()=>{
  const sh=shell();assert.equal(sh.run('rm -rf --no-preserve-root /').gameOver,true);
  for(const command of ['rm -rf --no-preserve-root / | cat','rm -rf --no-preserve-root / >/tmp/out','rm -rf --no-preserve-root /; pwd'])assert.equal(sh.run(command).gameOver,undefined);
});

console.log('shell-realism-test: '+count+' review regression checks passed');
