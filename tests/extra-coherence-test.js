'use strict';
const assert = require('node:assert/strict');
for (const source of ['cases','cases-extra','case-context','case-reading-a','case-reading-b','locales/ui','locales/cases-a','locales/cases-b','locales/cases-c','i18n']) require('../src/'+source+'.js');
const cases = Object.fromEntries(LOG_LAB_CASES.map(c => [c.id,c]));
const ids = ['pathtraversal','webauth','ssrf','upload','tamper'];
const A='/var/log/nginx/access.log', T='/var/log/app/audit.log', J='/var/log/app/audit.jsonl';
const rows=text=>text.trimEnd().split('\n');
const values=line=>Object.fromEntries([...line.matchAll(/(?:^|\s)([a-z_]+)=(\S+)/g)].map(m=>[m[1],m[2]]));
function baseline(id) {
  const c=cases[id], audit=rows(c.baselineFiles[J]).map(JSON.parse);
  // The tamper collector preserves the full baseline, while its local snapshot is deliberately shorter.
  const http=rows(c.baselineFiles[id==='tamper'?'/var/log/collector/nginx-access.log':A]).map(line=>{
    const m=line.match(/^(\S+) .*\[12\/Aug\/2026:(\S+) \+0000\] "(\S+) (\S+) HTTP\/1.1" (\d+) (\d+).*request_id=(\S+)$/);
    assert(m,line);return {ip:m[1],time:m[2],method:m[3],url:m[4],status:+m[5],bytes:+m[6],id:m[7]};
  });
  assert.equal(http.length,60,id+': ordinary HTTP observations remain available');
  assert.equal(new Set(http.map(x=>x.id)).size,http.length);
  assert(http.every(x=>!x.id.includes('normal')),id+': IDs do not label event classification');
  for(const event of audit) {
    const request=http.find(x=>x.id===event.request_id);
    assert(request,id+': audit requires a matching HTTP request');
    assert.equal(request.ip,event.src_ip);
    assert.equal(request.time,event.timestamp.slice(11,19));
  }
  assert(rows(c.baselineFiles[T]).every(x=>x.includes(' app_audit ')),id+': shared audit tag');
  return {c,audit,http};
}
for(const id of ids) baseline(id);
{
  const {c,audit,http}=baseline('pathtraversal');
  const fs=rows(c.baselineFiles['/var/log/audit/file.log']).map(values);
  for(const e of audit){
    const req=http.find(x=>x.id===e.request_id),read=fs.find(x=>x.request_id===e.request_id);
    assert.equal(req.method,'GET');assert.equal(req.url,'/download?file='+e.resolved_path.split('/').at(-1));
    assert.equal(e.action,'file_read');assert.equal(e.handler,'validated');assert(e.resolved_path.startsWith(e.allowed_root+'/'));
    assert.equal(read.event,'read');assert.equal(read.path,e.resolved_path);assert.equal(read.result,e.result);assert.equal(+read.bytes,e.read_bytes);assert.equal(req.bytes,e.read_bytes);
  }
  assert(!c.files['/var/log/audit/file.log'].includes('req-path-301'),'application rejection does not emit an OS read');
}
{
  const {c,audit,http}=baseline('webauth');
  const sessions=rows(c.baselineFiles['/var/log/session/events.log']).map(values);
  const login=audit.find(x=>x.action==='login'),logout=audit.find(x=>x.action==='logout'),reports=audit.filter(x=>x.action==='report_view');
  assert(login&&logout);assert(reports.length>1);assert.equal(login.session_id,logout.session_id);
  assert(reports.every(x=>x.session_id===login.session_id&&x.actor===login.actor&&x.timestamp>login.timestamp&&x.timestamp<logout.timestamp));
  for(const e of audit){
    const req=http.find(x=>x.id===e.request_id),session=sessions.find(x=>x.request_id===e.request_id);
    assert.equal(session.session_id,e.session_id);assert.equal(session.actor,e.actor);
    assert.equal(session.event,{login:'issue',report_view:'validate',logout:'revoke'}[e.action]);
    assert.equal(req.method,e.action==='report_view'?'GET':'POST');
    assert.equal(req.url.split('?')[0],e.action==='report_view'?e.resource:'/'+e.action);
  }
}
{
  const {c,audit,http}=baseline('ssrf');
  const traffic=rows(c.baselineFiles['/var/log/egress/http.log']).map(values);
  for(const e of audit){
    const req=http.find(x=>x.id===e.request_id),fetch=traffic.find(x=>x.request_id===e.request_id);
    assert.equal(decodeURIComponent(req.url.split('?url=')[1]),e.initial_url);assert.equal(e.initial_url,e.final_url);
    assert.equal(fetch.host,new URL(e.final_url).hostname);assert.equal(fetch.result,e.result);assert.equal(+fetch.bytes,e.bytes);assert.equal(req.bytes,e.bytes);
    assert.notEqual(fetch.src,e.src_ip,'requester and fetching server have different network roles');
  }
}
{
  const {c,audit,http}=baseline('upload');
  const artifacts=rows(c.baselineFiles['/var/log/audit/artifact.log']).map(values);
  const uploads=audit.filter(x=>x.action==='upload'),views=audit.filter(x=>x.action==='artifact_view');
  assert(uploads.length>1&&views.length>1);
  for(const e of uploads){
    const req=http.find(x=>x.id===e.request_id),create=artifacts.find(x=>x.request_id===e.request_id),view=views.find(x=>x.file_id===e.file_id);
    assert.equal(req.method,'POST');assert.equal(req.url,'/upload');assert.equal(e.declared_type,e.detected_type);
    assert.equal(create.event,'create');assert.equal(create.path,e.stored_path);assert.equal(create.file_id,e.file_id);assert.equal(+create.bytes,e.bytes);
    assert(view&&view.timestamp>e.timestamp);assert.notEqual(view.request_id,e.request_id);assert.equal(view.path,e.stored_path);assert.equal(view.handler,'static');
    const read=artifacts.find(x=>x.request_id===view.request_id),access=http.find(x=>x.id===view.request_id);
    assert.equal(read.event,'read');assert.equal(read.path,e.stored_path);assert.equal(+read.bytes,e.bytes);assert.equal(access.bytes,e.bytes);assert.equal(access.url,'/uploads/'+e.file_id+'.png');
  }
}
{
  const c=cases.tamper, auth=rows(c.files['/var/log/auth.log']);
  assert(auth.every(x=>/^Aug 12 \d{2}:\d{2}:\d{2} edge-02 /.test(x)),'tamper uses traditional syslog consistently');
  const accepted=auth.filter(x=>x.includes('Accepted publickey'));
  assert(accepted.every(x=>/ssh2: ED25519 SHA256:\S+$/.test(x)),'each SSH success contains key type and fingerprint');
  for(const actor of ['ops','maint']){
    const opened=auth.findIndex(x=>x.includes('pam_unix(sshd:session): session opened for user '+actor));
    const sudo=auth.findIndex(x=>x.includes('sudo: '+actor+' :'));
    const closed=auth.findIndex(x=>x.includes('pam_unix(sshd:session): session closed for user '+actor));
    assert(opened>=0&&sudo>opened&&closed>sudo,actor+': sudo occurs inside the SSH session');
    const pid=values(auth[sudo]).pid;
    assert(auth.some(x=>x.includes('pam_unix(sudo:session): session opened')&&values(x).pid===pid));
    assert(auth.some(x=>x.includes('pam_unix(sudo:session): session closed')&&values(x).pid===pid));
  }
}
for(const lang of ['ja','en','th']){
  const localized=LogroomI18n.localizeCases(LOG_LAB_CASES,lang).filter(c=>ids.includes(c.id));
  for(const c of localized){
    const texts=c.tasks.flatMap(t=>t.hints.map(h=>h.text));
    assert.equal(new Set(texts).size,20,lang+' '+c.id+': task-specific hints');
    assert.equal(c.walkthrough.length,6,lang+' '+c.id+': complete investigation walkthrough');
    assert.equal(new Set(c.walkthrough.map(x=>x.title)).size,6);
    assert(c.tasks.every(t=>t.explanation.length>50),lang+' '+c.id+': explanations include reasoning');
    assert(c.tasks[0].hints.every(h=>!/(?:req-(?:path|wa|ssrf|up)-\d|audit_serial\s*==)/.test(h.command)),c.id+': introductory hint does not disclose later correlation answers');
  }
  assert.equal(new Set(localized.map(c=>c.attack.summary)).size,5,lang+': case-specific attack summaries');
  const tamper=localized.find(c=>c.id==='tamper');
  for(const files of [tamper.files,tamper.baselineFiles])assert(files['/home/analyst/README.txt'].includes('syslog'));
}
console.log('Extra-case coherence: matched normal request chains, stable sessions, application refusal, syslog sessions, and three-language teaching coverage verified.');
