'use strict';
const {chromium, launchOptions, artifacts} = require('./helpers.js');
const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');

const url = pathToFileURL(path.resolve(__dirname, '../../index.html')).href;
const key = 'logroom.offline.v1';
const japanese = /[\u3040-\u30ff\u3400-\u9fff]/;
const languages = ['en', 'th'];

async function readState(page) {
  return page.evaluate(k => JSON.parse(localStorage.getItem(k)), key);
}
async function flush(page) {
  // pagehide exercises the application's own immediate-save path without navigation.
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
}
async function choose(page, id) {
  const index = await page.evaluate(id => LOG_LAB_CASES.findIndex(c => c.id === id), id);
  assert.ok(index >= 0, `unknown case ${id}`);
  const button = page.locator('.case-option').nth(index);
  if (await button.count() && await button.isVisible()) await button.click();
  else await page.locator('#case-select').selectOption(id);
}
async function language(page, code) {
  await page.locator('#language-select').selectOption(code);
  assert.equal(await page.evaluate(() => LogroomI18n.locale), code);
  assert.equal(await page.locator('html').getAttribute('lang'), code);
}
async function command(page, text) {
  await page.locator('#command-input').fill(text);
  await page.locator('#terminal-form').evaluate(form => form.requestSubmit());
  await flush(page);
}
async function submit(page, index, answer) {
  const card = page.locator('.task-card').nth(index);
  await card.locator('input').fill(answer);
  await card.locator('form').evaluate(form => form.requestSubmit());
}
async function close(page, name) {
  await page.locator(`[data-close="${name}-dialog"]`).click();
}
async function assertNoJapanese(page, selectors, label) {
  for (const selector of selectors) {
    const values = await page.locator(selector).allTextContents();
    for (const text of values) assert.equal(japanese.test(text), false, `${label}: Japanese remains in ${selector}: ${text.slice(0, 160)}`);
  }
}
async function noOverflow(page, selector, label) {
  assert.ok(await page.locator(selector).evaluate(el => el.scrollWidth <= el.clientWidth + 1), `${label}: horizontal overflow in ${selector}`);
}
async function checkLinks(page, item) {
  const actual = await page.locator('#debrief-content a').evaluateAll(nodes => nodes.map(n => ({href: n.href, target: n.target, rel: n.rel})));
  const expected = [...item.debrief.history, ...item.debrief.references].map(r => new URL(r.url).href);
  assert.deepEqual(actual.map(a => a.href), expected, `${item.id}: exact historical/reference URLs`);
  for (const a of actual) {
    assert.equal(a.target, '_blank');
    assert.equal(a.rel, 'noopener noreferrer');
  }
}

