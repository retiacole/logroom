'use strict';
const {chromium,launchOptions,artifacts}=require('./helpers.js');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const {pathToFileURL}=require('node:url');
const {gunzipSync}=require('node:zlib');
(async()=>{
  const browser=await chromium.launch(launchOptions),page=await browser.newPage({locale:'ja-JP',viewport:{width:1440,height:1050}}),errors=[],network=[];
  page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(/^https?:/.test(request.url()))network.push(request.url());});
  const flush=()=>page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
  const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('logroom.offline.v1')));
  const run=async command=>{await page.locator('#command-input').fill(command);await page.locator('#terminal-form').evaluate(form=>form.requestSubmit());await flush();return (await state()).cases.ssh.entries.at(-1);};
  const settings=async(mode,seed)=>{if(!await page.locator('.practice-settings').evaluate(el=>el.open))await page.locator('.practice-settings summary').click();await page.locator('#practice-mode').selectOption(mode);await page.locator('#practice-seed').fill(seed);await page.locator('#practice-apply').click();await flush();};
  try{
    await page.goto(pathToFileURL(path.resolve(__dirname,'../../index.html')).href);
    await page.locator('#entry-skip').click();
    assert.equal(await page.locator('#terminal-hostname').innerText(),'analyst@edge-01');
    assert.equal(await page.locator('#terminal-cwd').innerText(),'~');
    await page.locator('#apply-attack').click();
    const first=page.locator('.task-card').first();await first.locator('input').fill('１９８．５１．１００．７３。');await first.locator('form').evaluate(form=>form.requestSubmit());
    assert.ok(await first.evaluate(el=>el.classList.contains('correct')));assert.match(await first.locator('.feedback').innerText(),/対象ログを読む/);
    await run("grep -wF '198.51.100.73' /var/log/auth.log | sort -k1,1M -k2,2n -k3,3 > ~/timeline.txt");
    await page.locator('#artifact-task button').click();assert.match(await page.locator('#artifact-task .feedback').innerText(),/全イベントが時刻順/);
    await run('echo wrong >> ~/timeline.txt');assert.match(await page.locator('#artifact-task .feedback').innerText(),/保存先/);
    await run('touch ~/mtime.txt');await run("stat -c '%Y' ~/mtime.txt");const mtime=(await state()).cases.ssh.entries.at(-1).stdout;
    await page.locator('#language-select').selectOption('en');
    assert.equal((await run("stat -c '%Y' ~/mtime.txt")).stdout,mtime);
    await settings('advanced','95');
    assert.equal((await run('ls /baseline')).stderr.includes('No such'),true);
    assert.match((await run('cat /var/log/auth.log')).stderr,/Permission denied/);
    assert.equal((await run('id -nG')).stdout,'analyst\n');
    assert.ok(Number((await run('sudo wc -l /var/log/auth.log')).stdout.split(' ')[0])>20000);
    assert.equal((await run('sudo zgrep -c "Failed password" /var/log/auth.log.2.gz')).stderr,'');
    const readme=(await run('cat ~/README.txt')).stdout;assert.ok(!readme.includes('/baseline'));
    assert.equal(await page.locator('#apply-attack').isDisabled(),true);
    const ip=await page.evaluate(()=>LogroomPractice.variantCases(LOG_LAB_CASES,{seed:'95'}).find(c=>c.id==='ssh').tasks[0].answer);
    assert.notEqual(ip,'198.51.100.73');
    assert.equal((await run(`sudo grep 'Failed password' /var/log/auth.log | grep '${ip}' | wc -l`)).stdout,'60\n');
    await run(`sudo grep '${ip}' /var/log/auth.log | sort -k1,1M -k2,2n -k3,3 > ~/timeline.txt`);
    await page.locator('#artifact-task button').click();assert.match(await page.locator('#artifact-task .feedback').innerText(),/File verified/);
    const downloadPromise=page.waitForEvent('download');await page.locator('#export-logs').click();const download=await downloadPromise;
    assert.equal(download.suggestedFilename(),'logroom-ssh-logs.tar');
    const bytes=fs.readFileSync(await download.path()),entries={};
    for(let at=0;bytes[at];){const h=bytes.subarray(at,at+512),name=h.subarray(0,100).toString().replace(/\0.*/,''),size=parseInt(h.subarray(124,136).toString(),8);entries[name]=bytes.subarray(at+512,at+512+size);at+=512+Math.ceil(size/512)*512;}
    assert.match(gunzipSync(entries['logroom-ssh/var/log/auth.log.2.gz']).toString(),/^Aug  9/m);
    assert.ok(entries['logroom-ssh/var/log/auth.log'].toString().includes(ip));assert.ok(entries['logroom-ssh/home/analyst/timeline.txt']);
    await page.reload();assert.equal(await page.locator('#practice-mode').inputValue(),'advanced');assert.equal(await page.locator('#practice-seed').inputValue(),'95');
    assert.match(await page.locator('#artifact-task .feedback').innerText(),/File verified/);
    await settings('basic','');assert.equal(await first.locator('input').inputValue(),'１９８．５１．１００．７３。');
    for(const language of ['en','th']){await page.locator('#language-select').selectOption(language);for(const selector of ['.practice-settings','#artifact-task','#terminal-output .terminal-welcome'])assert.equal(/[\u3040-\u30ff\u3400-\u9fff]/.test(await page.locator(selector).innerText()),false,selector+' '+language);}
    await page.locator('#language-select').selectOption('ja');
    await page.screenshot({path:path.join(artifacts,'review-practice-desktop.png')});
    for(const width of [390,320]){await page.setViewportSize({width,height:900});await page.waitForTimeout(100);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'practice controls fit '+width);}
    await page.screenshot({path:path.join(artifacts,'review-practice-mobile.png')});
    assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
    console.log('Practice browser tests passed: fullwidth answers, evidence prompt, timeline checks, metadata persistence, advanced permissions/20k lines, seeded profiles, real gzip download, 3 locales, responsive controls, zero network.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
