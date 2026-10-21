'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const {render}=require('../scripts/build.js');
for(const name of ['shell.js','cases.js','cases-extra.js','case-context.js','case-reading-a.js','case-reading-b.js'])require('../src/'+name);
const cases=globalThis.LOG_LAB_CASES,commands=globalThis.LogLabShell.supportedCommands;
assert.equal(cases.length,10);assert.equal(cases.reduce((n,c)=>n+c.tasks.length,0),104);assert.equal(commands.length,52);
let references=0;
for(const c of cases){
  assert.ok(c.baselineFiles&&c.attack&&c.context&&c.debrief,c.id);
  assert.ok(c.debrief.knowledge.length>=3&&c.debrief.history.length>=1&&c.debrief.references.length>=2,c.id);
  for(const r of [...c.debrief.history,...c.debrief.references])assert.equal(new URL(r.url).protocol,'https:');
  references+=c.debrief.references.length;
  for(const t of c.tasks)for(const e of t.evidence)assert.equal(c.files[e.path].trimEnd().split('\n')[e.line-1],e.quote,c.id+'/'+t.id);
}
assert.equal(references,34);
const built=render(),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert.equal(html,built,'index.html is stale: run npm run build');
for(const target of ['dist/index.html','dist/logroom.html'])assert.equal(fs.readFileSync(path.join(root,target),'utf8'),built,target);
assert.ok(Buffer.byteLength(html)<2000000,'three offline language packs should remain below 2 MB');
assert.ok(html.includes("connect-src 'none'"));
assert.ok(!/<(?:script|link|img)[^>]+\b(?:src|href)=["']https?:/i.test(html));
const shell=new globalThis.LogLabShell();
assert.equal(shell.run('sl').train,true);assert.equal(shell.run('rm -rf /').gameOver,true);
const guide=fs.readFileSync(path.join(root,'docs/COMMANDS.md'),'utf8');
for(const c of commands)assert.ok(guide.includes('`'+c+'`'),c+' missing from command guide');
assert.ok(fs.readFileSync(path.join(root,'LICENSE'),'utf8').startsWith('MIT License'));
function files(directory){return fs.readdirSync(directory,{withFileTypes:true}).flatMap(d=>['.git','node_modules','artifacts','.DS_Store'].includes(d.name)?[]:d.isDirectory()?files(path.join(directory,d.name)):[path.join(directory,d.name)]);}
const published=files(root);
for(const filename of published){
  const relative=path.relative(root,filename);
  assert.ok(!/^(?:work|node_modules)\//.test(relative),'internal directory: '+relative);
  assert.ok(!/^\.env(?:\.|$)/.test(path.basename(filename)),'unexpected environment file');
  if(/\.(?:png|zip)$/.test(filename))continue;
  const text=fs.readFileSync(filename,'utf8');
  assert.ok(!/\/Users\/[A-Za-z0-9_.-]+\//.test(text),'personal absolute path: '+relative);
  assert.ok(!/(?:gh[pousr]_[A-Za-z0-9_]{25,}|github_pat_[A-Za-z0-9_]{30,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/.test(text),'credential-like text: '+relative);
  if(filename.endsWith('.md'))for(const match of text.matchAll(/!?\[[^\]\n]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)){
    const link=match[1];if(/^(?:https?:|mailto:|#)/.test(link))continue;
    const target=decodeURIComponent(link.split('#')[0]);
    assert.ok(fs.existsSync(path.resolve(path.dirname(filename),target)),'broken local link '+relative+': '+link);
  }
}
console.log(`Release checks passed: ${cases.length} cases, 104 questions, ${commands.length} commands, ${references} references; deterministic offline HTML; documentation links and publication scan clean.`);
