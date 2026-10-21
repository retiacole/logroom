'use strict';
const assert=require('node:assert/strict');
require('../src/cases.js');require('../src/cases-extra.js');require('../src/shell.js');
const all=globalThis.LOG_LAB_CASES, cases=Object.fromEntries(all.map(c=>[c.id,c]));
const A='/var/log/nginx/access.log',J='/var/log/app/audit.jsonl',T='/var/log/app/audit.log';
const rows=(id,p,base=false)=>(base?cases[id].baselineFiles:cases[id].files)[p].trimEnd().split('\n');
const match=(line,re)=>{const m=line.match(re);assert.ok(m,String(re));return m[1];};
const json=id=>rows(id,J).map(JSON.parse);
const get=(id,rid)=>json(id).find(x=>x.request_id===rid);
let facts=0,commands=0,evidence=0;
const check=(id,key,value)=>{assert.equal(cases[id].tasks.find(t=>t.id===key).answer,String(value),id+':'+key);facts++;};
assert.equal(all.length,10);assert.equal(all.reduce((n,c)=>n+c.tasks.length,0),104);
for(const c of all.slice(5)){
 assert.equal(c.tasks.length,10);assert.ok(c.attack&&c.logPaths.length);
 const fs={...c.files,...Object.fromEntries(Object.entries(c.baselineFiles).map(([p,s])=>['/baseline'+p,s]))},shell=new LogLabShell(fs),ids=new Set();
 for(const t of c.tasks){assert.ok(!ids.has(t.id));ids.add(t.id);assert.ok(t.accepted.includes(t.answer));assert.equal(t.hints.length,2);for(const e of t.evidence){assert.equal(rows(c.id,e.path)[e.line-1],e.quote);evidence++;}for(const h of t.hints){const r=shell.run(h.command);assert.equal(r.code,0,h.command);assert.equal(r.stderr,'',h.command);assert.ok(r.stdout.trim(),h.command);commands++;}}
 for(const w of c.walkthrough){const r=shell.run(w.command);assert.equal(r.code,0,w.command);assert.equal(r.stderr,'',w.command);assert.ok(r.stdout.trim(),w.command);commands++;}
 const normal=c.logPaths.reduce((n,p)=>n+rows(c.id,p,true).length,0);assert.ok(normal>=70&&normal<=130);
 for(const p of c.logPaths){if(c.id==='tamper'&&p===A)continue;const full=rows(c.id,p);let at=-1;for(const row of rows(c.id,p,true)){at=full.indexOf(row,at+1);assert.ok(at>=0,c.id+':lost normal '+p);}}
 const jr=json(c.id),tr=rows(c.id,T);assert.equal(jr.length,tr.length);for(const x of jr)assert.ok(tr.some(y=>y.startsWith(x.timestamp)&&y.includes('request_id='+x.request_id)));
}

const P='/var/log/audit/file.log',pf=rows('pathtraversal',P),pj=json('pathtraversal'),p2=get('pathtraversal','req-path-302');
check('pathtraversal','source',p2.src_ip);check('pathtraversal','root',p2.allowed_root);check('pathtraversal','path',match(pf.find(x=>x.includes('req-path-302')), /path=(\S+)/));check('pathtraversal','bytes',+match(pf.find(x=>x.includes('req-path-302')), /bytes=(\d+)/));check('pathtraversal','os-user',match(pf.find(x=>x.includes('req-path-302')),/user=(\S+)/));check('pathtraversal','confirmed',pj.find(x=>x.result==='success'&&/^req-path-30/.test(x.request_id)).request_id);check('pathtraversal','blocked',pj.find(x=>x.reason==='outside_root').request_id);check('pathtraversal','missing',match(pf.find(x=>x.includes('req-path-303')),/result=(\S+)/));check('pathtraversal','request-count',rows('pathtraversal',A).filter(x=>x.startsWith(p2.src_ip+' ')).length);check('pathtraversal','read-count',pf.filter(x=>/request_id=req-path-30/.test(x)&&x.includes('result=success ')).length);

const W='/var/log/session/events.log',wj=json('webauth'),w5=get('webauth','req-wa-505'),w6=get('webauth','req-wa-506'),wl=wj.filter(x=>x.action==='login'&&x.src_ip===w5.src_ip);
check('webauth','source',w5.src_ip);check('webauth','failure-count',wl.filter(x=>x.result==='failure').length);check('webauth','name-count',new Set(wl.map(x=>x.actor)).size);check('webauth','account',w5.actor);check('webauth','login-time',w5.timestamp.slice(11,19));assert.equal(w5.session_id,w6.session_id);check('webauth','session',w6.session_id);check('webauth','resource',w6.resource);check('webauth','rows',w6.rows);check('webauth','mfa',w5.mfa_used);check('webauth','revoke-time',rows('webauth',W).find(x=>x.includes('event=revoke ')).slice(11,19));

