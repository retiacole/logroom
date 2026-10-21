'use strict';
(() => {
  const baseCases = globalThis.LOG_LAB_CASES;
  const i18n = globalThis.LogroomI18n;
  const tr = (...args) => i18n.t(...args);
  let cases = baseCases;
  const $ = id => document.getElementById(id);
  const STORE_KEY = 'logroom.offline.v1';
  const makeCaseState = () => ({attackApplied:false,answers:{},feedback:{},solved:[],hints:{},revealed:[],viewed:[],notes:'',history:[],entries:[],edits:{},directories:[]});
  let state = {version:1,caseId:cases[0].id,cases:{}};
  let storageAvailable = true;
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (saved && saved.version === 1 && typeof saved.cases === 'object' && saved.cases && cases.some(c => c.id === saved.caseId)) state = saved;
    localStorage.setItem('logroom.storage-check','1'); localStorage.removeItem('logroom.storage-check');
  } catch (_) {storageAvailable = false;}
  state.ui={panelHidden:false,width:62,height:null,...(state.ui||{})};
  state.ui.width=Math.max(40,Math.min(80,Number(state.ui.width)||62));
  state.ui.height=state.ui.height===null?null:Math.max(180,Math.min(800,Number(state.ui.height)||360));
  state.ui.panelHidden=state.ui.panelHidden===true;
  state.locale=i18n.setLocale(state.locale);
  cases=i18n.localizeCases(baseCases);
  i18n.captureStatic(document);i18n.applyStatic(document);
  let currentCase, cs, shell, historyIndex = -1, draft = '', saveTimer, toastTimer;
  let activeTab = 'tasks';
  let doomActive=false, doomTimer, doomCaseId, doomRebuilt=false, doomReduced=false;
  let trainActive=false;
  const node = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = tr(text);
    return n;
  };
  const normalize = value => String(value).trim().replace(/\s+/g,' ').toLowerCase();
  const isCorrect = (task, value) => [task.answer,...(task.accepted || [])].some(a => normalize(a) === normalize(value));
  function hydrateCase(raw) {
    const s = {...makeCaseState(),...(raw || {})};
    // v0.1 stored attacked logs without a mode field. Preserve those saved sessions.
    s.attackApplied = raw && typeof raw.attackApplied !== 'boolean' ? true : s.attackApplied === true;
    for (const key of ['answers','feedback','hints','edits']) if (!s[key] || typeof s[key] !== 'object' || Array.isArray(s[key])) s[key] = {};
    for (const key of ['solved','revealed','viewed','history','entries','directories']) if (!Array.isArray(s[key])) s[key] = [];
    s.notes = typeof s.notes === 'string' ? s.notes : '';
    s.history = s.history.filter(x => typeof x === 'string').slice(-100);
    s.entries = s.entries.filter(x => x && typeof x.command === 'string' && typeof x.stdout === 'string' && typeof x.stderr === 'string').slice(-60);
    return s;
  }
  function save(immediate = false) {
    clearTimeout(saveTimer);
    const perform = () => {
      if (!storageAvailable) { $('save-status').textContent = tr(tr('保存はこのタブ内のみ')); return; }
      try { localStorage.setItem(STORE_KEY,JSON.stringify(state)); $('save-status').textContent = tr(tr('このブラウザに保存済み')); }
      catch (_) { storageAvailable = false; $('save-status').textContent = tr(tr('永続保存できません · メモを書き出せます')); }
    };
    if (immediate) perform(); else saveTimer = setTimeout(perform,250);
  }
  function toast(message) {
    clearTimeout(toastTimer); $('toast').textContent = tr(message); $('toast').hidden = false;
    toastTimer = setTimeout(() => { $('toast').hidden = true; },3500);
  }
  function insertCommand(command) {
    $('command-input').value = command;
    $('command-input').focus();
    $('command-input').setSelectionRange(command.length,command.length);
    if (window.innerWidth < 850) $('terminal-form').scrollIntoView({block:'center',behavior:'auto'});
  }
  function commandButton(command, label) {
    const button = node('button','command-chip',label || command); button.type = 'button';
    button.title = tr('入力欄へ入れる（実行はEnter）');
    button.addEventListener('click',() => insertCommand(command)); return button;
  }
  function baselineFiles(c = currentCase) { return c.baselineFiles || c.files; }
  function activeFiles() {
    const normal = baselineFiles(), files = {...(cs.attackApplied ? currentCase.files : normal)};
    Object.entries(normal).forEach(([path,text]) => {if (path.startsWith('/var/log/')) files['/baseline'+path] = text;});
    files['/baseline/README.txt'] = tr('攻撃前の正常ログのコピーです。元のパスの前に /baseline を付けています。\n例：diff -u /baseline/var/log/auth.log /var/log/auth.log\ndiff の終了コード0は差分なし、1は差分ありです。\n');
    return files;
  }
  function renderMode() {
    $('scenario-state').textContent = tr(cs.attackApplied ? tr('攻撃後ログ') : tr('正常ログ'));
    $('scenario-state').classList.toggle('attacked',cs.attackApplied);
    $('scenario-summary').textContent = tr(cs.attackApplied ? tr('攻撃イベントを反映しました。正常時と比較して調べましょう。') : tr('正常なログを観察してから、攻撃を再現できます。'));
    $('apply-attack').disabled = cs.attackApplied;
    $('apply-attack').textContent = tr(cs.attackApplied ? tr('攻撃ログ適用済み') : tr('攻撃ログを生成'));
    $('baseline-notice').hidden = cs.attackApplied;
    $('walkthrough').hidden = !cs.attackApplied;
    if (!cs.attackApplied) $('walkthrough').open = false;
    $('briefing-content').replaceChildren(node('p','',cs.attackApplied?tr('以下は攻撃後ログに関する調査依頼です。'):tr('現在は正常ログです。以下の調査依頼は攻撃ログを生成した後の状況を説明します。')),...currentCase.briefing.map(p=>node('p','',p)));
  }
  function applyAttack() {
    if (cs.attackApplied) return;
    // Replace the canonical scenario log streams; keep user notes and result files.
    Object.entries(currentCase.files).forEach(([path,text]) => {shell.files[path] = text;});
    shell.allPaths();
    cs.attackApplied = true;
    persistFiles(); renderMode(); renderTasks(); renderProgress(); save(true);
    const entry = {command:tr('[演習] 攻撃ログを生成'),cwd:shell.cwd,stdout:(currentCase.attack?.label || currentCase.shortTitle || currentCase.title)+tr(' の合成ログを反映しました。\n正常ログは /baseline/var/log/ 以下に残っています。\n'),stderr:''};
    cs.entries.push(entry);cs.entries=cs.entries.slice(-60);appendEntry(entry);
    $('terminal-output').scrollTop=$('terminal-output').scrollHeight;
    $('last-exit').textContent=tr(tr('攻撃ログを反映'));$('last-exit').className='';save();
    toast(tr('攻撃ログを反映しました。設問と正常時との差分を調べられます。'));
  }
  function renderNav() {
    const nav = $('case-nav'); nav.replaceChildren();
    $('case-select').replaceChildren(...cases.map((c,i)=>{const o=node('option','',`${i+1}. ${c.title}`);o.value=c.id;o.selected=c.id===state.caseId;return o;}));
    cases.forEach((c,i) => {
      const saved = state.cases[c.id] || makeCaseState();
      const n = c.tasks.filter(t => (saved.solved || []).includes(t.id) && isCorrect(t,(saved.answers || {})[t.id] || '')).length;
      const button = node('button','case-option'); button.type = 'button';
      button.setAttribute('aria-current',c.id === state.caseId ? 'true':'false');
      button.append(node('span','case-index',String(i + 1).padStart(2,'0')));
      const shortTitles = {ssh:tr('SSH認証'),web:tr('Web監査'),egress:tr('DNS・メール・プロキシ'),sqli:tr('SQLインジェクション'),cmdinj:tr('コマンドインジェクション'),pathtraversal:tr('パストラバーサル'),webauth:tr('Web認証'),ssrf:'SSRF',upload:tr('アップロード'),tamper:tr('ログ改変')};
      const title = node('span','case-option-text'); title.append(node('span','case-option-title',shortTitles[c.id] || c.shortTitle || c.title),node('span','case-option-sub',tr`${c.level} · ${c.minutes}分`));
      button.append(title,node('span','case-option-progress',`${n}/${c.tasks.length}`));
      button.addEventListener('click',() => { if (c.id !== state.caseId) selectCase(c.id); }); nav.append(button);
    });
  }
  function welcome() {
    const wrap = node('div','terminal-welcome');
    wrap.append(node('strong','', tr('Logroom / ログ分析ターミナル')));
    wrap.append(document.createTextNode(tr`\n${currentCase.title}\n${cs.attackApplied?tr('攻撃後ログ'):tr('正常ログ')}を読み込みました。時刻はUTCです。\n\nまず ${currentCase.initialCommand} を入力してください。\n${cs.attackApplied?tr('正常ログとの比較は diff -u /baseline/元のパス 元のパス。'):tr('正常なログを調べたら「攻撃ログを生成」を押してください。')}\nhelp で対応コマンド、help grep で使い方を確認できます。\nこの端末は学習用シミュレーターです。\n`));
    return wrap;
  }
  function appendEntry(entry) {
    const block = node('div','terminal-block');
    block.append(node('pre','terminal-command',`analyst@logroom:${entry.cwd || '/home/analyst'}$ ${entry.command}`));
    if (entry.stdout) block.append(node('pre','terminal-result',entry.stdout));
    if (entry.stderr) block.append(node('pre','terminal-error',entry.stderr));
    $('terminal-output').append(block);
  }
  function renderTerminal() {
    $('terminal-output').replaceChildren(welcome()); cs.entries.forEach(appendEntry);
    $('terminal-cwd').textContent = tr(shell.cwd);
    $('terminal-output').scrollTop = $('terminal-output').scrollHeight;
  }
  function persistFiles() {
    cs.edits = {};
    const canonical = activeFiles();
    for (const [path,text] of Object.entries(shell.files)) if (typeof text === 'string' && canonical[path] !== text) cs.edits[path] = text;
    for (const path of Object.keys(canonical)) if (!(path in shell.files)) cs.edits[path] = null;
    cs.cwd = shell.cwd;
    cs.directories = shell.directories instanceof Set ? [...shell.directories] : [];
  }
  function runCommand(input) {
    if (doomActive || trainActive || !input.trim()) return;
    const startingCwd = shell.cwd;
    cs.history.push(input); cs.history = cs.history.slice(-100); historyIndex = cs.history.length; draft = '';
    let result;
    shell.history = cs.history.slice(0,-1);
    try {result = shell.run(input);}
    catch (_) { result = {stdout:'',stderr:tr('内部エラー：このコマンドを処理できませんでした。help で対応構文を確認してください。\n'),code:2}; }
    if(result.gameOver){startRootGameOver();return;}
    let stdout = String(result.stdout || ''), stderr = String(result.stderr || '');
    if (stdout.length > 120000) stdout = stdout.slice(0,120000) + tr('\n[表示を120,000文字で省略しました。grep / head で絞り込んでください。]\n');
    const entry = {command:input,cwd:startingCwd,stdout,stderr};
    if (result.clear) { cs.entries = []; $('terminal-output').replaceChildren(); }
    else {cs.entries.push(entry);cs.entries = cs.entries.slice(-60);appendEntry(entry);}
    while ($('terminal-output').children.length > 61) $('terminal-output').firstElementChild.remove();
    $('terminal-cwd').textContent = tr(shell.cwd);
    $('terminal-output').scrollTop = $('terminal-output').scrollHeight;
    $('last-exit').textContent = tr(tr`終了コード ${result.code}`);
    $('last-exit').classList.toggle('bad-exit',Boolean(stderr) || result.code > 1);
    $('last-exit').classList.toggle('informational-exit',result.code === 1 && !stderr);
    $('last-exit').title = result.code === 1 && !stderr ? tr('grepの一致なし、diffの差分ありなどでも終了コード1になります。') : '';
    $('command-input').value = '';
    persistFiles(); save();
    if (result.pager && !stderr) openPager(stdout,input);
    if (result.editor && !stderr) openVi(result.editor);
    if (result.train && !stderr) startTrain(entry);
  }
  function startTrain(entry){
    if(trainActive)return;
    trainActive=true;
    const input=$('command-input'),wasReadonly=input.readOnly,block=$('terminal-output').lastElementChild;
    const controls=[...$('app-shell').querySelectorAll('button,input,textarea,select')].filter(el=>el!==input).map(el=>[el,el.disabled]);
    controls.forEach(([el])=>el.disabled=true);input.readOnly=true;
    $('terminal-form').setAttribute('aria-busy','true');$('last-exit').textContent=tr(tr('sl / 通過待ち'));
    input.focus({preventScroll:true});
    let done=false;
    const finish=(message=tr('機関車が通過しました。\n'),code=0)=>{
      if(done)return;done=true;trainActive=false;
      controls.forEach(([el,disabled])=>el.disabled=disabled);input.readOnly=wasReadonly;
      $('terminal-form').removeAttribute('aria-busy');
      entry.stdout=message;if(block?.isConnected)block.append(node('pre',code?'terminal-error':'terminal-result',message));
      $('last-exit').textContent=tr(tr('終了コード ')+code);$('last-exit').classList.toggle('bad-exit',code!==0);
      $('terminal-output').scrollTop=$('terminal-output').scrollHeight;save();input.focus({preventScroll:true});
    };
    try{
      globalThis.LogLabTrain.play($('terminal-output'),{reducedMotion:window.matchMedia('(prefers-reduced-motion: reduce)').matches,onDone:()=>finish()});
      $('terminal-output').scrollTop=$('terminal-output').scrollHeight;
    }catch(_){finish(tr('slの表示を開始できませんでした。\n'),2);}
  }
  function renderProgress() {
    const n = currentCase.tasks.filter(t => cs.solved.includes(t.id) && isCorrect(t,cs.answers[t.id] || '')).length;
    $('task-count').textContent = tr(`${n}/${currentCase.tasks.length}`);
    $('progress-label').textContent = tr(cs.attackApplied ? tr`${n} / ${currentCase.tasks.length} 正解` : tr('攻撃ログ生成後に解答'));
    $('progress-fill').style.width = `${n / currentCase.tasks.length * 100}%`;
    const completed=cs.attackApplied&&n===currentCase.tasks.length;
    $('debrief-open').disabled=!completed;
    $('debrief-callout').classList.toggle('unlocked',completed);
    $('debrief-status').textContent=tr(completed?tr('全問正解 · ケース完了'):tr('演習後の解説'));
    $('debrief-unlock-note').textContent=tr(completed?tr('攻撃の流れ、原因、影響、検知・対策を振り返れます。'):tr`全${currentCase.tasks.length}問に正解すると、攻撃全体の詳しい解説を読めます。`);
    renderNav();
  }
  function solution(task) {
    const wrap = node('div','solution-box');
    wrap.append(node('p','',tr`解答：${task.answer}`),node('p','',task.explanation));
    (task.evidence || []).forEach(e => {
      const ev = node('div','solution-evidence');
      const b = node('button','text-button',tr`${e.path} : ${e.line}行`); b.type = 'button';
      b.addEventListener('click',() => insertCommand(`sed -n '${Math.max(1,e.line - 1)},${e.line + 1}p' ${e.path}`));
      ev.append(b,node('pre','',e.quote)); wrap.append(ev);
    }); return wrap;
  }
  function renderTasks() {
    const list = $('task-list'); list.replaceChildren();
    currentCase.tasks.forEach((task,i) => {
      const correct = cs.solved.includes(task.id) && isCorrect(task,cs.answers[task.id] || '');
      const card = node('article',`task-card${correct?' correct':''}`);
      const head = node('div','task-header'); head.append(node('span','task-number',correct?'✓':String(i+1)),node('h3','',task.label));
      card.append(head,node('p','task-prompt',task.prompt));
      const form = node('form','answer-form');
      const input = node('input'); input.type = 'text'; input.value = cs.answers[task.id] || ''; input.placeholder = task.placeholder || tr('解答を入力');
      input.disabled = !cs.attackApplied;
      input.setAttribute('aria-label',tr`${task.label}の解答`); input.spellcheck = false; input.autocomplete = 'off';
      const fb = node('p','feedback'); fb.setAttribute('aria-live','polite');
      if (correct) {fb.classList.add('success'); fb.textContent = tr(cs.viewed.includes(task.id)?tr('正解です（解答前に解説を閲覧）。'):tr('正解です。根拠の行も確認しましょう。'));}
      else if (cs.feedback[task.id] === 'incorrect') {fb.classList.add('error');fb.textContent = tr(tr('まだ一致しません。設問の形式とログの根拠を確認してください。'));input.setAttribute('aria-invalid','true');}
      input.addEventListener('input',() => {
        cs.answers[task.id] = input.value;
        cs.feedback[task.id] = '';
        cs.solved = cs.solved.filter(x => x !== task.id);
        fb.textContent = tr(''); fb.className = 'feedback'; input.removeAttribute('aria-invalid');
        card.classList.remove('correct'); head.firstElementChild.textContent = tr(String(i+1));
        renderProgress(); save();
      });
      const check = node('button','button',correct?tr('再確認'):tr('確認'));check.type = 'submit';check.disabled = !cs.attackApplied;
      form.append(input,check);
      form.addEventListener('submit',event => {
        event.preventDefault(); if (!cs.attackApplied) return; cs.answers[task.id] = input.value;
        const previouslyComplete=currentCase.tasks.every(t=>cs.solved.includes(t.id)&&isCorrect(t,cs.answers[t.id]||''));
        if (!input.value.trim()) { fb.textContent = tr(tr('解答を入力してください。')); fb.className = 'feedback error'; input.focus(); return; }
        const match = isCorrect(task,input.value);
        cs.feedback[task.id] = match?'correct':'incorrect';
        cs.solved = cs.solved.filter(x => x !== task.id); if (match) cs.solved.push(task.id);
        if (match && !cs.revealed.includes(task.id)) cs.revealed.push(task.id);
        renderTasks(); renderProgress(); save();
        if(!previouslyComplete&&currentCase.tasks.every(t=>cs.solved.includes(t.id)&&isCorrect(t,cs.answers[t.id]||'')))toast(tr('全問正解です。設問の下から「攻撃の詳しい解説」を開けます。'));
      });
      card.append(form,fb);
      const tools = node('div','task-tools');
      const shown = Math.min(cs.hints[task.id] || 0,(task.hints || []).length);
      if ((task.hints || []).length) {
        const hint = node('button','text-button',shown < task.hints.length ? tr`ヒント ${shown}/${task.hints.length}`:tr('ヒントをすべて表示中'));hint.type = 'button';hint.disabled = !cs.attackApplied || shown >= task.hints.length;
        hint.addEventListener('click',() => { cs.hints[task.id] = shown+1; renderTasks(); save(); });tools.append(hint);
      }
      const reveal = node('button','text-button',cs.revealed.includes(task.id)?tr('解説を閉じる'):tr('解説を見る'));reveal.type='button';reveal.disabled=!cs.attackApplied;
      reveal.addEventListener('click',() => {if (cs.revealed.includes(task.id)) cs.revealed = cs.revealed.filter(x=>x!==task.id);else {cs.revealed.push(task.id);if (!correct && !cs.viewed.includes(task.id)) cs.viewed.push(task.id);}renderTasks();save();});tools.append(reveal);card.append(tools);
      if (shown && cs.attackApplied) {
        const hints = node('div','hint-box');
        task.hints.slice(0,shown).forEach((h,index) => {hints.append(node('p','',`${index+1}. ${typeof h==='string'?h:h.text}`)); if (h.command) hints.append(commandButton(h.command));});card.append(hints);
      }
      if (cs.attackApplied && cs.revealed.includes(task.id)) card.append(solution(task));
      list.append(card);
    });
  }
  function renderReference() {
    const target = $('command-reference');target.replaceChildren();
    const commands = shell.supportedCommands || [];
    const catalog = node('details','reference-catalog');catalog.append(node('summary','',tr`使えるコマンド一覧（${commands.length}）`));
    const catalogItems = node('div','reference-catalog-items');commands.forEach(c=>{const b=node('button','command-chip',c);b.type='button';b.addEventListener('click',()=>{selectedCommand=c;$('command-filter').value='';commandList();commandDetail(c);$('commands-dialog').showModal();});catalogItems.append(b);});catalog.append(catalogItems);target.append(catalog);
    const primary = Object.keys(currentCase.files).find(p=>p.endsWith('.log'));
    const json = Object.keys(currentCase.files).find(p=>p.endsWith('.jsonl') || p.endsWith('.json'));
    const groups = [
      [tr('移動・ファイルを見る'),tr('仮想ファイルシステムの中を移動します。'),['pwd','ls -la /var/log','cd /var/log',`less ${primary}`,`head -n 10 ${primary}`,`tail -n 10 ${primary}`]],
      [tr('検索する'),tr('-n は行番号、-i は大文字小文字を区別しない、-E は拡張正規表現。'),[`grep -n '192.0.2.' ${primary}`,`grep -E 'Failed|ERROR|DENIED' ${primary}`,`grep -v '^$' ${primary} | wc -l`]],
      [tr('パイプで集計する'),tr('| は前の標準出力を次のコマンドへ渡します。uniq は隣り合う同じ行をまとめます。'),[`cat ${primary} | head -n 5`,`awk '{print $1}' ${primary} | sort | uniq -c | sort -nr | head -n 10`]],
      [tr('行や列を取り出す'),tr('awk の空白区切りと、cut の指定文字区切りを使い分けます。'),[`sed -n '1,15p' ${primary}`,`awk '{print $1, $2, $3}' ${primary}`,`cut -d ' ' -f 1 ${primary} | head -n 5`]],
      [tr('調査結果を保存する'),tr('> は上書き、>> は追記。仮想ファイル内だけで動きます。'),[`head -n 10 ${primary} > /home/analyst/evidence.txt`,'cat /home/analyst/evidence.txt',tr('echo "調査メモ" >> /home/analyst/evidence.txt')]],
      [tr('正常時との差分を見る'),tr('/baseline以下に攻撃前のログがあります。diffの終了コード1は「差分あり」です。'),[`diff -u /baseline${primary} ${primary}`]],
      [tr('整形・行番号・文字の変換'),tr('trは文字集合、columnは列の整形、nlは行番号を扱います。'),[`nl -ba ${primary} | head -n 10`,`awk '{print $1, $2}' ${primary} | head -n 10 | column -t`,"echo 'ERROR  Warning  INFO' | tr '[:upper:]' '[:lower:]' | tr -s ' '"]],
      [tr('複数ファイルを検索する'),tr('rgは仮想ディレクトリを検索します。ログを対象にする場合は /var/log を指定します。'), ["rg -n 'ERROR|Failed|denied' /var/log"]],
      [tr('結果を残す・新しい行から読む'),tr('teeは結果を表示しながら保存、tacは行を逆順にします。'),[`head -n 5 ${primary} | tee /home/analyst/sample.txt`,`tac ${primary} | head -n 10`]],
      [tr('Base64の文字列を確認する'),tr('Base64で記録されたUTF-8テキストをデコードできます。'),["echo 'TE9HUk9PTQ==' | base64 -d"]],
      [tr('viで調査メモを書く'),tr('iで挿入モード、Escで通常モード、:wqで保存して閉じます。ファイルは演習内に保存されます。'),['vi /home/analyst/investigation.txt',`view ${primary}`]],
    ];
    if (json) groups.push([tr('JSONログを読む'),tr('jqでJSON/JSONLを整形し、キーを取り出せます。対応する式は help jq で確認できます。'),[`jq '.' ${json} | head -n 20`,`jq -c '.' ${json} | head -n 5`]]);
    groups.forEach(([title,desc,commands]) => {const group = node('div','reference-group');group.append(node('h3','',title),node('p','',desc));commands.forEach(c=>group.append(commandButton(c)));target.append(group);});
  }
  function selectCase(id) {
    if(trainActive)return;
    currentCase = cases.find(c=>c.id===id) || cases[0];state.caseId = currentCase.id;
    cs = hydrateCase(state.cases[currentCase.id]);state.cases[currentCase.id] = cs;
    shell = new globalThis.LogLabShell(activeFiles());
    Object.entries(cs.edits).forEach(([path,text])=> {if (!path.startsWith('/')) return;if (text === null) delete shell.files[path];else if (typeof text === 'string') shell.files[path] = text;});
    if (shell.directories instanceof Set) cs.directories.filter(x=>typeof x==='string' && x.startsWith('/')).forEach(x=>shell.directories.add(x));
    if (cs.cwd && (shell.directories instanceof Set && shell.directories.has(cs.cwd))) shell.cwd = cs.cwd;
    historyIndex = cs.history.length;draft = '';
    $('case-meta').textContent = tr(tr`CASE ${String(cases.indexOf(currentCase)+1).padStart(2,'0')} / ${currentCase.level} / 目安 ${currentCase.minutes}分`);
    $('case-title').textContent = tr(currentCase.title);$('case-summary').textContent = tr(currentCase.summary);
    $('initial-command').textContent = tr(currentCase.initialCommand);
    $('initial-command').onclick = () => insertCommand(currentCase.initialCommand);
    $('notes').value = cs.notes;$('command-input').value='';$('last-exit').textContent=tr(tr('準備完了'));$('last-exit').className='';
    $('walkthrough-list').replaceChildren(...currentCase.walkthrough.map((w,i)=> {const step = node('div','walk-step');step.append(node('h4','',`${i+1}. ${w.title}`),commandButton(w.command),node('p','',w.explanation));return step;}));
    renderMode();renderNav();renderTerminal();renderTasks();renderProgress();renderReference();applyLayout();save();
  }
  function setTab(name) {
    activeTab = name;
    ['tasks','commands','notes'].forEach(n=> {const selected=n===name;$(`tab-${n}`).setAttribute('aria-selected',String(selected));$(`tab-${n}`).tabIndex=selected?0:-1;$(`panel-${n}`).hidden=!selected;});
  }
  $('terminal-form').addEventListener('submit',e=> {e.preventDefault();runCommand($('command-input').value);});
  $('command-input').addEventListener('keydown',e=> {
    const input=e.target;
    if(trainActive){if(e.key==='Escape'||e.ctrlKey&&e.key.toLowerCase()==='c'&&input.selectionStart===input.selectionEnd)e.preventDefault();return;}
    if (e.isComposing) return;
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      if (!cs.history.length) return;e.preventDefault();
      if (historyIndex===cs.history.length) draft=input.value;
      historyIndex=Math.max(0,Math.min(cs.history.length,historyIndex+(e.key==='ArrowUp'?-1:1)));
      input.value=historyIndex===cs.history.length?draft:cs.history[historyIndex];
      requestAnimationFrame(()=>input.setSelectionRange(input.value.length,input.value.length));
    } else if (e.key==='Tab' && !e.shiftKey) {
      e.preventDefault();completeInput();
    } else if (e.ctrlKey && e.key.toLowerCase()==='l') {e.preventDefault();clearScreen();}
    else if (e.ctrlKey && e.key.toLowerCase()==='c' && !input.value.substring(input.selectionStart,input.selectionEnd)) {e.preventDefault();const entry={command:input.value+'^C',cwd:shell.cwd,stdout:'',stderr:''};cs.entries.push(entry);appendEntry(entry);input.value='';historyIndex=cs.history.length;save();}
    else if (e.key !== 'Control' && e.key !== 'Shift' && e.key !== 'Alt') { if (historyIndex!==cs.history.length) historyIndex=cs.history.length; }
  });
  function completeInput() {
    const input=$('command-input'), value=input.value, cursor=input.selectionStart;
    if (cursor!==value.length || /['"]/.test(value.split(/[|;>]/).at(-1))) {toast(tr('補完は引用符の外・入力末尾で使えます。'));return;}
    const segment=value.split(/[|;>]/).at(-1), trimmed=segment.trimStart();
    const match=value.match(/[^\s|;>]*$/), prefix=match?match[0]:'';
    let candidates;
    if (!/\s/.test(trimmed)) {
      const commands=[...(shell.supportedCommands || globalThis.LogLabShell.supportedCommands || ['pwd','ls','cat','less','grep','awk','sort','uniq','cut','sed','head','tail','wc','cd','find','echo','clear','help']),'history'];
      candidates=[...new Set(commands)].filter(c=>typeof c==='string' && c.startsWith(prefix));
    } else {
      const absolute = prefix.startsWith('/')?prefix:(shell.cwd==='/'?'/':shell.cwd+'/')+prefix;
      const slash=absolute.lastIndexOf('/'), parent=absolute.slice(0,slash)||'/';
      const names = new Set([...Object.keys(shell.files),...(shell.directories instanceof Set?[...shell.directories]:[])]);
      candidates=[...names].filter(p=>p.startsWith(absolute) && p.lastIndexOf('/')===slash).map(p=> {
        const dir=shell.directories instanceof Set?shell.directories.has(p):[...names].some(n=>n.startsWith(p+'/'));
        return (prefix.includes('/')?prefix.slice(0,prefix.lastIndexOf('/')+1):'')+p.slice(parent==='/'?1:parent.length+1)+(dir?'/':'');
      }).sort();
    }
    if (!candidates.length) {toast(tr('補完候補はありません。'));return;}
    let common=candidates[0];for (const c of candidates) while (!c.startsWith(common)) common=common.slice(0,-1);
    if (common.length>prefix.length) input.value=value.slice(0,value.length-prefix.length)+common+(candidates.length===1&&!common.endsWith('/')?' ':'');
    else toast(candidates.slice(0,12).join('  ')+(candidates.length>12?' …':''));
  }
  function clearScreen() {cs.entries=[];$('terminal-output').replaceChildren();save();$('command-input').focus();}
  $('terminal-clear').addEventListener('click',clearScreen);
  ['tasks','commands','notes'].forEach(name=> {
    $(`tab-${name}`).addEventListener('click',()=>setTab(name));
    $(`tab-${name}`).addEventListener('keydown',e=> {if (['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const tabs=['tasks','commands','notes'];const i=e.key==='Home'?0:e.key==='End'?2:(tabs.indexOf(name)+(e.key==='ArrowRight'?1:2))%3;setTab(tabs[i]);$(`tab-${tabs[i]}`).focus();}});
  });
  $('notes').addEventListener('input',e=> {cs.notes=e.target.value;save();});
  document.querySelectorAll('[data-command]').forEach(b=>b.addEventListener('click',()=>insertCommand(b.dataset.command)));
  document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>$(b.dataset.close).close()));
  $('guide-open').addEventListener('click',()=>$('guide-dialog').showModal());
  $('apply-attack').addEventListener('click',applyAttack);
  $('case-reset').addEventListener('click',()=>$('reset-dialog').showModal());
  $('reset-confirm').addEventListener('click',()=> {state.cases[state.caseId]=makeCaseState();$('reset-dialog').close();selectCase(state.caseId);toast(tr('選択中の演習をサラの正常状態に戻しました。'));});
  function doomPhase(phase){
    $('doom-dialog').dataset.phase=phase;
    $('app-shell').classList.toggle('doom-collapsing',phase==='collapse');
  }
  function rebuildDoomedCase(){
    if(doomRebuilt)return;
    doomRebuilt=true;
    selectCase(doomCaseId);setTab('tasks');save(true);
  }
  function finishRootGameOver(){
    if(!doomActive)return;
    clearTimeout(doomTimer);
    rebuildDoomedCase();
    $('doom-dialog').close();$('doom-dialog').removeAttribute('data-phase');
    document.body.classList.remove('doom-active');
    $('app-shell').classList.remove('doom-collapsing');$('app-shell').inert=false;
    doomActive=false;$('command-input').focus({preventScroll:true});
  }
  function rootBlackout(){
    doomPhase('blackout');
    $('doom-status').textContent=tr(tr('選択中のケースを初期状態に戻しています。'));
    doomTimer=setTimeout(()=>{
      rebuildDoomedCase();doomPhase('recovery');
      doomTimer=setTimeout(finishRootGameOver,doomReduced?250:700);
    },doomReduced?400:1000);
  }
  function rootGameOverTitle(){
    doomPhase('gameover');$('doom-status').textContent=tr(tr('GAME OVER。まもなく選択中のケースを初期状態に戻します。'));
    doomTimer=setTimeout(rootBlackout,doomReduced?1500:2200);
  }
  function startRootGameOver(){
    if(doomActive)return;
    doomActive=true;doomRebuilt=false;doomCaseId=state.caseId;
    doomReduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    clearTimeout(toastTimer);$('toast').hidden=true;$('command-input').value='';
    const paths=Object.keys(shell.files).filter(p=>!p.startsWith('/baseline/')).sort().slice(0,18);
    $('doom-stream').textContent=tr([...paths.map(p=>'[ UNLINK ] '+p),'[ FAILED ] /var/log: no signal','[ FAILED ] /home/analyst: no signal','[ FAILED ] filesystem journal offline','[ FATAL  ] root filesystem lost','[ FATAL  ] terminal connection closed'].join('\n'));
    // Commit the reset before the scene: closing/reloading midway also restarts cleanly.
    state.cases[doomCaseId]=makeCaseState();save(true);
    const dialog=$('doom-dialog');dialog.classList.toggle('reduced-motion',doomReduced);
    $('doom-status').textContent=tr(tr('演出後、選択中のケースを初期状態に戻します。Escで演出をスキップできます。'));
    document.body.classList.add('doom-active');$('app-shell').inert=true;
    if(doomReduced)rootGameOverTitle();else{doomPhase('collapse');doomTimer=setTimeout(rootGameOverTitle,1800);}
    dialog.showModal();
  }
  $('doom-skip').addEventListener('click',finishRootGameOver);
  $('doom-dialog').addEventListener('cancel',e=>{e.preventDefault();finishRootGameOver();});
  $('export-report').addEventListener('click',()=> {
    const progress=currentCase.tasks.map((t,i)=>tr`${i+1}. ${t.label}\n解答：${cs.answers[t.id] || tr('未入力')}\n判定：${cs.solved.includes(t.id)?tr('正解'):tr('未正解')}`).join('\n\n');
    const text=tr`Logroom 調査メモ\n${currentCase.title}\n状態：${cs.attackApplied?tr('攻撃後ログ'):tr('正常ログ')}\nログ時刻：UTC / データは架空\n書き出し：${new Date().toLocaleString(state.locale)}\n\n調査メモ\n${cs.notes || tr('（メモはまだありません）')}\n\n設問への解答\n${progress}\n\nコマンド履歴\n${cs.history.join('\n')}\n`;
    const blob=new Blob([text],{type:'text/plain;charset=utf-8'}), url=URL.createObjectURL(blob), a=node('a');
    a.href=url;a.download=`logroom-${currentCase.id}-notes.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast(tr('調査メモを書き出しました。'));
  });
  let pagerText='', pagerQuery='', pagerIndex=-1, pagerMatches=[];
  function openPager(text,title) {
    pagerText=text;pagerQuery='';pagerIndex=-1;$('pager-title').textContent=tr(title);$('pager-search').value='';drawPager();$('pager-dialog').showModal();$('pager-content').focus();
  }
  function drawPager() {
    const target=$('pager-content');target.replaceChildren();pagerMatches=[];
    const lines=pagerText.endsWith('\n')?pagerText.slice(0,-1).split('\n'):pagerText.split('\n');
    lines.forEach((line,i)=> {
      const row=node('span','pager-line');row.append(node('span','pager-line-num',String(i+1)));
      if (!pagerQuery) row.append(document.createTextNode(line));
      else {let start=0,found;const lower=line.toLowerCase(),q=pagerQuery.toLowerCase();while ((found=lower.indexOf(q,start))!==-1){row.append(document.createTextNode(line.slice(start,found)));const mark=node('mark','',line.slice(found,found+q.length));pagerMatches.push(mark);row.append(mark);start=found+q.length;}row.append(document.createTextNode(line.slice(start)));}target.append(row);
    });
    $('pager-match').textContent=tr(pagerQuery?tr`${pagerMatches.length}件`:'');
  }
  function pagerNext(back=false) {
    if (!pagerMatches.length) return;
    pagerMatches.forEach(n=>n.classList.remove('current'));pagerIndex=(pagerIndex+(back?-1:1)+pagerMatches.length)%pagerMatches.length;
    const match=pagerMatches[pagerIndex];match.classList.add('current');match.scrollIntoView({block:'center',inline:'nearest'});$('pager-match').textContent=tr(tr`${pagerIndex+1} / ${pagerMatches.length}件`);
  }
  $('pager-search-form').addEventListener('submit',e=> {e.preventDefault();pagerQuery=$('pager-search').value;pagerIndex=-1;drawPager();pagerNext();$('pager-content').focus();});
  $('pager-next').addEventListener('click',()=>pagerNext());
  $('pager-dialog').addEventListener('keydown',e=> {
    if (e.target.tagName==='INPUT') return;
    if (e.key==='q') {e.preventDefault();$('pager-dialog').close();}
    else if (e.key==='/') {e.preventDefault();$('pager-search').focus();}
    else if (e.key==='n' || e.key==='N') {e.preventDefault();pagerNext(e.key==='N' || e.shiftKey);}
    else if (e.key===' ' || e.key==='PageDown' || e.key==='PageUp') {e.preventDefault();$('pager-content').scrollTop+=(e.key==='PageUp'?-1:1)*$('pager-content').clientHeight*.85;}
  });
  $('pager-dialog').addEventListener('close',()=>$('command-input').focus());
  let viSession=null, viPrompt=':', viComposing=false;
  function openVi(editor){
    viSession=new globalThis.LogLabVi(editor);
    $('vi-help').open=false;$('vi-command').value='';
    $('vi-dialog').showModal();renderVi();
  }
  function closeVi(){viSession=null;$('vi-dialog').close();}
  function renderVi(focus=true,skipSelection=false){
    if(!viSession)return;
    const v=viSession,area=$('vi-buffer');
    if(area.value!==v.text)area.value=v.text;
    area.readOnly=v.mode!=='insert'||v.readonly;
    $('vi-path').textContent=tr(v.path+(v.dirty?' [+]':'')+(v.readonly?tr(' [読み取り専用]'):''));
    $('vi-mode').textContent=tr(v.mode==='insert'?'INSERT':v.mode==='command'?'COMMAND':v.mode==='search'?'SEARCH':'NORMAL');
    $('vi-mode').classList.toggle('insert',v.mode==='insert');
    $('vi-message').textContent=v.message+(v.pending?'  '+(v.count||'')+v.pending:v.count?'  '+v.count:'');
    $('vi-message').classList.toggle('vi-error',v.error);
    $('vi-position').textContent=tr(tr`${v.row+1}行 ${v.col+1}列`);
    $('vi-lines').hidden=!v.lineNumbers;
    $('vi-lines').textContent=tr(v.text.split('\n').map((_,i)=>String(i+1)).join('\n'));
    const ex=v.mode==='command'||v.mode==='search';$('vi-command-form').hidden=!ex;
    if(ex){$('vi-command-prompt').textContent=tr(viPrompt);if(focus)$('vi-command').focus();}
    else {
      if(focus)area.focus();
      if(!skipSelection){area.setSelectionRange(v.pos,v.mode==='normal'&&v.pos<v.text.length?v.pos+1:v.pos);if(focus){const lh=parseFloat(getComputedStyle(area).lineHeight),y=v.row*lh;if(y<area.scrollTop)area.scrollTop=y;else if(y+lh>area.scrollTop+area.clientHeight)area.scrollTop=y+lh-area.clientHeight;}}
    }
    $('vi-lines').scrollTop=area.scrollTop;
  }
  function viPath(raw){let p=String(raw||'').trim();if((p.startsWith('"')&&p.endsWith('"'))||(p.startsWith("'")&&p.endsWith("'")))p=p.slice(1,-1);if(!p)throw Error(tr('ファイル名を指定してください'));return shell.resolve(p);}
  function writeVi(rawPath,force=false,rename=false){
    const v=viSession,target=rawPath?viPath(rawPath):v.path;
    if(v.readonly&&!force)throw Error(tr('E45: 読み取り専用です。書き込む場合は :w! を使ってください'));
    if(target!==v.path&&shell.isFile(target)&&!force)throw Error(tr('E13: ファイルが存在します。上書きする場合は ! を付けてください'));
    if(v.text&&!v.text.endsWith('\n'))v.text+='\n';
    shell.write(target,v.text,false);
    if(rename)v.path=target;
    if(target===v.path)v.markSaved();else v.status('"'+target+tr('" にコピーを保存しました。現在のファイル名は ')+v.path+tr(' です'));
    persistFiles();save(true);return true;
  }
  function handleViAction(result){
    if(!result||typeof result!=='object')return;
    if(result.prompt){viPrompt=result.prompt;$('vi-command').value='';return;}
    if(result.help){$('vi-help').open=true;viSession.status(tr('対応操作を下に表示しました'));return;}
    if(result.close){closeVi();return;}
    if(!result.action)return;
    const v=viSession;
    try{
      const op=result.action;
      if(['w','write','wq','saveas'].includes(op)){writeVi(result.path,result.force,op==='saveas');if(op==='wq')closeVi();}
      else if(['x','exit'].includes(op)){if(v.dirty||result.path)writeVi(result.path,result.force);closeVi();}
      else if(['e','edit'].includes(op)){
        if(v.dirty&&!result.force)throw Error(tr('E37: 未保存の変更があります。破棄して開き直すには :e!'));
        const target=result.path?viPath(result.path):v.path;if(shell.isDir(target))throw Error(tr('ディレクトリは編集できません'));
        const parent=target.slice(0,target.lastIndexOf('/'))||'/';if(!shell.isDir(parent))throw Error(tr('親ディレクトリがありません'));
        const text=shell.isFile(target)?shell.read(target):'';
        viSession=new globalThis.LogLabVi({path:target,text,readonly:v.readonly});viSession.lineNumbers=v.lineNumbers;viSession.ignorecase=v.ignorecase;
      } else if(['r','read'].includes(op)){
        if(v.readonly)throw Error(tr('E45: 読み取り専用です'));let text=shell.read(viPath(result.path),'vi');if(text&&!text.endsWith('\n'))text+='\n';
        const end=v.lineEnd(),at=Math.min(v.text.length,end+1);v.remember();const prefix=at===v.text.length&&v.text&&!v.text.endsWith('\n')?'\n':'';
        v.text=v.text.slice(0,at)+prefix+text+v.text.slice(at);v.pos=at+prefix.length;v.clamp();v.status(tr('ファイルを読み込みました。保存は :w'));
      } else if(op==='file'){v.path=viPath(result.path);v.status(tr('ファイル名を変更しました。保存は :w'));}
    }catch(error){v.status(error.message||tr('ファイルを処理できませんでした'),true);}
  }
  function viEx(command){handleViAction(viSession.ex(command));renderVi();}
  $('vi-buffer').addEventListener('keydown',e=>{
    if(!viSession||e.isComposing||viComposing)return;
    if(e.metaKey)return;
    if(viSession.mode==='insert'){
      if(e.key==='Escape'||e.ctrlKey&&e.key==='['){e.preventDefault();viSession.normal();renderVi();}
      else if(e.key==='Tab'){e.preventDefault();const a=e.target;a.setRangeText('\t',a.selectionStart,a.selectionEnd,'end');viSession.input(a.value,a.selectionStart);renderVi(false);}
      return;
    }
    if(e.ctrlKey&&e.key.toLowerCase()==='c')return;
    const result=viSession.key(e.key,{ctrl:e.ctrlKey});if(result!==false){e.preventDefault();handleViAction(result);}if(result!==false||!e.ctrlKey)renderVi();
  });
  $('vi-buffer').addEventListener('input',e=>{if(!viSession)return;viSession.input(e.target.value,e.target.selectionStart);renderVi(false,e.isComposing||viComposing);});
  $('vi-buffer').addEventListener('compositionstart',()=>{viComposing=true;});
  $('vi-buffer').addEventListener('compositionend',e=>{viComposing=false;if(viSession){viSession.input(e.target.value,e.target.selectionStart);renderVi(false);}});
  $('vi-buffer').addEventListener('click',e=>{if(viSession&&viSession.mode==='normal'){viSession.pos=e.target.selectionStart;viSession.clamp();renderVi(false);}});
  $('vi-buffer').addEventListener('scroll',()=>{$('vi-lines').scrollTop=$('vi-buffer').scrollTop;});
  $('vi-command-form').addEventListener('submit',e=>{
    e.preventDefault();if(!viSession)return;const value=$('vi-command').value;
    if(viPrompt===':')viEx(value);else{viSession.mode='normal';viSession.search(value||viSession.lastSearch,viPrompt==='?');renderVi();}
  });
  $('vi-command').addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();viSession.normal();renderVi();}});
  $('vi-save-close').addEventListener('click',()=>viEx('wq'));
  $('vi-close').addEventListener('click',()=>viEx('q'));
  $('vi-dialog').addEventListener('cancel',e=>{e.preventDefault();if(viSession){viSession.normal();renderVi();}});
  $('vi-dialog').addEventListener('close',()=>{if(!$('vi-dialog').open)$('command-input').focus();});
  function applyLayout(){
    const ui=state.ui,main=$('main');
    main.classList.toggle('panel-hidden',ui.panelHidden);$('learning-panel').hidden=ui.panelHidden;
    main.style.setProperty('--terminal-ratio',ui.width/100);
    $('panel-toggle').textContent=tr(ui.panelHidden?tr('演習パネルを表示'):tr('演習パネルを隠す'));
    $('panel-toggle').setAttribute('aria-expanded',String(!ui.panelHidden));
    $('terminal-width').value=ui.width;$('terminal-width').disabled=trainActive||ui.panelHidden;
    $('width-label').textContent=tr(ui.panelHidden?'100%':ui.width+'%');
    $('terminal-height').value=ui.height||360;$('height-label').textContent=tr(ui.height?ui.height+'px':tr('自動'));
    requestAnimationFrame(()=>{const output=$('terminal-output'),form=$('terminal-form');const available=innerHeight-(output.getBoundingClientRect().top+scrollY)-form.offsetHeight-65;output.style.height=(ui.height||Math.max(140,Math.min(460,available)))+'px';});
  }
  $('panel-toggle').addEventListener('click',()=>{state.ui.panelHidden=!state.ui.panelHidden;applyLayout();save();});
  $('terminal-width').addEventListener('input',e=>{state.ui.width=Number(e.target.value);applyLayout();save();});
  $('terminal-height').addEventListener('input',e=>{state.ui.height=Number(e.target.value);applyLayout();save();});
  $('layout-reset').addEventListener('click',()=>{state.ui={panelHidden:false,width:62,height:null};applyLayout();save();});
  let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(applyLayout,70);});
  const commandDescriptions={help:'使い方',pwd:'現在のディレクトリ',cd:'ディレクトリ移動',ls:'ファイル一覧',find:'ファイル検索',cat:'ファイル表示',tac:'行を逆順に表示',less:'ページ表示・検索',more:'ページ表示',head:'先頭の行・バイト',tail:'末尾の行・バイト',nl:'行番号を付ける',grep:'行を検索・抽出',rg:'複数ファイルの検索',awk:'列の抽出・条件・集計',sed:'行や文字の編集',cut:'列の抽出',sort:'並べ替え',uniq:'重複の比較・件数',wc:'行数・文字数・幅',tr:'文字の変換・削除',column:'表の列を整える',diff:'ファイルの差分',jq:'JSONの抽出・集計',base64:'Base64の符号化・復号',tee:'表示しながら保存',echo:'文字列を出力',printf:'書式を指定して出力',paste:'ファイルの列を結合',comm:'整列済みファイルの比較',join:'キーでファイルを結合',xargs:'入力を仮想コマンドの引数にする',rev:'各行の文字を逆順にする',strings:'表示可能な文字列を抽出',basename:'パスからファイル名を取り出す',dirname:'親のパスを取り出す',realpath:'絶対パスに直す',file:'仮想ファイルの種類',stat:'サイズなどの仮想情報',du:'ファイルの使用量を集計',date:'日時の表示・変換',clear:'画面を消去',history:'コマンド履歴',mkdir:'ディレクトリ作成',touch:'空ファイル作成',cp:'ファイルのコピー',mv:'移動・名前の変更',rm:'仮想ファイル削除',rmdir:'空ディレクトリ削除',vi:'仮想ファイルの編集',view:'viで読み取り専用表示',sl:'蒸気機関車が通過（中断不可）'};
  const optionNotes={
    grep:[['-i / -v','大文字小文字を無視 / 非一致の行'],['-n / -c / -l / -L','行番号 / 件数 / 一致ファイル / 非一致ファイル'],['-E / -F','拡張正規表現 / 固定文字列'],['-r / -R','仮想ディレクトリの再帰検索'],['-A N / -B N / -C N','一致行の後 / 前 / 前後も表示'],['-m N / -e PATTERN','一致をN行まで / パターンを指定'],['--include / --exclude / --exclude-dir','検索対象・除外するファイルやディレクトリのパターン']],
    sort:[['-n / -r','数値順 / 逆順'],['-u / -s / -c','同じキーをまとめる / 同値の順序維持 / 整列済みか確認'],['-f / -b','大文字小文字を無視 / 先頭空白を無視'],['-k N,M / -t CHAR','並べ替える列の範囲 / 区切り文字']],
    uniq:[['-c / -d / -u','件数 / 重複した行 / 1回だけの行'],['-i / -f N / -s N','大小文字を無視 / 先頭N列を無視 / 先頭N文字を無視']],
    head:[['-n N / -c N','先頭N行 / 先頭Nバイト']],tail:[['-n N / -c N','末尾N行 / 末尾Nバイト'],['-n +N / -c +N','N行目 / Nバイト目から表示']],
    wc:[['-l / -w / -c / -m / -L','改行数 / 単語数 / バイト数 / 文字数 / 最長行幅']],
    cut:[['-f LIST / -c LIST','列 / 文字位置を指定'],['-d CHAR / -s','区切り文字 / 区切りのない行を除外'],['--complement / --output-delimiter TEXT','選択を反転 / 出力区切り']],
    awk:[['-F REGEX','入力の列区切り'],['-v NAME=VALUE','変数の初期値'],['BEGIN {FS="..."; OFS="..."}','入力・出力区切りの初期設定']],
    sed:[['-n / -E','自動表示を止める / 拡張正規表現'],['-e SCRIPT','編集処理を指定（複数可）'],['-i[SUFFIX]','仮想ファイルを直接更新（任意のバックアップ接尾辞）'],['Np / N,Mp / /PATTERN/p / d','行を表示 / 範囲を表示 / 検索して表示 / 削除']],
    find:[['-type f / -type d','ファイル / ディレクトリ'],['-name / -iname / -path','名前 / 大小文字を無視した名前 / パス'],['-maxdepth N / -mindepth N','検索の最大 / 最小の深さ']],
    ls:[['-a / -l / -h','隠しファイル / 詳細 / 読みやすいサイズ'],['-d / -R / -S / -r','ディレクトリ自身 / 再帰 / サイズ順 / 逆順']],
    jq:[['-r / -c / -s','文字列をそのまま / 1行に圧縮 / 全入力を配列にする']],
    vi:[['i / Esc','挿入 / 通常モード'],[':w / :wq / :q!','保存 / 保存して閉じる / 保存せず閉じる'],['/ / n / u / Ctrl+R','検索 / 次の一致 / 取り消し / やり直し']],
    view:[['ファイル名','存在する仮想ファイルを読み取り専用で開く']],
    rm:[['-f','仮想ファイルを削除（存在しなくてもエラーにしない）'],['rm -rf /','GAME OVER演出後、選択中のケースを初期化。解答・メモ・履歴・作成ファイルも消去します。他のケースと画面設定は保持します。']],
    sl:[['引数・オプションなし','約5秒間、機関車が通過します。Ctrl+Cでは止まらず、終了まで待ちます。進捗は保持します。']],
    xargs:[['-n N / -I TOKEN','実行ごとの引数数 / 置換用の印'],['-0 / -d CHAR / -r','NUL区切り / 指定文字区切り / 入力なしなら実行しない']],
  };
  let selectedCommand='grep';
  function commandDetail(name){
    selectedCommand=name;const help=shell.getHelp(name),lines=help.trimEnd().split('\n');
    $('command-detail-title').textContent=tr(name);$('command-detail-description').textContent=tr(commandDescriptions[name]||'');
    $('command-detail-usage').textContent=tr(lines.shift());$('command-detail-notes').textContent=tr(lines.join('\n').trim());
    $('command-detail-title').parentElement.scrollTop=0;
    const box=$('command-detail-options');box.replaceChildren();
    if(optionNotes[name]){const table=node('table','help-options');for(const [flags,meaning]of optionNotes[name]){const row=node('tr');row.append(node('th','',tr(flags)),node('td','',tr(meaning)));table.append(row);}box.append(table);}
    const manuals={grep:'https://www.gnu.org/software/grep/manual/html_node/Invoking.html',sed:'https://www.gnu.org/software/sed/manual/sed.html',awk:'https://www.gnu.org/software/gawk/manual/html_node/Command-Line.html',jq:'https://jqlang.org/manual/',vi:'https://vimhelp.org/usr_toc.txt.html',view:'https://vimhelp.org/usr_toc.txt.html'};
    const coreutils='basename dirname realpath date echo printf head tail cat tac nl wc cut tr sort uniq comm join paste tee ls cp mv rm mkdir rmdir touch pwd du stat base64'.split(' ');
    const manual=manuals[name]||(coreutils.includes(name)?'https://www.gnu.org/software/coreutils/manual/':null),manualBox=$('command-manual');manualBox.replaceChildren();
    if(manual){const link=node('a','reference-link',tr('本来のツールの公式マニュアルを開く'));link.href=manual;link.target='_blank';link.rel='noopener noreferrer';manualBox.append(link,node('p','muted',tr('外部サイトを別タブで開きます。外部マニュアルは本来のツールの全機能を含みます。演習で使える範囲は上の一覧で確認してください。')));}
    [...$('commands-list').querySelectorAll('button')].forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.commandName===name)));
  }
  function commandList(){
    const filter=$('command-filter').value.trim().toLowerCase(),commands=shell.supportedCommands.filter(c=>(c+' '+tr(commandDescriptions[c]||'')).toLowerCase().includes(filter)),list=$('commands-list');list.replaceChildren();
    commands.forEach(c=>{const b=node('button','command-list-item');b.type='button';b.dataset.commandName=c;b.setAttribute('aria-pressed',String(c===selectedCommand));b.append(node('code','',c),node('span','',tr(commandDescriptions[c]||'')));b.addEventListener('click',()=>commandDetail(c));list.append(b);});
    if(!commands.length)list.append(node('p','muted',tr('一致するコマンドがありません。')));
    $('commands-total').textContent=tr(tr`${shell.supportedCommands.length}コマンドに対応 · 選ぶと対応オプションが表示されます。`);
  }
  $('commands-open').addEventListener('click',()=>{commandList();commandDetail(selectedCommand);$('commands-dialog').showModal();});
  $('case-select').addEventListener('change',e=>selectCase(e.target.value));
  $('command-filter').addEventListener('input',commandList);
  $('command-help-terminal').addEventListener('click',()=>{$('commands-dialog').close();insertCommand('help '+selectedCommand);});
  function renderContext(){
    const c=currentCase.context||{},target=$('context-content');target.replaceChildren();
    target.append(node('p','context-case-name',currentCase.title),node('p','muted',tr('ここに示すのは合成ログのための演習設定です。実際のOSやサーバーは起動していません。')));
    const section=(title,body)=>{const s=node('section','context-section');s.append(node('h3','',title));if(Array.isArray(body)){const ul=node('ul');body.forEach(t=>ul.append(node('li','',t)));s.append(ul);}else s.append(node('p','',body||tr('この項目は調査対象外です。')));target.append(s);return s;};
    section(tr('与えられた状況'),c.situation||currentCase.summary);section(tr('調査の目的'),c.objective||tr('ログの根拠を使って、起きた操作と結果を整理します。'));
    const hosts=section(tr('サーバー・端末の構成'),'');hosts.lastElementChild.remove();
    const table=node('table','context-table'),head=node('tr');[tr('ホスト'),tr('役割'),tr('アドレス'),tr('サービス')].forEach(t=>head.append(node('th','',t)));table.append(head);
    (c.hosts||[]).forEach(h=>{const row=node('tr');[h.name,h.role,h.address,Array.isArray(h.services)?h.services.join(state.locale==='ja'?'、':', '):h.services].forEach(t=>row.append(node('td','',t||tr('記載なし'))));table.append(row);});hosts.append(table);
    section(tr('ネットワークとログ収集'),c.network||tr('ログは演習用の仮想ファイルに収集されています。'));section(tr('時間と調査範囲'),c.period||tr('ログの時刻はUTCです。'));
    if(c.normalBehavior?.length)section(tr('正常時の振る舞い'),c.normalBehavior);
    const logs=section(tr('利用できるログ'),'');logs.lastElementChild.remove();
    (c.logSources||Object.keys(currentCase.files).filter(p=>p.startsWith('/var/log/')).map(path=>({path,description:tr('調査対象ログ')}))).forEach(l=>{const p=node('p');p.append(node('code','',l.path),node('span','',': '+l.description));logs.append(p);});
    if(c.assumptions?.length)section(tr('前提・ログから分かる範囲'),c.assumptions);
    section(tr('操作の流れ'),tr('正常ログを確認 → 攻撃ログを生成 → 検索・集計・複数ログの照合 → 設問へ解答。/baseline以下には正常ログのコピーがあり、「サラの状態に戻す」でやり直せます。'));
  }
  $('context-open').addEventListener('click',()=>{renderContext();$('context-dialog').showModal();});
  $('debrief-open').addEventListener('click',()=>{
    if(!cs.attackApplied||!currentCase.tasks.every(t=>cs.solved.includes(t.id)&&isCorrect(t,cs.answers[t.id]||'')))return;
    const d=currentCase.debrief||{},target=$('debrief-content');target.replaceChildren();
    target.append(node('p','context-case-name',d.title||currentCase.title),node('p','debrief-summary',d.summary||currentCase.summary));
    const section=(title,value)=>{const s=node('section','context-section');s.append(node('h3','',title));if(Array.isArray(value)){const ul=node('ul');value.forEach(v=>ul.append(node('li','',v)));s.append(ul);}else s.append(node('p','',value||tr('提供されたログの根拠に基づいて判断します。')));target.append(s);};
    const sourceLink=(title,url)=>{const a=node('a','reference-link',title);try{const parsed=new URL(url);if(parsed.protocol!=='https:')return node('span','',title);a.href=parsed.href;a.target='_blank';a.rel='noopener noreferrer';}catch(_){return node('span','',title);}return a;};
    if(d.knowledge?.length){const s=node('section','context-section knowledge-section');s.append(node('h3','',tr('問題を解くための技術知識')));d.knowledge.forEach(k=>{const part=node('div','knowledge-item');part.append(node('h4','',k.title),node('p','',k.detail));s.append(part);});target.append(s);}
    const stages=node('section','context-section');stages.append(node('h3','',tr('攻撃と観測の流れ')));const ol=node('ol','debrief-stages');(d.stages||[]).forEach(stage=>{const li=node('li');li.append(node('strong','',stage.title),node('p','',stage.detail));ol.append(li);});stages.append(ol);target.append(stages);
    section(tr('原因・成立した条件'),d.cause);section(tr('ログで確認できた影響'),d.impact);section(tr('このログだけでは分からないこと'),d.limits||[]);section(tr('対策と追加確認'),d.remediation||[]);section(tr('今回の分析で身に付けるポイント'),d.lessons||[]);
    if(d.history?.length){const s=node('section','context-section history-section');s.append(node('h3','',tr('関連する実際の事案・脆弱性')));d.history.forEach(h=>{const item=node('article','history-item');item.append(node('h4','',`${h.title}${h.year?'（'+h.year+'）':''}`),node('p','',h.detail));if(h.relation)item.append(node('p','history-relation',tr('演習との関係：')+h.relation));item.append(sourceLink(h.sourceTitle||tr('一次資料を開く'),h.url));s.append(item);});target.append(s);}
    if(d.references?.length){const s=node('section','context-section references-section');s.append(node('h3','',tr('参考になる公開ドキュメント')));const ul=node('ul','reference-list');d.references.forEach(r=>{const li=node('li');li.append(sourceLink(r.title,r.url));if(r.description)li.append(node('p','',r.description));ul.append(li);});s.append(ul,node('p','muted',tr('参照リンクは別タブで開きます。閲覧にはインターネット接続と、利用環境での接続許可が必要です。演習自体は引き続きブラウザ内だけで動きます。')));target.append(s);}
    $('debrief-dialog').showModal();$('debrief-dialog').scrollTop=0;
  });
  $('language-select').addEventListener('change',event=>{
    const value=event.target.value;
    if(doomActive||trainActive){event.target.value=state.locale;return;}
    if(!i18n.languages.includes(value)||value===state.locale)return;
    clearTimeout(toastTimer);$('toast').hidden=true;
    const input=$('command-input'),pending=input.value,start=input.selectionStart,end=input.selectionEnd;
    persistFiles();state.locale=value;i18n.setLocale(value);
    cases=i18n.localizeCases(baseCases);i18n.applyStatic(document);
    selectCase(state.caseId);setTab(activeTab);
    input.value=pending;input.setSelectionRange(start,end);save(true);
  });
  window.addEventListener('pagehide',()=>save(true));
  selectCase(state.caseId);setTab(activeTab);
  $('save-status').textContent=tr(storageAvailable?tr('このブラウザに保存'):tr('保存はこのタブ内のみ'));
})();
