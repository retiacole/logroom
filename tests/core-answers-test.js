'use strict';
const assert=require('node:assert/strict');
require('../src/cases.js');
require('../src/case-context.js');
require('../src/case-reading-a.js');
require('../src/locales/cases-a.js');
require('../src/locales/cases-b.js');
require('../src/i18n.js');
const cases=Object.fromEntries(LOG_LAB_CASES.map(c=>[c.id,c]));
const rows=(c,p)=>c.files[p].trimEnd().split('\n');
const fields=line=>Object.fromEntries([...line.matchAll(/(?:^| )([\w_]+)=("(?:[^"\\]|\\.)*"|\S+)/g)].map(([,key,val])=>[key,val.startsWith('"')?JSON.parse(val):val]));
const time=line=>line.startsWith('Aug ')?'2026-08-12T'+line.slice(7,15)+'Z':line.split(' ')[0];
const delta=(later,earlier)=>(Date.parse(time(later))-Date.parse(time(earlier)))/1000;
const counts=values=>values.reduce((a,k)=>(a[k]=(a[k]||0)+1,a),{});
const maxKey=counts=>Object.keys(counts).sort((a,b)=>counts[b]-counts[a])[0];
const http=line=>{const m=line.match(/^(\S+) .*\[(\d+)\/Aug\/(\d+):(\d\d:\d\d:\d\d) ([+-]\d{4})\] "(\S+) (\S+) HTTP\/1.1" (\d+) (\d+)/);return {...fields(line),ip:m[1],timestamp:new Date(`${m[3]}-08-${m[2]}T${m[4]}${m[5].slice(0,3)}:${m[5].slice(3)}`).toISOString().replace('.000Z','Z'),method:m[6],url:m[7],status:+m[8],bytes:+m[9]};};
const A='/var/log/nginx/access.log',J='/var/log/app/audit.jsonl',T='/var/log/app/audit.log';
const derived={};
{
 const c=cases.ssh,auth=rows(c,'/var/log/auth.log'),failures=auth.filter(l=>l.includes('Failed password for ')),ip=l=>l.match(/ from (\S+) port /)[1],account=l=>l.match(/for (?:invalid user )?(\S+) from/)[1];
 const source=maxKey(counts(failures.map(ip))),target=failures.filter(l=>ip(l)===source),accepted=auth.find(l=>l.includes('Accepted password for ')&&ip(l)===source),user=account(accepted),sudo=auth.filter(l=>l.includes(`sudo: ${user} :`)&&l.includes('COMMAND='));
 derived.ssh={source,count:target.length,account:user,'login-time':time(accepted).slice(11,19),sudo:sudo.find(l=>l.includes('restart nginx')).split('COMMAND=')[1],'target-count':new Set(target.map(account)).size,'top-target':maxKey(counts(target.map(account))),'success-gap':delta(accepted,target.at(-1)),'sudo-count':sudo.length,'trusted-key-count':auth.filter(l=>l.includes('Accepted publickey for ops from 192.0.2.10 port ')).length};
}
{
 const c=cases.web,access=rows(c,A).map(http),audit=rows(c,T).map(l=>({...fields(l),timestamp:time(l)})),source=access.find(r=>r.url==='/backup').ip,target=access.filter(r=>r.ip===source),login=audit.find(r=>r.src_ip===source&&r.action==='login'&&r.result==='success'),exported=audit.find(r=>r.src_ip===source&&r.action==='data_export'&&r.result==='success'),httpExport=target.find(r=>r.request_id===exported.request_id),denied=audit.find(r=>r.actor===login.actor&&r.reason==='insufficient_permission');
 derived.web={source,account:login.actor,endpoint:httpExport.url,rows:exported.rows,'request-id':exported.request_id,'request-count':target.length,'not-found-count':target.filter(r=>r.status===404).length,'denied-resource':denied.resource,'response-bytes':httpExport.bytes,'login-export-gap':(Date.parse(exported.timestamp)-Date.parse(login.timestamp))/1000};
}
{
 const c=cases.egress,proxy=rows(c,'/var/log/proxy/access.log').map(l=>({...fields(l),timestamp:time(l)})),dns=rows(c,'/var/log/named/query.log').map(l=>({...fields(l),timestamp:time(l)})),mail=rows(c,'/var/log/mail.log'),posts=proxy.filter(r=>r.method==='POST'&&r.path==='/v1/upload'),source=posts[0].src,domain=posts[0].host,accepted=mail.find(l=>l.includes('['+source+']')),queue=accepted.match(/postfix\/submission\/smtpd\[\d+\]: (\S+):/)[1],queued=mail.find(l=>l.includes(queue)&&l.includes(' (queue active)')),sent=mail.find(l=>l.includes(queue)&&l.includes('status=sent')),relatedDns=dns.filter(r=>r.client.startsWith(source+'#')&&r.qname.endsWith(domain)),first=rows(c,'/var/log/proxy/access.log').concat(rows(c,'/var/log/named/query.log'),mail).filter(l=>l.includes(domain)).sort((a,b)=>time(a).localeCompare(time(b)))[0];
 derived.egress={workstation:source,domain,'dns-answer':relatedDns.find(r=>r.qname===domain&&r.qtype==='A').answer,'post-count':posts.length,'mail-account':fields(accepted).sasl_username,queue,'upload-bytes':posts.reduce((n,r)=>n+ +r.bytes_out,0),'dns-names':new Set(relatedDns.map(r=>r.qname)).size,'mail-size':fields(queued).size.replace(',',''),'mail-delay':fields(sent).delay.replace(',',''),'first-domain-time':time(first).slice(11,19),recipient:sent.match(/ to=<([^>]+)>/)[1]};
}
{
 const c=cases.sqli,app=rows(c,J).map(JSON.parse),db=rows(c,'/var/log/db/query.log').map(fields),access=rows(c,A).map(http),error=app.find(r=>r.reason==='db_syntax'),changed=app.find(r=>r.query_shape_changed===true),query=db.find(r=>r.request_id===changed.request_id),normal=app.find(r=>r.input==="O'Brien");
 assert.equal(error.src_ip,changed.src_ip);
 derived.sqli={source:changed.src_ip,'syntax-request':error.request_id,'success-request':changed.request_id,rows:query.rows_read,'benign-mode':db.find(r=>r.request_id===normal.request_id).mode,'observed-shape':query.observed_shape,'db-user':query.app_user,'prepared-count':db.filter(r=>r.mode==='prepared'&&r.query_shape_changed==='false').length,'normal-term-count':new Set(app.filter(r=>r.query_shape_changed===false).map(r=>r.input)).size,'response-bytes':access.find(r=>r.request_id===changed.request_id).bytes};
}
{
 const c=cases.cmdinj,app=rows(c,J).map(JSON.parse),proc=rows(c,'/var/log/process/exec.log').map(l=>({...fields(l),timestamp:time(l)})),access=rows(c,A).map(http),normal=app.filter(r=>!r.separator_seen),suspicious=app.filter(r=>r.separator_seen),denied=suspicious.find(r=>r.child_started===false),executed=suspicious.find(r=>r.unexpected_child&&r.unexpected_child!=='none'),unexpected=proc.find(r=>r.exe===executed.unexpected_child&&r.event==='exec'),exit=proc.find(r=>r.event==='exit'&&r.pid===unexpected.pid),parent=proc.find(r=>r.event==='exec'&&r.pid===unexpected.ppid),parentExit=proc.find(r=>r.event==='exit'&&r.pid===parent.pid);
 assert.equal(exit.status,'0');assert.equal(new Set(suspicious.map(r=>r.src_ip)).size,1);
 derived.cmdinj={source:suspicious[0].src_ip,denied:denied.request_id,'unexpected-exe':unexpected.exe,'run-user':unexpected.user,'executed-request':executed.request_id,parent:unexpected.ppid,'decoded-target':executed.target,'exec-count':proc.filter(r=>r.event==='exec'&&r.request_id===executed.request_id).length,'normal-exec-count':proc.filter(r=>r.event==='exec'&&normal.some(a=>a.request_id===r.request_id)).length,'parent-exe':parent.exe,'shell-duration':(Date.parse(parentExit.timestamp)-Date.parse(parent.timestamp))/1000,'response-delta':access.find(r=>r.request_id===executed.request_id).bytes-access.find(r=>r.request_id===denied.request_id).bytes};
}
let total=0;
for(const [id,answers] of Object.entries(derived)) {
 const c=cases[id];assert.equal(Object.keys(answers).length,c.tasks.length);
 for(const q of c.tasks){assert.equal(String(answers[q.id]),q.answer,id+'/'+q.id);total++;}
 console.log(id+': '+c.tasks.length+' independently derived answers match');
}
// Check chronology, cross-log instants and full observed periods independently of context generation.
for(const c of Object.values(cases)) {
 const allTimes=[];
 for(const path of c.logPaths) {
  const data=rows(c,path),times=[];
  for(const row of data){let t;if(path===A)t=http(row).timestamp;else if(row.startsWith('{')) t=JSON.parse(row).timestamp;else t=time(row);assert(!Number.isNaN(Date.parse(t)),c.id+path);times.push(t);}
  assert.deepEqual(times,[...times].sort(),c.id+path+' chronology');allTimes.push(...times);
 }
 allTimes.sort();const format=t=>t.slice(0,10).replaceAll('-','/')+' '+t.slice(11,19);
 assert(c.context.period.includes(format(allTimes[0]))&&c.context.period.includes(format(allTimes.at(-1))),c.id+' period');
 for(const lang of ['en','th']){const local=LogroomI18n.localizeCases([c],lang)[0];assert(local.context.period.includes(format(allTimes[0]))&&local.context.period.includes(format(allTimes.at(-1))),c.id+' '+lang+' period');}
 if(c.files[A]) {
  const access=rows(c,A).map(http),app=c.files[J]?rows(c,J).map(JSON.parse):rows(c,T).map(l=>({...fields(l),timestamp:time(l)}));
  for(const event of app){const req=access.filter(r=>r.request_id===event.request_id);assert.equal(req.length,1,c.id+' HTTP join '+event.request_id);assert.equal(req[0].ip,event.src_ip,c.id+' source');assert.equal(req[0].timestamp,event.timestamp,c.id+' time');}
 }
 console.log(c.id+': sorted logs, observed period and HTTP/app sources/times verified');
}
console.log(total+' original-case answers independently verified.');