(async () => {
  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({viewport: {width: 1440, height: 1050}});
  const page = await context.newPage();
  const errors = [], network = [];
  const observe = p => {
    p.on('pageerror', e => errors.push(e.message));
    p.on('request', r => { if (/^https?:/.test(r.url())) network.push(r.url()); });
  };
  observe(page);
  try {
    await page.goto(url);
    assert.equal(await page.locator('#language-select').inputValue(), 'ja');
    assert.equal(await page.evaluate(() => LogroomI18n.locale), 'ja');
    const original = await page.evaluate(() => LOG_LAB_CASES.filter(c=>!c.entry));
    assert.equal(original.length, 10);
    assert.equal(original.reduce((n, c) => n + c.tasks.length, 0), 104);

    // Every translated case keeps the same forensic data and answer semantics.
    const invariantResults = await page.evaluate(() => {
      const jp = /[\u3040-\u30ff\u3400-\u9fff]/;
      const dataKeys = new Set(['id', 'answer', 'accepted', 'evidence', 'command', 'commands', 'url', 'path', 'logPaths', 'files', 'baselineFiles']);
      const results = [];
      for (const lang of ['en', 'th']) {
        const translated = LogroomI18n.localizeCases(LOG_LAB_CASES, lang);
        for (let i = 0; i < translated.length; i++) {
          const source = LOG_LAB_CASES[i], c = translated[i];
          const fail = [];
          const walk = (v, value, p = '') => {
            if (typeof v === 'string' && jp.test(v)) {
              if (typeof value !== 'string' || jp.test(value)) fail.push(p);
            } else if (v && typeof v === 'object') {
              for (const [k, child] of Object.entries(v)) if (!dataKeys.has(k)) walk(child, value?.[k], p ? p + '.' + k : k);
            }
          };
          walk(source, c);
          const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
          const logs = ['files', 'baselineFiles'].every(group => Object.entries(source[group]).every(([name, text]) => !name.startsWith('/var/log/') || c[group][name] === text));
          const tasks = source.tasks.every((t, j) => ['id', 'answer', 'accepted', 'evidence'].every(k => same(t[k], c.tasks[j][k])) && (t.hints || []).every((h, jh) => same(h.command, c.tasks[j].hints[jh].command)));
          const refs = same(source.debrief.references.map(x => x.url), c.debrief.references.map(x => x.url)) && same(source.debrief.history.map(x => x.url), c.debrief.history.map(x => x.url));
          const readmes = ['files', 'baselineFiles'].every(group => {
            const text = c[group]['/home/analyst/README.txt'];
            return typeof text === 'string' && text !== source[group]['/home/analyst/README.txt'] && !jp.test(text);
          });
          results.push({lang, id: c.id, fail, logs, tasks, refs, readmes, walkthrough: same(source.walkthrough.map(w => w.command), c.walkthrough.map(w => w.command))});
        }
      }
      return results;
    });
    for (const result of invariantResults) {
      assert.deepEqual(result.fail, [], `${result.lang}/${result.id}: untranslated prose`);
      for (const test of ['logs', 'tasks', 'refs', 'readmes', 'walkthrough']) assert.equal(result[test], true, `${result.lang}/${result.id}: ${test}`);
    }
    assert.deepEqual(await page.evaluate(() => LOG_LAB_CASES.filter(c=>!c.entry)), original, 'localizeCases does not mutate canonical Japanese data');

    // Prepare another case so resets can prove isolation later.
    await choose(page, 'web');
    await page.locator('#apply-attack').click();
    await submit(page, 0, original.find(c => c.id === 'web').tasks[0].answer);
    await flush(page);
    const otherProgress = (await readState(page)).cases.web;

    await choose(page, 'ssh');
    await page.locator('#apply-attack').click();
    await page.locator('.task-card').first().locator('.task-tools .text-button').first().click();
    await submit(page, 0, original[0].tasks[0].answer);
    await page.locator('#tab-notes').click();
    await page.locator('#notes').fill('自動: ユーザーの調査メモ / user note / บันทึกของผู้ใช้');
    await command(page, "echo '自動' > /home/analyst/user-note.txt");
    await command(page, "echo '自動'");
    await command(page, 'cd /var/log');
    await page.locator('#terminal-width').evaluate(el => {el.value = '74'; el.dispatchEvent(new Event('input', {bubbles: true}));});
    await page.locator('#terminal-height').evaluate(el => {el.value = '420'; el.dispatchEvent(new Event('input', {bubbles: true}));});
    await flush(page);
    const before = await readState(page);
    const draft = "grep '自動' /var/log/auth.log";
    await page.locator('#command-input').fill(draft);
    await page.locator('#command-input').evaluate(el => el.setSelectionRange(5, 9));
    const userEntry = before.cases.ssh.entries.find(e => e.command === "echo '自動'");
    assert.equal(userEntry.stdout, '自動\n');

    for (const code of ['en', 'th', 'ja']) {
      await language(page, code);
      const after = await readState(page);
      assert.equal(after.locale, code);
      assert.equal(after.caseId, before.caseId);
      assert.deepEqual(after.ui, before.ui, `${code}: layout retained`);
      assert.deepEqual(after.cases.web, otherProgress, `${code}: other-case progress retained`);
      for (const k of ['attackApplied', 'answers', 'solved', 'hints', 'revealed', 'viewed', 'notes', 'history', 'entries', 'cwd', 'directories']) {
        assert.deepEqual(after.cases.ssh[k], before.cases.ssh[k], `${code}: retained ${k}`);
      }
      assert.equal(after.cases.ssh.edits['/home/analyst/user-note.txt'], '自動\n', `${code}: virtual user file retained`);
      assert.equal(await page.locator('#notes').inputValue(), before.cases.ssh.notes);
      assert.equal(await page.locator('#command-input').inputValue(), draft);
      assert.deepEqual(await page.locator('#command-input').evaluate(el => [el.selectionStart, el.selectionEnd]), [5, 9]);
      assert.equal(await page.locator('#terminal-cwd').innerText(), '/var/log');
      assert.equal(await page.locator('#tab-notes').getAttribute('aria-selected'), 'true');
      const echoed = await page.locator('.terminal-block').allTextContents();
      assert.ok(echoed.some(x => x.includes("echo '自動'") && x.includes('自動')), `${code}: user-entered command and output retained`);
    }

    // Complete a full case in each non-Japanese language and inspect the article.
    for (const [idx, code] of languages.entries()) {
      await language(page, code);
      await page.locator('#tab-tasks').click();
      const item = original[idx];
      await choose(page, item.id);
      if (!await page.locator('#apply-attack').isDisabled()) await page.locator('#apply-attack').click();
      const translated = await page.evaluate(({lang, id}) => LogroomI18n.localizeCases(LOG_LAB_CASES, lang).find(c => c.id === id), {lang: code, id: item.id});
      for (let i = 0; i < item.tasks.length; i++) await submit(page, i, item.tasks[i].answer);
      assert.equal(await page.locator('#debrief-open').isDisabled(), false);
      await page.locator('#debrief-open').click();
      const text = await page.locator('#debrief-content').innerText();
      assert.ok(text.includes(translated.debrief.title));
      assert.ok(text.includes(translated.debrief.knowledge[0].detail));
      assert.ok(text.includes(translated.debrief.history[0].relation));
      await assertNoJapanese(page, ['#debrief-content'], code + ' debrief');
      await checkLinks(page, item);
      await noOverflow(page, '#debrief-dialog', code + ' desktop');
      await close(page, 'debrief');

      // Render every case context and the full question text, hints, and solutions.
      for (const c of original) {
        await choose(page, c.id);
        const localized = await page.evaluate(({lang, id}) => LogroomI18n.localizeCases(LOG_LAB_CASES, lang).find(x => x.id === id), {lang: code, id: c.id});
        assert.equal(await page.locator('#case-title').innerText(), localized.title);
        assert.deepEqual(await page.locator('.task-card h3').allTextContents(), localized.tasks.map(t => t.label));
        assert.deepEqual(await page.locator('.task-prompt').allTextContents(), localized.tasks.map(t => t.prompt));
        await page.locator('#context-open').click();
        const contextText = await page.locator('#context-content').innerText();
        assert.ok(contextText.includes(localized.context.situation));
        assert.ok(contextText.includes(localized.context.objective));
        for (const p of c.logPaths) assert.ok(contextText.includes(p));
        await assertNoJapanese(page, ['#context-content'], code + '/' + c.id + ' context');
        await noOverflow(page, '#context-dialog', code + '/' + c.id);
        await close(page, 'context');
        if (!await page.locator('#apply-attack').isDisabled()) await page.locator('#apply-attack').click();
        const card = page.locator('.task-card').first();
        const hint = card.locator('.task-tools .text-button').first();
        if (!await hint.isDisabled()) await hint.click();
        if (!(await card.locator('.solution-box').count())) await card.locator('.task-tools .text-button').last().click();
        assert.ok((await card.locator('.hint-box').innerText()).includes(localized.tasks[0].hints[0].text));
        assert.ok((await card.locator('.solution-box').innerText()).includes(localized.tasks[0].explanation));
        await assertNoJapanese(page, ['#case-meta', '#case-title', '#case-summary', '#briefing-content', '.task-header', '.task-prompt', '.hint-box', '.solution-box'], code + '/' + c.id);
      }
    }

    // Locale survives reload. Reset removes only the chosen case, preserving language.
    await language(page, 'th');
    await choose(page, 'ssh');
    await page.locator('#layout-reset').click();
    await flush(page);
    const beforeReload = await readState(page);
    await page.reload();
    assert.equal(await page.locator('#language-select').inputValue(), 'th');
    assert.equal(await page.evaluate(() => LogroomI18n.locale), 'th');
    assert.equal((await readState(page)).caseId, 'ssh');
    await page.locator('#case-reset').click();
    await page.locator('#reset-confirm').click();
    await flush(page);
    const reset = await readState(page);
    assert.equal(reset.locale, 'th');
    assert.equal(reset.cases.ssh.attackApplied, false);
    assert.deepEqual(reset.cases.ssh.answers, {});
    assert.equal(reset.cases.ssh.notes, '');
    assert.deepEqual(reset.cases.web, beforeReload.cases.web);
    assert.deepEqual(reset.ui, beforeReload.ui);

    // English and Thai dialogs must fit narrow screens, with scrollable articles.
    for (const code of languages) {
      await language(page, code);
      for (const width of [1440, 390, 320]) {
        await page.setViewportSize({width, height: 900});
        await page.waitForTimeout(75);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${code}: page overflow at ${width}`);
        await page.locator('#commands-open').click();
        await noOverflow(page, '#commands-dialog', `${code}/${width}`);
        await assertNoJapanese(page, ['#commands-dialog'], `${code}/${width} commands`);
        await close(page, 'commands');
        await choose(page, 'ssrf');
        await page.locator('#context-open').click();
        await noOverflow(page, '#context-dialog', `${code}/${width}`);
        await assertNoJapanese(page, ['#context-content'], `${code}/${width} context`);
        await close(page, 'context');
        await choose(page, 'web');
        await page.locator('#debrief-open').click();
        await noOverflow(page, '#debrief-dialog', `${code}/${width}`);
        await assertNoJapanese(page, ['#debrief-content'], `${code}/${width} debrief`);
        await close(page, 'debrief');
      }
      await page.screenshot({path: path.join(artifacts, `i18n-${code}-mobile.png`), fullPage: false});
    }

    // A corrupt saved preference falls back to Japanese without discarding progress.
    const fallbackContext = await browser.newContext();
    const fallbackPage = await fallbackContext.newPage(); observe(fallbackPage);
    await fallbackPage.addInitScript(({storeKey, saved}) => {saved.locale = 'invalid-locale'; localStorage.setItem(storeKey, JSON.stringify(saved));}, {storeKey: key, saved: reset});
    await fallbackPage.goto(url);
    assert.equal(await fallbackPage.locator('#language-select').inputValue(), 'ja');
    assert.equal(await fallbackPage.evaluate(() => LogroomI18n.locale), 'ja');
    await flush(fallbackPage);
    const fallback = await readState(fallbackPage);
    assert.equal(fallback.locale, 'ja');
    assert.deepEqual(fallback.cases.web, reset.cases.web);
    await fallbackContext.close();

    // Storage-denied browsers still switch languages and keep state within the tab.
    const deniedContext = await browser.newContext();
    const deniedPage = await deniedContext.newPage(); observe(deniedPage);
    await deniedPage.addInitScript(() => Object.defineProperty(window, 'localStorage', {get() {throw new DOMException('Storage denied for test', 'SecurityError');}}));
    await deniedPage.goto(url);
    await deniedPage.locator('#entry-skip').click();
    await deniedPage.locator('#apply-attack').click();
    await submit(deniedPage, 0, original[0].tasks[0].answer);
    await deniedPage.locator('#command-input').fill('echo temporary');
    for (const code of ['en', 'th', 'ja']) {
      await language(deniedPage, code);
      assert.equal(await deniedPage.locator('#apply-attack').isDisabled(), true);
      assert.equal(await deniedPage.locator('.task-card').first().locator('input').inputValue(), original[0].tasks[0].answer);
      assert.equal(await deniedPage.locator('.task-card.correct').count(), 1);
      assert.equal(await deniedPage.locator('#command-input').inputValue(), 'echo temporary');
    }
    await deniedContext.close();
    assert.deepEqual(errors, [], 'no page errors');
    assert.deepEqual(network, [], 'no HTTP requests during offline locale changes');
    console.log('i18n browser tests passed: 3 languages; 10 cases / 104 questions; immutable forensic data and reference URLs; full English/Thai debriefs; all contexts, hints, and explanations; preserved progress/files/notes/history/cwd/layout/draft; reload/reset/fallback/storage-denied; 320/390px layout; zero network.');
  } finally {
    await browser.close();
  }
})().catch(error => {console.error(error); process.exitCode = 1;});
