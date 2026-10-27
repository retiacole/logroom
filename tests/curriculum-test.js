'use strict';
const assert=require('node:assert/strict');
for(const source of ['cases','cases-extra','case-context','case-reading-a','case-reading-b','locales/ui','locales/cases-a','locales/cases-b','locales/cases-c','i18n','shell','practice'])require('../src/'+source+'.js');
const original=JSON.parse(JSON.stringify(LOG_LAB_CASES));
require('../src/curriculum.js');
const {gradeFile,gradeExit,graduated}=LogroomCurriculum;
const cases=LOG_LAB_CASES,entry=cases[0],fileTask=entry.tasks.find(t=>t.kind==='file');
assert.equal(entry.id,'entry');assert.equal(entry.tasks.length,4);assert.equal(cases.length,11);
for(const c of original){const actual=cases.find(item=>item.id===c.id);assert.deepEqual(actual.tasks,c.tasks,'existing task IDs, answers and evidence remain unchanged');assert.deepEqual(actual.files,c.files,'original log bytes remain unchanged');assert.deepEqual(actual.baselineFiles,c.baselineFiles);}
assert.equal(LOGROOM_LEARNING_GUIDE.length,4);
for(const c of cases.filter(c=>!c.entry)){
  const check=c.conceptCheck;assert(check&&check.question&&check.explanation);
  assert.equal(check.options.filter(o=>o.value===check.answer).length,1);
  assert(check.options.some(o=>o.value!==check.answer));
}
const lines=entry.files['/var/log/entry.log'].trimEnd().split('\n');
assert.equal(lines.length,6);const failures=lines.filter(line=>line.includes('Failed password'));
assert.equal(failures.length,4);assert.equal(failures.filter(line=>/from 198\.51\.100\.41 port /.test(line)).length,3);
assert.equal(new Set(failures.map(line=>line.split(/\s+/).length)).size,2,'variable-width records are present');
const shell=new LogLabShell(entry.files);
for(const task of entry.tasks)for(const hint of task.hints||[])if(hint.command){const result=shell.run(hint.command);assert.equal(result.code,0,hint.command+' '+result.stderr);}
assert.equal(shell.files[fileTask.outputPath],failures.join('\n')+'\n');
assert.equal(gradeFile(fileTask,shell.files[fileTask.outputPath]),true);
assert.equal(gradeFile(fileTask,failures.join('\r\n')+'\r\n'),true);
for(const wrong of ['',failures.slice(1).join('\n'),[...failures,failures[0]].join('\n'),[...failures].reverse().join('\n'),failures.join('\n').replace('Failed','Accepted')])assert.equal(gradeFile(fileTask,wrong),false,'reject missing, duplicate, reordered or altered evidence');
for(const c of cases.filter(c=>c.exitExercise)){
  const e=c.exitExercise,answer={evidence:[...e.requiredEvidence].reverse(),answers:Object.fromEntries(e.questions.map(q=>[q.id,q.answer])),note:''};
  assert.equal(gradeExit(c,answer),true,'blank prose is not semantically graded');
  assert.equal(gradeExit(c,{...answer,note:'This arbitrary prose is deliberately NOT graded.'}),true);
  assert.equal(new Set(e.evidence.filter(x=>e.requiredEvidence.includes(x.id)).map(x=>x.path)).size,c.id==='web'?2:3,'independent sources required');
  for(const ref of e.evidence)assert.equal(c.files[ref.path].split('\n')[ref.line-1],ref.quote);
  for(const ids of [[],answer.evidence.slice(1),[...answer.evidence,answer.evidence[0]],e.evidence.map(x=>x.id),['unknown',...answer.evidence.slice(1)]])assert.equal(gradeExit(c,{...answer,evidence:ids}),false);
  for(const q of e.questions)for(const option of q.options.filter(o=>o.value!==q.answer))assert.equal(gradeExit(c,{...answer,answers:{...answer.answers,[q.id]:option.value}}),false,'reject unsupported conclusion '+q.id+'/'+option.value);
  const changed=JSON.parse(JSON.stringify(c)),ref=e.evidence.find(x=>x.id===e.requiredEvidence[0]);changed.files[ref.path]=changed.files[ref.path].replace(ref.quote,'altered');assert.equal(gradeExit(changed,answer),false,'source quote must match the source file');
}
const legacy=Object.fromEntries(original.map(c=>[c.id,{attackApplied:true,answers:Object.fromEntries(c.tasks.map(t=>[t.id,t.answer])),solved:c.tasks.map(t=>t.id),notes:'keep old notes'}]));
assert.equal(graduated(cases,legacy),false,'old question completion is valid but exit checks are independently unfinished');
for(const c of cases.filter(c=>c.exitExercise))legacy[c.id].exit={checked:true,evidence:c.exitExercise.requiredEvidence,answers:Object.fromEntries(c.exitExercise.questions.map(q=>[q.id,q.answer]))};
assert.equal(graduated(cases,legacy),true,'entry practice can be skipped by an experienced learner');
legacy.web.exit.answers.fact='all';assert.equal(graduated(cases,legacy),false);legacy.web.exit.answers.fact='export';
const web=cases.find(c=>c.id==='web'),http=web.exitExercise.evidence.find(e=>e.id==='http-export'),audit=web.exitExercise.evidence.find(e=>e.id==='audit-export');
assert(http.quote.includes('19:12:08 +0900'));assert(audit.quote.startsWith('2026-08-12T10:12:08Z'));
const egress=cases.find(c=>c.id==='egress').exitExercise;
const mailClient=egress.evidence.find(e=>e.id==='mail-client'),mailSent=egress.evidence.find(e=>e.id==='mail-sent');
assert(egress.requiredEvidence.includes('mail-client'));assert(mailClient.quote.includes('[192.0.2.34]'));
assert(mailClient.quote.includes('C6D71A20F1:'));assert(mailSent.quote.includes('C6D71A20F1:'));
for(const locale of ['ja','en','th'])for(const seed of ['', 'review-variant']){
  const variant=LogroomPractice.variantCases(LogroomI18n.localizeCases(cases,locale),{seed,advanced:true});
  for(const c of variant.filter(c=>c.exitExercise)){const e=c.exitExercise;assert.equal(gradeExit(c,{evidence:e.requiredEvidence,answers:Object.fromEntries(e.questions.map(q=>[q.id,q.answer]))}),true,locale+' '+seed);}
  const first=variant.find(c=>c.entry),shell=new LogLabShell(first.files);const t=first.tasks.find(t=>t.kind==='file');assert.equal(shell.run(t.hints[0].command).code,0);assert.equal(gradeFile(t,shell.files[t.outputPath]),true,'entry file stays valid across seed and locale');
}
for(const seed of ['review-variant','review-42','95','185'])for(const advanced of [false,true]){
  const previous=LogroomPractice.variantCases(original,{seed,advanced});
  const upgraded=LogroomPractice.variantCases(cases,{seed,advanced});
  for(const oldCase of previous){const actual=upgraded.find(c=>c.id===oldCase.id);assert.deepEqual(actual.tasks,oldCase.tasks,'saved seed answers stay unchanged '+seed+'/'+oldCase.id);assert.deepEqual(actual.files,oldCase.files,'saved seed log bytes stay unchanged');assert.deepEqual(actual.baselineFiles,oldCase.baselineFiles);}
}
assert.equal(LogroomPractice.variantCases(cases,{seed:'review-variant'}).find(c=>c.id==='web').tasks.find(t=>t.id==='source').answer,'203.0.113.106','known pre-update seed mapping');
console.log('Curriculum checks passed: unchanged legacy tasks/logs; four entry operations; file evidence integrity; independent-source exit grading and negative cases; JST/UTC pairing; optional graduation; all locales and seeded variants.');
