'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs');
require('../src/cases.js');
if(fs.existsSync(__dirname+'/../src/cases-extra.js'))require('../src/cases-extra.js');
require('../src/shell.js');
const golden=[
  {
    "id": "ssh",
    "tasks": [
      {
        "id": "source",
        "answer": "198.51.100.73"
      },
      {
        "id": "count",
        "answer": "60"
      },
      {
        "id": "account",
        "answer": "deploy"
      },
      {
        "id": "login-time",
        "answer": "09:18:42"
      },
      {
        "id": "sudo",
        "answer": "/usr/bin/systemctl restart nginx"
      },
      {
        "id": "target-count",
        "answer": "3"
      },
      {
        "id": "top-target",
        "answer": "admin"
      },
      {
        "id": "success-gap",
        "answer": "50"
      },
      {
        "id": "sudo-count",
        "answer": "2"
      },
      {
        "id": "trusted-key-count",
        "answer": "8"
      }
    ],
    "files": {
      "/home/analyst/README.txt": "a43056dd919ba519c9d5d113b390058abb154f9c412826369ccb67292fd62eb5",
      "/etc/hostname": "236d7d0fd3ed61a56a4d22a4125dbca7ff2bcba23486d8b2867821e6cafdfde1",
      "/var/log/auth.log": "1134f21e1dd88f1a76e7feaa52eb1c1b14e61b4c070fbfd3c3da48f61f8c4266"
    },
    "baseline": {
      "/etc/hostname": "236d7d0fd3ed61a56a4d22a4125dbca7ff2bcba23486d8b2867821e6cafdfde1",
      "/home/analyst/README.txt": "5bfbd50b4c8ba8806fb9aa144c66530c4d03c0616e69b5090921c102f2086098",
      "/var/log/auth.log": "2e0fde711c21d38c9447d94c7e030012e581052c5eca5258e140378bd06d1311"
    }
  },
  {
    "id": "web",
    "tasks": [
      {
        "id": "source",
        "answer": "203.0.113.88"
      },
      {
        "id": "account",
        "answer": "report-admin"
      },
      {
        "id": "endpoint",
        "answer": "/admin/export/users.csv"
      },
      {
        "id": "rows",
        "answer": "320"
      },
      {
        "id": "request-id",
        "answer": "req-2048"
      },
      {
        "id": "request-count",
        "answer": "19"
      },
      {
        "id": "not-found-count",
        "answer": "7"
      },
      {
        "id": "denied-resource",
        "answer": "payments"
      },
      {
        "id": "response-bytes",
        "answer": "128460"
      },
      {
        "id": "login-export-gap",
        "answer": "167"
      }
    ],
    "files": {
      "/home/analyst/README.txt": "91ad4e4eac32e4625a6169f1b0c4e6fddf888370a8a4e43344b607772da4bad9",
      "/etc/hostname": "b01422841fc4f78ddc9aaa347b6a03b7cdf36d9c543222d4652b0aa61edaae6d",
      "/var/log/nginx/access.log": "2d747d089fb48115a48a23e018d84d6a4a1b305deea094b6ac0ec824157de671",
      "/var/log/app/audit.log": "cc366500963c8f7a9b3b5f7f98441d588df945bdb055146a6cd3351976a0413e"
    },
    "baseline": {
      "/etc/hostname": "b01422841fc4f78ddc9aaa347b6a03b7cdf36d9c543222d4652b0aa61edaae6d",
      "/home/analyst/README.txt": "ac71eb555951a805047dd88e9cf5f3e1e593dbf4e425e0352ab80f3c47f7a202",
      "/var/log/nginx/access.log": "683cbfbce088404af0e23764fb3ed551f7e0ccbb17acf7abf53902db5d69ded2",
      "/var/log/app/audit.log": "9fdd7cbbf2ef239f546b347e91f080e634bc589ff4cfba5424865f9a2f1bf4fe"
    }
  },
  {
    "id": "egress",
    "tasks": [
      {
        "id": "workstation",
        "answer": "192.0.2.34"
      },
      {
        "id": "domain",
        "answer": "archive-sync.example"
      },
      {
        "id": "dns-answer",
        "answer": "198.51.100.202"
      },
      {
        "id": "post-count",
        "answer": "4"
      },
      {
        "id": "mail-account",
        "answer": "svc-reports"
      },
      {
        "id": "queue",
        "answer": "C6D71A20F1"
      },
      {
        "id": "upload-bytes",
        "answer": "1048576"
      },
      {
        "id": "dns-names",
        "answer": "2"
      },
      {
        "id": "mail-size",
        "answer": "846120"
      },
      {
        "id": "mail-delay",
        "answer": "1.2"
      },
      {
        "id": "first-domain-time",
        "answer": "11:15:02"
      },
      {
        "id": "recipient",
        "answer": "drop@archive-sync.example"
      }
    ],
    "files": {
      "/home/analyst/README.txt": "f42aa12f02aaa357b1858a084ad2d3d010ee7966108033f46113f799de1f752e",
      "/etc/hostname": "38f6475f3926a9d8c56ce8567001abf3c2568c7fdad99a73e5c90d08700bf077",
      "/var/log/proxy/access.log": "c3d7d91e866934cc6315388817376a706d2bf8952f48d1660c490b923c66e620",
      "/var/log/named/query.log": "509affb13c62ac353dd27f75ee873b9264fe2f45a984cc043efec233f6d82f7e",
      "/var/log/mail.log": "368cd44d88cce92b2b947aa962c998483fa1b4ded335103666b2fe5a2c600146"
    },
    "baseline": {
      "/etc/hostname": "38f6475f3926a9d8c56ce8567001abf3c2568c7fdad99a73e5c90d08700bf077",
      "/home/analyst/README.txt": "6871fbe25c4e193934a30d9cb8da37d0ad3534d43ff0a17590387c7e6a59398e",
      "/var/log/proxy/access.log": "aac3eb0c00070526ab6e766cdad9abe84bc4772a052e22e3d81e92b96db05ae0",
      "/var/log/named/query.log": "965d8a87f2a03975fe7c0333b3c4c72377405c9070f0866ad595850db3badec6",
      "/var/log/mail.log": "048f47363a178f00611ac32b8f5c8724b43e44d88d3cdbeb0947e709c8a454fc"
    }
  },
  {
    "id": "sqli",
    "tasks": [
      {
        "id": "source",
        "answer": "198.51.100.164"
      },
      {
        "id": "syntax-request",
        "answer": "req-sql-201"
      },
      {
        "id": "success-request",
        "answer": "req-sql-202"
      },
      {
        "id": "rows",
        "answer": "2400"
      },
      {
        "id": "benign-mode",
        "answer": "prepared"
      },
      {
        "id": "observed-shape",
        "answer": "title_equals_or_true"
      },
      {
        "id": "db-user",
        "answer": "search_ro"
      },
      {
        "id": "prepared-count",
        "answer": "25"
      },
      {
        "id": "normal-term-count",
        "answer": "6"
      },
      {
        "id": "response-bytes",
        "answer": "198432"
      }
    ],
    "files": {
      "/home/analyst/README.txt": "5db723be8b066470b2684387e415211ab9ed2e3a1fea1195434758f6218ca0ef",
      "/etc/hostname": "b66d63e4f8bd614b455d3ee527436ff18e01a37d520216bc3386168d62704efa",
      "/var/log/nginx/access.log": "cb065b7db1863b8cfbccb9a15fd57a09c0cc4f691ea05573abaecfea5c02cdbe",
      "/var/log/app/audit.log": "ed42c0d033ba2b84ee956422bba1d7962cb1b0fae4678b58b08aa068a86805c1",
      "/var/log/app/audit.jsonl": "bcff6753bcb4b90b9a1e17093f86e5beda6962f8e2fb8432bc7172561f771dc4",
      "/var/log/db/query.log": "58e4020b40f66d6bf2796d69f2062951a4ac657300ca717c2e89ee6f630d2039"
    },
    "baseline": {
      "/etc/hostname": "b66d63e4f8bd614b455d3ee527436ff18e01a37d520216bc3386168d62704efa",
      "/home/analyst/README.txt": "9082cbde0a4b56fd397841aed59df9f7a163bcac88660b9538ee3d2d7092de7b",
      "/var/log/nginx/access.log": "aa4861e65e5fcbc2721397e6c5ae36980119fa014087d4386231895b024fd7fd",
      "/var/log/app/audit.log": "8a300d041d3b8266bdf57d3d562fa4fbbde2e0be7bb5978cd2db606f4ff9beb9",
      "/var/log/app/audit.jsonl": "c6c0abe0e3e8e54887e885951f58f3fa86f84f2f48eaa69e4eb9b4ce10104854",
      "/var/log/db/query.log": "d825098df08314a2d4598a244ab3573f9be5ea18a18daf97f2928ed5b42995be"
    }
  },
  {
    "id": "cmdinj",
    "tasks": [
      {
        "id": "source",
        "answer": "203.0.113.166"
      },
      {
        "id": "denied",
        "answer": "req-diag-401"
      },
      {
        "id": "unexpected-exe",
        "answer": "/usr/bin/id"
      },
      {
        "id": "run-user",
        "answer": "diag-web"
      },
      {
        "id": "executed-request",
        "answer": "req-diag-402"
      },
      {
        "id": "parent",
        "answer": "8840"
      },
      {
        "id": "decoded-target",
        "answer": "192.0.2.1;id"
      },
      {
        "id": "exec-count",
        "answer": "3"
      },
      {
        "id": "normal-exec-count",
        "answer": "50"
      },
      {
        "id": "parent-exe",
        "answer": "/bin/sh"
      },
      {
        "id": "shell-duration",
        "answer": "1"
      },
      {
        "id": "response-delta",
        "answer": "234"
      }
    ],
    "files": {
      "/home/analyst/README.txt": "4ba7265a6a1aeabba04a371ea611c168b18f25c6cff1a7ab4fce01198efadccd",
      "/etc/hostname": "1b4f264fc6d5496d64d98441c65a2878d656bd1b2a8267d41eca8015a711bc5e",
      "/var/log/nginx/access.log": "7ce982377cf2bc2b81f631c295ba49a8d11044d0e9374a10241e6f304df86d2f",
      "/var/log/app/audit.log": "798d5ee9adf19d28f2065e0aa10ff306051621b3016f7ecaa3e1950f71053997",
      "/var/log/app/audit.jsonl": "31331a048e7268563236e258cd24157b763d5f945989b113f40f4e6a16932c7a",
      "/var/log/process/exec.log": "1c888898dde755ce268e87def58629ba88e03258666dfffa1bb299df8c8ed27f"
    },
    "baseline": {
      "/etc/hostname": "1b4f264fc6d5496d64d98441c65a2878d656bd1b2a8267d41eca8015a711bc5e",
      "/home/analyst/README.txt": "82d09df8f7e8ac79ee550c2b52f7fb3da00a5b31a10db6db8734cc7990630825",
      "/var/log/nginx/access.log": "dfb0ffe0c62f04555aa1d0885bd80a87881457ad654fd4f82d5ebfb3ca463b80",
      "/var/log/app/audit.log": "af795da0756cf45e0129c8fcf9aac2754418e11475bad9ea760404be528003d6",
      "/var/log/app/audit.jsonl": "c2ea3b7c1feec5b51b4c33cf323c7843dd40f6ea0ee4ada06e1dd9f189b88669",
      "/var/log/process/exec.log": "bc7587c32d491da9a9662ee1566636ec31d51f249c2080aa3d7ebc83e3b8b18e"
    }
  }
];
let passed=0,failed=0;
const test=(name,fn)=>{try{fn();passed++;}catch(e){failed++;console.error('FAIL',name,'\n'+e.message);}};
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const lines=s=>s.trimEnd().split('\n');
const cases=globalThis.LOG_LAB_CASES;
const originals=new Set(golden.map(c=>c.id));
const extras=cases.filter(c=>!originals.has(c.id));
test('exact 10 cases',()=>assert.equal(cases.length,10));
test('unique 10 case IDs',()=>assert.equal(new Set(cases.map(c=>c.id)).size,10));
test('104 total tasks',()=>assert.equal(cases.reduce((n,c)=>n+c.tasks.length,0),104));
test('exact 5 additional cases',()=>assert.equal(extras.length,5));
for(const old of golden){
 const c=cases.find(c=>c.id===old.id);
 test(c.id+' old task order IDs and answers preserved',()=>assert.deepEqual(c.tasks.map(t=>({id:t.id,answer:t.answer})),old.tasks));
 for(const [p,digest]of Object.entries(old.files))test(c.id+' old file preserved '+p,()=>assert.equal(hash(c.files[p]),digest));
 for(const [p,digest]of Object.entries(old.baseline))test(c.id+' old baseline preserved '+p,()=>assert.equal(hash(c.baselineFiles[p]),digest));
}
for(const c of extras){
 test(c.id+' 10 tasks',()=>assert.equal(c.tasks.length,10));
 test(c.id+' unique task IDs',()=>assert.equal(new Set(c.tasks.map(t=>t.id)).size,10));
 test(c.id+' baseline and attack metadata',()=>{assert(c.baselineFiles);assert(c.attack?.label);assert(c.attack?.summary);assert(c.logPaths.length);assert(c.initialCommand);});
 const snapshots=Object.fromEntries(Object.entries(c.baselineFiles).filter(([p])=>p.startsWith('/var/log/')).map(([p,s])=>['/baseline'+p,s]));
 let additions=0;
 for(const p of c.logPaths){
  test(c.id+' baseline integrity '+p,()=>{assert(p.startsWith('/var/log/'));assert.equal(typeof c.files[p],'string');assert.equal(typeof c.baselineFiles[p],'string');const b=lines(c.baselineFiles[p]),full=lines(c.files[p]);assert(b.length>0);if(c.id==='tamper'&&p==='/var/log/nginx/access.log'){assert.equal(b.length,20);assert.equal(full.length,2);assert(b.every(row=>!full.includes(row)));assert(c.briefing.some(s=>s.includes('消え')));}else{let pos=0;for(const row of b){while(pos<full.length&&full[pos]!==row)pos++;assert(pos<full.length,'baseline row not found in full: '+row);pos++;}}additions+=full.filter(row=>!b.includes(row)).length;});
  test(c.id+' normal diff0 and after diff1 '+p,()=>{const before=new LogLabShell({...c.baselineFiles,...snapshots}).run(`diff /baseline${p} ${p}`);assert.equal(before.code,0,JSON.stringify(before));assert.equal(before.stdout,'');assert.equal(before.stderr,'');const after=new LogLabShell({...c.files,...snapshots}).run(`diff -u /baseline${p} ${p}`);assert.equal(after.code,1,JSON.stringify(after));assert(after.stdout);assert.equal(after.stderr,'');});
 }
 test(c.id+' positive scenario additions',()=>assert(additions>0));
 const commands=[{label:'initial',command:c.initialCommand},...c.walkthrough.map((w,i)=>({label:'walkthrough '+i,command:w.command})),...c.tasks.flatMap(t=>t.hints.filter(h=>h.command).map((h,i)=>({label:'hint '+t.id+'/'+i,command:h.command})))];
 for(const {label,command}of commands)test(c.id+' executable '+label,()=>{const r=new LogLabShell({...c.files,...snapshots}).run(command);assert(r.code===0||(command.trim().startsWith('diff ')&&r.code===1),JSON.stringify({command,...r}));assert.equal(r.stderr,'');assert(r.stdout,'empty output: '+command);});
 for(const t of c.tasks)test(c.id+' exact evidence '+t.id,()=>{assert(t.accepted.includes(t.answer));assert(t.evidence.length);for(const e of t.evidence)assert.equal(c.files[e.path].split('\n')[e.line-1],e.quote);});
}
// Add independent event-derived answer maps for each of the five new cases below.
const kv=line=>Object.fromEntries([...line.matchAll(/([A-Za-z_][A-Za-z0-9_]*)=("(?:[^"\\]|\\.)*"|[^\s]+)/g)].map(m=>[m[1],m[2].startsWith('"')?JSON.parse(m[2]):m[2]]));
const A='/var/log/nginx/access.log',J='/var/log/app/audit.jsonl',T='/var/log/app/audit.log';
const events=c=>lines(c.files[J]).map(JSON.parse);
const nginx=s=>lines(s).map(line=>{const m=line.match(/^(\S+) - - \[([^\]]+)\] "(\S+) (\S+) HTTP\/[^"]+" (\d+) (\d+) .*request_id=(\S+)$/);assert(m,line);return {line,ip:m[1],time:m[2],method:m[3],path:m[4],status:+m[5],bytes:+m[6],id:m[7]};});
const timeOnly=s=>new Date(s).toISOString().slice(11,19);
const answers={};
{
 const c=extras.find(c=>c.id==='pathtraversal'),app=events(c).filter(e=>e.action==='file_read'),access=nginx(c.files[A]),os=lines(c.files['/var/log/audit/file.log']).map(kv);
 const success=app.find(e=>e.result==='success'),read=os.find(e=>e.event==='read'&&e.request_id===success.request_id&&e.result==='success'),denied=app.find(e=>e.reason==='outside_root'),missing=app.find(e=>e.reason==='not_found');
 const request=access.find(e=>e.id===success.request_id),relative=new URL('https://lab.test'+request.path).searchParams.get('file');
 const canonical=require('node:path').posix.resolve(success.allowed_root,relative);
 test('pathtraversal decoded request canonical path matches OS',()=>{assert.equal(canonical,read.path);assert(!canonical.startsWith(success.allowed_root+'/'));assert.equal(read.path,success.resolved_path);assert.equal(+read.bytes,success.read_bytes);assert.equal(request.bytes,success.read_bytes);});
 answers.pathtraversal={source:success.src_ip,root:success.allowed_root,path:read.path,bytes:String(+read.bytes),'os-user':read.user,confirmed:read.request_id,blocked:denied.request_id,missing:os.find(e=>e.request_id===missing.request_id).result,'request-count':String(access.filter(e=>e.ip===success.src_ip).length),'read-count':String(os.filter(e=>e.event==='read'&&app.some(a=>a.request_id===e.request_id)&&e.result==='success').length)};
}
{
 const c=extras.find(c=>c.id==='webauth'),app=events(c),session=lines(c.files['/var/log/session/events.log']).map(line=>({...kv(line),timestamp:line.split(' ')[0]}));
 const login=app.find(e=>e.action==='login'&&e.result==='success'),attempts=app.filter(e=>e.action==='login'&&e.src_ip===login.src_ip),report=app.find(e=>e.action==='report_view'&&e.session_id===login.session_id),revoke=session.find(e=>e.event==='revoke'&&e.session_id===login.session_id);
 test('webauth issue/use/revoke all correspond',()=>{const issue=session.find(e=>e.event==='issue'&&e.session_id===login.session_id),use=session.find(e=>e.event==='validate'&&e.request_id===report.request_id),logout=app.find(e=>e.action==='logout'&&e.session_id===login.session_id);assert.equal(issue.actor,login.actor);assert.equal(issue.timestamp,login.timestamp);assert.equal(use.result,'success');assert.equal(use.session_id,login.session_id);assert.equal(logout.timestamp,revoke.timestamp);assert.equal(logout.revoked,true);});
 answers.webauth={source:login.src_ip,'failure-count':String(attempts.filter(e=>e.result==='failure').length),'name-count':String(new Set(attempts.map(e=>e.actor)).size),account:login.actor,'login-time':timeOnly(login.timestamp),session:login.session_id,resource:report.resource,rows:String(report.rows),mfa:String(login.mfa_used),'revoke-time':timeOnly(revoke.timestamp)};
}
{
 const c=extras.find(c=>c.id==='ssrf'),app=events(c).filter(e=>e.action==='url_fetch'),egress=lines(c.files['/var/log/egress/http.log']).map(kv);
 const success=app.find(e=>e.result==='success'),denied=app.find(e=>e.reason==='destination_policy'),flow=egress.filter(e=>e.request_id===success.request_id),final=flow.find(e=>e.result==='success'),redirect=flow.find(e=>e.result==='redirect');
 test('ssrf independent redirect and fetch prove final response',()=>{assert.equal(flow.length,2);assert.equal(redirect.location,success.final_url);assert.equal(new URL(success.final_url).hostname,final.host);assert.equal(+final.bytes,success.bytes);assert.equal(+final.status,200);assert.notEqual(final.src,success.src_ip);assert(!egress.some(e=>e.request_id===denied.request_id));});
 answers.ssrf={source:success.src_ip,blocked:denied.request_id,confirmed:success.request_id,'internal-ip':final.dst,'worker-ip':final.src,redirect:redirect.status,bytes:String(+final.bytes),'egress-count':String(egress.filter(e=>app.some(a=>a.request_id===e.request_id)).length),'success-count':String(app.filter(e=>e.result==='success').length),'final-url':success.final_url};
}
{
 const c=extras.find(c=>c.id==='upload'),app=events(c),artifact=lines(c.files['/var/log/audit/artifact.log']).map(kv),access=nginx(c.files[A]);
 const suspicious=app.find(e=>e.action==='upload'&&e.result==='stored'&&e.declared_type!==e.detected_type),stored=app.filter(e=>e.action==='upload'&&e.result==='stored'&&e.src_ip===suspicious.src_ip),denied=app.find(e=>e.reason==='extension_blocked'),created=artifact.find(e=>e.event==='create'&&e.file_id===suspicious.file_id),exec=artifact.find(e=>e.event==='exec'&&e.file_id===suspicious.file_id),exit=artifact.find(e=>e.event==='exit'&&e.pid===exec.pid);
 test('upload create/lookup/exec link without HTTP-only inference',()=>{const view=app.find(e=>e.action==='artifact_view'&&e.file_id===suspicious.file_id);assert.equal(created.path,suspicious.stored_path);assert.equal(+created.bytes,suspicious.bytes);assert.equal(exec.request_id,view.request_id);assert.notEqual(exec.request_id,suspicious.request_id);assert.equal(exit.status,'0');assert(!artifact.some(e=>e.event==='create'&&e.request_id===denied.request_id));});
 answers.upload={source:suspicious.src_ip,denied:denied.request_id,route:access.find(e=>e.id===suspicious.request_id).path,type:suspicious.detected_type,path:created.path,'file-id':suspicious.file_id,exe:exec.exe,user:exec.user,'stored-count':String(stored.length),'stored-bytes':String(stored.reduce((n,e)=>n+e.bytes,0))};
}
{
 const c=extras.find(c=>c.id==='tamper'),app=events(c),trunc=app.find(e=>e.action==='file_truncate'&&e.result==='success'),auth=lines(c.files['/var/log/auth.log']),login=auth.find(l=>l.includes('Accepted publickey for '+trunc.actor+' ')),active=nginx(c.files[trunc.path]),collector=nginx(c.files['/var/log/collector/nginx-access.log']);
 test('tamper independent byte sizes and collector conservation',()=>{assert.equal(trunc.old_size,Buffer.byteLength(c.baselineFiles[trunc.path]));assert.equal(trunc.new_size,0);assert(c.baselineFiles[trunc.path].split('\n').filter(Boolean).every(l=>collector.some(e=>e.line===l)));assert(active.every(e=>collector.some(x=>x.id===e.id&&x.line===e.line)));assert.equal(app.filter(e=>e.action==='file_append').at(-1).new_size,Buffer.byteLength(c.files[trunc.path]));assert(auth.some(l=>l.includes('sudo['+trunc.ppid+']: '+trunc.actor+' :')&&l.includes('USER=root')));});
 answers.tamper={actor:trunc.actor,source:login.match(/ from (\S+) port/)[1],path:trunc.path,'old-size':String(Buffer.byteLength(c.baselineFiles[trunc.path])),'active-count':String(active.length),'collector-count':String(collector.length),euid:String(trunc.euid),pid:String(trunc.pid),serial:String(trunc.audit_serial),gap:String((Date.parse(trunc.timestamp)-Date.parse(login.split(' ')[0]))/1000)};
}
const attackMarker={pathtraversal:/req-path-30[123]|action=file_read|"action":"file_read"/,webauth:/req-wa-50[1-7]|sess-lab-42/,ssrf:/req-ssrf-40[123]|config\.internal\.test/,upload:/req-up-40[1-4]|f-70[12]|event=exec/,tamper:/local-480[123]|\bmaint\b|file_truncate/};
for(const c of extras){
 for(const t of c.tasks)test(c.id+' independently derived answer '+t.id,()=>{assert.equal(typeof answers[c.id][t.id],'string','missing independent derivation');assert.equal(t.answer,answers[c.id][t.id]);});
 test(c.id+' every independent answer has a task',()=>assert.equal(Object.keys(answers[c.id]).length,c.tasks.length));
 for(const p of c.logPaths)test(c.id+' baseline has no scenario attack '+p,()=>assert(!attackMarker[c.id].test(c.baselineFiles[p]),p));
 test(c.id+' JSON and text audit events agree',()=>{const json=events(c),text=lines(c.files[T]);assert.equal(json.length,text.length);for(let i=0;i<json.length;i++){const j=json[i],l=text[i];assert(l.startsWith(j.timestamp+' '+j.host+' '));for(const [k,v]of Object.entries(j)){if(['host','timestamp'].includes(k))continue;assert(l.includes(k+'='+v),'mismatched '+k+': '+l);}}});
 for(const p of c.logPaths)test(c.id+' full log chronological '+p,()=>{let times=[];for(const l of lines(c.files[p])){if(l[0]==='{')times.push(Date.parse(JSON.parse(l).timestamp));else if(/^\d{4}-\d\d-\d\dT/.test(l))times.push(Date.parse(l.split(' ')[0]));else{const m=l.match(/\[(\d+)\/(\w+)\/(\d+):(\d\d:\d\d:\d\d) \+0000\]/);assert(m);times.push(Date.parse(`${m[1]} ${m[2]} ${m[3]} ${m[4]} GMT`));}}assert(times.every(Number.isFinite));for(let i=1;i<times.length;i++)assert(times[i]>=times[i-1],'timestamp order at line '+(i+1));});
}
console.log('V4 cases QA:',passed,'passed,',failed,'failed');if(failed)process.exitCode=1;
