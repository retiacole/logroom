'use strict';
const {chromium,launchOptions,artifacts}=require('./helpers.js');
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const version=require('../../package.json').version;
const url=pathToFileURL(path.resolve(__dirname,'../../index.html')).href;
const key='logroom.offline.v1';
const japanese=/[\u3040-\u30ff\u3400-\u9fff]/;
async function flush(page){await page.evaluate(()=>dispatchEvent(new Event('pagehide')));}
async function command(page,text){await page.locator('#command-input').fill(text);await page.locator('#terminal-form').evaluate(f=>f.requestSubmit());}
async function choose(page,id){await page.locator('#case-select').selectOption(id,{force:true});}
async function checkExit(page,spec){
  for(const id of spec.requiredEvidence)await page.locator(`.exit-evidence input[value="${id}"]`).check();
  for(const q of spec.questions)await page.locator(`.exit-form select[name="${q.id}"]`).selectOption(q.answer);
  await page.locator('.exit-form').evaluate(f=>f.requestSubmit());
}
(async()=>{
  const browser=await chromium.launch(launchOptions);
  const context=await browser.newContext({locale:'ja-JP',viewport:{width:1440,height:1000}});
  const page=await context.newPage(),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
  try{
    await page.goto(url);
    assert.equal(await page.locator('.header-version').innerText(),'v'+version);
    assert.equal(await page.locator('#case-select').inputValue(),'entry');
    assert.equal(await page.locator('#apply-attack').isVisible(),false);
    assert.equal(await page.locator('#preparation').getAttribute('open'),'');
    assert.equal(await page.locator('.task-card').count(),4);
    const entry=await page.evaluate(()=>LOG_LAB_CASES.find(c=>c.entry));
    for(let i=0;i<3;i++){const card=page.locator('.task-card').nth(i);await card.locator('input').fill(entry.tasks[i].answer);await card.locator('form').evaluate(f=>f.requestSubmit());}
    await page.locator('[data-file-task="save"]').click();
    assert.equal(await page.locator('.task-card').last().locator('.feedback.error').count(),1,'missing file rejected');
    await command(page,"grep -F 'Failed password' /var/log/entry.log > /home/analyst/evidence.txt");
    await command(page,'head -n 1 /home/analyst/evidence.txt >> /home/analyst/evidence.txt');
    await page.locator('[data-file-task="save"]').click();
    assert.equal(await page.locator('.task-card').last().locator('.feedback.error').count(),1,'duplicate evidence rejected');
    await command(page,"grep -F 'Failed password' /var/log/entry.log > /home/analyst/evidence.txt");
    await page.locator('[data-file-task="save"]').click();
    assert.equal(await page.locator('.task-card.correct').count(),4);
    await flush(page);await page.reload();
    assert.equal(await page.locator('.task-card.correct').count(),4,'file proof persists');
    await page.locator('#entry-skip').click();
    assert.equal(await page.locator('#case-select').inputValue(),'ssh');
    assert.equal(await page.locator('#debrief-open').isDisabled(),true);
    await page.locator('#preparation summary').click();
    assert.match(await page.locator('#preparation-content').innerText(),/sudo/);
    assert.equal(await page.locator('#concept-answer').isEnabled(),true,'concept check available before attack');
    await page.locator('#concept-answer').selectOption('unsupported');await page.locator('.concept-form').evaluate(f=>f.requestSubmit());
    assert.equal(await page.locator('#concept-check .feedback.error').count(),1);
    await page.locator('#concept-answer').selectOption('supported');await page.locator('.concept-form').evaluate(f=>f.requestSubmit());
    assert.equal(await page.locator('#concept-check .feedback.success').count(),1);
    assert.equal(await page.locator('#debrief-open').isDisabled(),true,'optional check does not alter old completion');
    await page.locator('#learning-guide summary').click();
    assert.equal(await page.locator('#learning-guide-content p').count(),4);
    await flush(page);await page.reload();await page.locator('#preparation summary').click();
    assert.equal(await page.locator('#concept-answer').inputValue(),'supported');
    assert.equal(await page.locator('#concept-check .feedback.success').count(),1);

    // A pre-update save keeps every original result and note, with new exercises independent.
    await page.evaluate(k=>{
      const saved={version:1,caseId:'web',locale:'ja',cases:{}};
      for(const c of LOG_LAB_CASES.filter(c=>!c.entry))saved.cases[c.id]={attackApplied:true,answers:Object.fromEntries(c.tasks.map(t=>[t.id,t.answer])),solved:c.tasks.map(t=>t.id),notes:'legacy note '+c.id};
      localStorage.setItem(k,JSON.stringify(saved));
      window.addEventListener('pagehide',()=>localStorage.setItem(k,JSON.stringify(saved)),{once:true});
    },key);await page.reload();
    assert.equal(await page.locator('#debrief-open').isEnabled(),true);
    assert.equal(await page.locator('.task-card.correct').count(),await page.evaluate(()=>LOG_LAB_CASES.find(c=>c.id==='web').tasks.length));
    assert.equal(await page.locator('#graduation').isVisible(),false);
    assert.equal(await page.locator('.exit-example').isVisible(),false);
    const specs=await page.evaluate(()=>Object.fromEntries(LOG_LAB_CASES.filter(c=>c.exitExercise).map(c=>[c.id,c.exitExercise])));
    await page.locator('.exit-form').evaluate(f=>f.requestSubmit());
    assert.equal(await page.locator('#exit-exercise>.feedback.error').count(),1);
    await checkExit(page,specs.web);
    assert.equal(await page.locator('.exit-example').isVisible(),true);
    await page.locator('#exit-note').fill('My own note: verify authorization before concluding compromise.');
    await page.locator('.exit-evidence input[value="audit-denied"]').check();
    assert.equal(await page.locator('.exit-example').isVisible(),false,'edited evidence invalidates submission');
    await page.locator('.exit-form').evaluate(f=>f.requestSubmit());
    assert.equal(await page.locator('#exit-exercise>.feedback.error').count(),1,'extra evidence rejected');
    await page.locator('.exit-evidence input[value="audit-denied"]').uncheck();
    await page.locator('.exit-form').evaluate(f=>f.requestSubmit());
    assert.equal(await page.locator('.exit-example').isVisible(),true);
    assert.match(await page.locator('.exit-example').innerText(),/19:12:08 \+0900/);
    assert.match(await page.locator('.exit-example').innerText(),/10:12:08Z/);
    await flush(page);await page.reload();
    assert.equal(await page.locator('.exit-example').isVisible(),true);
    assert.match(await page.locator('#exit-note').inputValue(),/^My own note/);
    await choose(page,'egress');await checkExit(page,specs.egress);
    assert.equal(await page.locator('.exit-example').isVisible(),true,'empty prose does not claim semantic grading');
    assert.equal(await page.locator('#graduation').isVisible(),true,'entry is optional for graduation');
    const next=page.locator('#graduation a');
    assert.equal(await next.getAttribute('href'),'https://retiacole.github.io/pcaproom-easy/');
    assert.equal(await next.getAttribute('target'),'_blank');assert.equal(await next.getAttribute('rel'),'noopener noreferrer');
    await page.locator('#graduation button').click();
    assert.equal(await page.locator('#command-input').evaluate(n=>n===document.activeElement),true);
    assert.equal(page.url(),url,'staying in room does not navigate');
    for(const locale of ['en','th','ja']){
      await page.locator('#language-select').selectOption(locale);
      assert.equal(await page.locator('.header-version').innerText(),'v'+version);
      if(locale!=='ja')for(const selector of ['#preparation-content','#concept-check','#exit-exercise','#graduation','#learning-guide-content'])assert.equal(japanese.test(await page.locator(selector).innerText()),false,locale+selector);
      assert.equal(await page.locator('.exit-example').isVisible(),true);
      for(const width of [1440,390,320]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,locale+' overflow at '+width);}
    }
    await page.screenshot({path:path.join(artifacts,'curriculum-mobile.png'),fullPage:false});
    await choose(page,'web');assert.match(await page.locator('#exit-note').inputValue(),/^My own note/);
    await page.locator('#case-reset').click();await page.locator('#reset-confirm').click();
    assert.equal(await page.locator('#graduation').isVisible(),false);
    assert.equal(await page.locator('#exit-note').count(),0);
    assert.equal(await page.locator('.exit-evidence').count(),0,'case-specific exit material stays locked before original investigation');
    assert.equal(await page.locator('.exit-locked').isVisible(),true);
    await choose(page,'egress');assert.equal(await page.locator('.exit-example').isVisible(),true,'reset preserves other case');
    await flush(page);
    const saved=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
    assert.equal(saved.cases.egress.notes,'legacy note egress');assert.equal(saved.cases.ssh.solved.length,await page.evaluate(()=>LOG_LAB_CASES.find(c=>c.id==='ssh').tasks.length));

    // A reviewed fixture can change a numeric answer without discarding notes.
    // Both the screen and exported report must recheck old solved IDs.
    await page.evaluate(k=>{
      const saved={version:1,caseId:'web',locale:'ja',cases:{}};
      const oldAnswers={web:['not-found-count','7'],egress:['dns-names','2'],tamper:['old-size','2593']};
      for(const [id,[taskId,answer]] of Object.entries(oldAnswers)){
        const c=LOG_LAB_CASES.find(c=>c.id===id);
        saved.cases[id]={attackApplied:true,answers:Object.fromEntries(c.tasks.map(t=>[t.id,t.answer])),solved:c.tasks.map(t=>t.id),notes:'Keep review notes: '+id};
        saved.cases[id].answers[taskId]=answer;
      }
      localStorage.setItem(k,JSON.stringify(saved));
      window.addEventListener('pagehide',()=>localStorage.setItem(k,JSON.stringify(saved)),{once:true});
    },key);await page.reload();
    for(const id of ['web','egress','tamper']){
      await choose(page,id);
      assert.equal(await page.locator('.task-card.correct').count(),await page.evaluate(id=>LOG_LAB_CASES.find(c=>c.id===id).tasks.length-1,id));
      assert.equal(await page.locator('#notes').inputValue(),'Keep review notes: '+id);
      assert.equal(await page.locator('#debrief-open').isDisabled(),true);
      await page.locator('#tab-notes').click();
      const downloadPromise=page.waitForEvent('download');
      await page.locator('#export-report').click();
      const report=require('node:fs').readFileSync(await (await downloadPromise).path(),'utf8');
      assert.equal((report.match(/判定：未正解/g)||[]).length,1,'export rechecks revised answer: '+id);
      assert(report.includes('Keep review notes: '+id));
      await page.locator('#tab-tasks').click();
    }
    assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
    console.log('Curriculum browser checks passed: real saved-file grading; optional concept checks; legacy completion; structured evidence/negative cases; bilingual time correlation; independent reset; three locales; responsive layout; optional graduation; zero network.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
