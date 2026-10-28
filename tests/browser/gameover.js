const {chromium,launchOptions,artifacts}=require('./helpers.js');
const assert=require('assert/strict');
const path=require('path');
const {pathToFileURL}=require('url');

(async()=>{
  const browser=await chromium.launch(launchOptions);
  const context=await browser.newContext({locale:'ja-JP',viewport:{width:1440,height:1000}});
  const page=await context.newPage();
  const errors=[],requests=[];
  const track=p=>{p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});};
  track(page);
  const url=pathToFileURL(path.resolve(__dirname,'../../index.html')).href;
  const store=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('logroom.offline.v1')));
  const run=async(command,p=page)=>{await p.locator('#command-input').fill(command);await p.locator('#terminal-form').evaluate(f=>f.requestSubmit());};
  const choose=async id=>{await page.locator('#case-select').selectOption(id,{force:true});};
  const notes=async text=>{await page.locator('#tab-notes').click();await page.locator('#notes').fill(text);await page.locator('#tab-tasks').click();};
  const solveOne=async()=>{const answer=await page.evaluate(()=>LOG_LAB_CASES.find(c=>c.title===document.getElementById('case-title').textContent).tasks[0].answer);await page.locator('.task-card').first().locator('input').fill(answer);await page.locator('.task-card').first().locator('form').evaluate(f=>f.requestSubmit());};
  await page.goto(url);
  assert.ok(await page.locator('#doom-dialog').count(),'Easter egg dialog exists');
  assert.equal(await page.locator('#doom-dialog').isVisible(),false);
  const marker=await page.evaluate(()=>{
    const good=['rm -rf --no-preserve-root /','rm -fr --no-preserve-root /','rm -r -f --no-preserve-root /','rm -Rf --no-preserve-root /','rm --recursive --force --no-preserve-root /','rm -rf --no-preserve-root -- /',`rm '-rf' '--no-preserve-root' '/'`];
    const bad=['rm -rf /','rm -fr /','rm --recursive --force /','rm -rf --no-preserve-root / | cat','rm -rf --no-preserve-root / > /tmp/a',`echo 'rm -rf /'`,`printf 'rm -rf /\\n'`,'rm -rf /tmp','rm -r /','rm -f /','rm -rf','rm -rf / /tmp','rm -rf / | cat',"'rm -rf /'",'rm -rf / > /tmp/a','rm -rf / && pwd','rm -rf /./'];
    const checks=[];
    for(const input of [...good,...bad]){const shell=new LogLabShell({'/var/log/test.log':'keep\n','/home/analyst/memo.txt':'memo\n'});const before=JSON.stringify(shell.files);const result=shell.run(input);checks.push({input,expected:good.includes(input),marker:result.gameOver===true,unchanged:JSON.stringify(shell.files)===before});}
    return checks;
  });
  for(const c of marker){assert.equal(c.marker,c.expected,'marker: '+c.input);if(c.expected)assert.ok(c.unchanged,'marker must not delete files: '+c.input);}

  await choose('web');await page.locator('#apply-attack').click();await notes('other case must survive');await solveOne();await run("echo 'keep web' > /home/analyst/web-keep.txt");
  await choose('ssh');await page.locator('#apply-attack').click();await notes('this case will reset');await solveOne();await run("echo 'temporary ssh note' > /home/analyst/doom-note.txt");await run('mkdir /tmp/doom-dir');await run('cd /tmp');
  await page.locator('#terminal-width').evaluate(n=>{n.value='76';n.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.locator('#terminal-height').evaluate(n=>{n.value='520';n.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.locator('#panel-toggle').click();
  await page.waitForTimeout(350);
  await page.reload();
  assert.equal(await page.locator('#scenario-state').innerText(),'攻撃後ログ');
  assert.equal(await page.locator('#progress-label').innerText(),'1 / 10 正解');
  assert.match(await page.locator('#save-status').innerText(),/このブラウザ/);
  assert.equal((await store()).cases.ssh.notes,'this case will reset');
  await run('cat /home/analyst/doom-note.txt');assert.match(await page.locator('.terminal-block').last().innerText(),/temporary ssh note/);
  for(const harmless of ['rm -rf /',"echo 'rm -rf /'","printf 'rm -rf /\\n'",'rm -rf /tmp','rm -rf / | cat','rm -rf /; pwd','rm -rf / > /tmp/doom-output.txt']){await run(harmless);assert.equal(await page.locator('#doom-dialog').isVisible(),false,'no effect for '+harmless);}
  await page.waitForTimeout(350);
  const before=await store(),otherBefore=JSON.stringify(before.cases.web),uiBefore=JSON.stringify(before.ui);
  await page.evaluate(()=>{window.__doomPhases=[];new MutationObserver(()=>{const p=document.getElementById('doom-dialog').dataset.phase;if(p&&!window.__doomPhases.includes(p))window.__doomPhases.push(p);}).observe(document.getElementById('doom-dialog'),{attributes:true,attributeFilter:['data-phase']});});
  await run('rm -rf --no-preserve-root /');
  await page.waitForFunction(()=>document.getElementById('doom-dialog').open&&document.getElementById('doom-dialog').dataset.phase==='collapse');
  assert.equal(await page.locator('#app-shell').evaluate(n=>n.inert),true);
  const resetAtTrigger=await store();assert.equal(resetAtTrigger.caseId,'ssh');assert.equal(resetAtTrigger.cases.ssh.attackApplied,false);assert.equal(resetAtTrigger.cases.ssh.notes,'');assert.deepEqual(resetAtTrigger.cases.ssh.solved,[]);assert.deepEqual(resetAtTrigger.cases.ssh.edits,{});assert.equal(JSON.stringify(resetAtTrigger.cases.web),otherBefore);assert.equal(JSON.stringify(resetAtTrigger.ui),uiBefore);
  // Repeated programmatic submit must not start a second timer or restore old progress.
  await page.locator('#terminal-form').evaluate(f=>{document.getElementById('command-input').value='rm -rf --no-preserve-root /';f.requestSubmit();});
  assert.equal((await store()).cases.ssh.attackApplied,false);
  await page.waitForFunction(()=>document.getElementById('doom-dialog').dataset.phase==='gameover');
  await page.waitForFunction(()=>Number(getComputedStyle(document.getElementById('doom-title')).opacity)>.98);
  assert.equal(await page.locator('#doom-title').innerText(),'GAME OVER');
  const style=await page.locator('#doom-title').evaluate(n=>({color:getComputedStyle(n).color,background:getComputedStyle(document.getElementById('doom-dialog')).backgroundColor}));
  const rgb=style.color.match(/[\d.]+/g).map(Number);assert.ok(rgb[0]>rgb[1]*1.5&&rgb[0]>rgb[2]*1.5,'GAME OVER is red');assert.match(style.background,/rgba?\(0, 0, 0/,'backdrop is black');
  await page.screenshot({path:path.join(artifacts,'doom-gameover.png')});
  await page.waitForFunction(()=>document.getElementById('doom-dialog').dataset.phase==='blackout');
  await page.waitForFunction(()=>document.getElementById('doom-dialog').dataset.phase==='recovery');
  assert.equal(await page.locator('#scenario-state').innerText(),'正常ログ');
  await page.waitForFunction(()=>!document.getElementById('doom-dialog').open,{},{timeout:10000});
  assert.equal(await page.locator('#app-shell').evaluate(n=>n.inert),false);
  assert.deepEqual(await page.evaluate(()=>window.__doomPhases),['collapse','gameover','blackout','recovery']);
  assert.equal(await page.locator('#case-select').inputValue(),'ssh');assert.equal(await page.locator('#terminal-cwd').innerText(),'~');assert.equal(await page.locator('#debrief-open').isDisabled(),true);assert.equal(await page.locator('#height-label').innerText(),'520px');assert.equal(await page.locator('#learning-panel').isVisible(),false);
  const fresh=await store();assert.equal(JSON.stringify(fresh.cases.web),otherBefore);assert.equal(JSON.stringify(fresh.ui),uiBefore);assert.deepEqual(fresh.cases.ssh.history,[]);assert.equal(fresh.cases.ssh.notes,'');assert.deepEqual(fresh.cases.ssh.answers,{});assert.deepEqual(fresh.cases.ssh.edits,{});
  await run('cat /home/analyst/doom-note.txt');assert.match(await page.locator('.terminal-block').last().innerText(),/no such file/i);await run('diff -u /baseline/var/log/auth.log /var/log/auth.log');assert.equal(await page.locator('#last-exit').innerText(),'終了コード 0');
  await page.reload();assert.equal(await page.locator('#scenario-state').innerText(),'正常ログ');await choose('web');assert.equal(await page.locator('#scenario-state').innerText(),'攻撃後ログ');assert.equal(await page.locator('#progress-label').innerText(),'1 / 10 正解');await run('cat /home/analyst/web-keep.txt');assert.match(await page.locator('.terminal-block').last().innerText(),/keep web/);

  // Refreshing partway through the effect must load the saved fresh case.
  await choose('ssh');await page.locator('#panel-toggle').click();await page.locator('#apply-attack').click();await notes('refresh should not restore this');await run('rm -rf --no-preserve-root /');await page.waitForFunction(()=>document.getElementById('doom-dialog').open);await page.reload();assert.equal(await page.locator('#doom-dialog').isVisible(),false);assert.equal(await page.locator('#scenario-state').innerText(),'正常ログ');assert.equal((await store()).cases.ssh.notes,'');
  await page.locator('#apply-attack').click();await run('rm -rf --no-preserve-root /');await page.locator('#doom-skip').click();await page.waitForFunction(()=>!document.getElementById('doom-dialog').open);assert.equal(await page.locator('#scenario-state').innerText(),'正常ログ');
  await page.locator('#apply-attack').click();await run('rm -rf --no-preserve-root /');await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.getElementById('doom-dialog').open);assert.equal(await page.locator('#app-shell').evaluate(n=>n.inert),false);

  const reduced=await browser.newContext({locale:'ja-JP',viewport:{width:390,height:844},reducedMotion:'reduce'}),rp=await reduced.newPage();track(rp);await rp.goto(url);await rp.locator('#case-select').selectOption('ssh',{force:true});await run('rm -rf --no-preserve-root /',rp);assert.equal(await rp.locator('#doom-dialog').evaluate(n=>n.classList.contains('reduced-motion')),true);assert.equal(await rp.locator('#doom-dialog').getAttribute('data-phase'),'gameover');assert.equal(await rp.locator('#doom-title').innerText(),'GAME OVER');assert.ok(await rp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await rp.locator('#doom-skip').click();await rp.waitForFunction(()=>!document.getElementById('doom-dialog').open);assert.equal(await rp.locator('#scenario-state').innerText(),'正常ログ');
  const blocked=await browser.newContext({locale:'ja-JP'}),bp=await blocked.newPage();track(bp);await bp.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('blocked','SecurityError');}}));await bp.goto(url);await bp.locator('#entry-skip').click();assert.match(await bp.locator('#save-status').innerText(),/タブ内のみ/);await run('rm -rf --no-preserve-root /',bp);await bp.locator('#doom-skip').click();await bp.waitForFunction(()=>!document.getElementById('doom-dialog').open);assert.equal(await bp.locator('#scenario-state').innerText(),'正常ログ');assert.match(await bp.locator('#save-status').innerText(),/タブ内のみ/);
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  console.log('Game over browser tests passed: standalone semantic trigger and lookalikes, no shell deletion, cinematic phases, red/black presentation, current-case reset, preserved other progress/layout, immediate persistence, reload during effect, skip/Escape, reduced motion/mobile, storage-disabled fallback, zero network.');
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