const N='/var/log/egress/http.log',nf=rows('ssrf',N),sj=json('ssrf'),s2=get('ssrf','req-ssrf-402'),internal=nf.find(x=>x.includes('host=config.internal.test ')),redirect=nf.find(x=>x.includes('result=redirect '));
check('ssrf','source',s2.src_ip);check('ssrf','blocked',sj.find(x=>x.reason==='destination_policy').request_id);check('ssrf','confirmed',sj.find(x=>/^req-ssrf-40/.test(x.request_id)&&x.result==='success').request_id);assert.ok(internal.includes('request_id='+s2.request_id));check('ssrf','internal-ip',match(internal,/dst=(\S+)/));check('ssrf','worker-ip',match(internal,/src=(\S+)/));check('ssrf','redirect',+match(redirect,/status=(\d+)/));check('ssrf','bytes',+match(internal,/bytes=(\d+)/));check('ssrf','egress-count',nf.filter(x=>/request_id=req-ssrf-40\d/.test(x)).length);check('ssrf','success-count',sj.filter(x=>/^req-ssrf-40/.test(x.request_id)&&x.result==='success').length);check('ssrf','final-url',s2.final_url);

const U='/var/log/audit/artifact.log',uf=rows('upload',U),uj=json('upload'),u3=get('upload','req-up-403'),u4=get('upload','req-up-404'),exe=uf.find(x=>x.includes('event=exec ')),stored=uj.filter(x=>x.action==='upload'&&x.result==='stored'&&x.src_ip===u3.src_ip);
check('upload','source',u3.src_ip);check('upload','denied',uj.find(x=>x.reason==='extension_blocked').request_id);check('upload','route',rows('upload',A).find(x=>x.endsWith('request_id=req-up-403')).split(/\s+/)[6]);check('upload','type',u3.detected_type);check('upload','path',match(uf.find(x=>x.includes('req-up-403')),/path=(\S+)/));assert.equal(u3.file_id,u4.file_id);check('upload','file-id',u4.file_id);check('upload','exe',match(exe,/exe=(\S+)/));assert.ok(uf.some(x=>x.includes('event=exit pid='+match(exe,/pid=(\d+)/)+' status=0')));check('upload','user',match(exe,/user=(\S+)/));check('upload','stored-count',stored.length);check('upload','stored-bytes',stored.reduce((n,x)=>n+x.bytes,0));

const F='/var/log/auth.log',C='/var/log/collector/nginx-access.log',tj=json('tamper'),trunc=tj.find(x=>x.action==='file_truncate'),auth=rows('tamper',F).find(x=>x.includes('Accepted publickey for maint'));
check('tamper','actor',trunc.actor);check('tamper','source',match(auth,/from (\S+)/));check('tamper','path',trunc.path);assert.equal(trunc.old_size,Buffer.byteLength(cases.tamper.baselineFiles[A],'utf8'));check('tamper','old-size',trunc.old_size);check('tamper','active-count',rows('tamper',A).length);check('tamper','collector-count',rows('tamper',C).length);check('tamper','euid',trunc.euid);check('tamper','pid',trunc.pid);assert.ok(rows('tamper',F).some(x=>x.includes('sudo['+trunc.ppid+']')));check('tamper','serial',trunc.audit_serial);check('tamper','gap',(Date.parse(trunc.timestamp)-Date.parse(auth.slice(0,20)))/1000);
assert.equal(facts,50);
for(const [id,command,expected] of [
 ['pathtraversal',"grep 'req-path-' /var/log/audit/file.log | grep 'result=success ' | wc -l",'1'],
 ['webauth',"jq -r 'select(.action == \"login\" and .src_ip == \"203.0.113.142\") | .actor' /var/log/app/audit.jsonl | sort | uniq | wc -l",'2'],
 ['ssrf',"grep 'req-ssrf-40' /var/log/egress/http.log | wc -l",'3'],
 ['ssrf',"grep 'req-ssrf-40' /var/log/app/audit.log | grep 'result=success ' | wc -l",'1'],
 ['upload',"grep 'req-up-' /var/log/app/audit.log | grep 'action=upload ' | grep 'result=stored ' | wc -l",'2'],
 ['tamper','wc -l /var/log/nginx/access.log','2 /var/log/nginx/access.log']
])assert.equal(new LogLabShell(cases[id].files).run(command).stdout.trim(),expected,command);
console.log('PASS: 10 cases / 104 tasks; 50 independently derived new answers, '+evidence+' evidence references, '+commands+' successful commands; baselines and JSON views checked.');
