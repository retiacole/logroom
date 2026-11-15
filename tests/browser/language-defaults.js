'use strict';
const {chromium,launchOptions}=require('./helpers.js');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const html=fs.readFileSync(path.resolve(__dirname,'../../index.html'));
const key='logroom.offline.v1';
(async()=>{
  // file: localStorage behavior is platform-dependent. Give this persistence
  // matrix a stable origin; i18n.js still exercises the standalone file itself.
  const server=http.createServer((request,response)=>{
    if(request.url!=='/'&&request.url!=='/index.html'){
      response.writeHead(404);response.end();return;
    }
    response.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
    response.end(html);
  });
  await new Promise((resolve,reject)=>{
    server.once('error',reject);
    server.listen(0,'127.0.0.1',resolve);
  });
  const url=`http://127.0.0.1:${server.address().port}/index.html`;
  let browser;
  try{
    browser=await chromium.launch(launchOptions);
    for(const [browserLanguage,expected,saved,blocked]of [
      ['ja-JP','ja'],['th-TH','th'],['en-US','en'],['fr-FR','en'],
      ['en-US','ja','ja'],['ja-JP','th','th'],['th-TH','en','en'],
      ['th-TH','th','invalid'],['th-TH','th',undefined,true],
    ]){
      const context=await browser.newContext({locale:browserLanguage});
      try{
        const page=await context.newPage();const errors=[];
        page.on('pageerror',error=>errors.push(error.message));
        // Seed before the application starts, then remove the bootstrap itself.
        // A reload must exercise only the application's persistence, with no
        // fixture capable of restoring its original language or notes.
        const session=await context.newCDPSession(page);
        await session.send('Page.enable');
        const initialize=({saved,blocked,key})=>{
          if(saved!==undefined)localStorage.setItem(key,JSON.stringify({version:1,caseId:'ssh',cases:{ssh:{notes:'Keep this investigation note'}},locale:saved}));
          if(blocked)Object.defineProperty(window,'localStorage',{get(){throw new DOMException('blocked','SecurityError');}});
        };
        const {identifier}=await session.send('Page.addScriptToEvaluateOnNewDocument',{
          source:`(${initialize})(${JSON.stringify({saved,blocked,key})})`,
        });
        await page.goto(url);
        await session.send('Page.removeScriptToEvaluateOnNewDocument',{identifier});
        await session.detach();
        assert.equal(await page.locator('html').getAttribute('lang'),expected);
        assert.equal(await page.locator('#language-select').inputValue(),expected);
        assert.equal(await page.evaluate(()=>LogroomI18n.locale),expected);
        if(saved!==undefined)assert.equal(await page.locator('#notes').inputValue(),'Keep this investigation note');
        await page.locator('#language-select').selectOption('ja');
        assert.equal(await page.locator('html').getAttribute('lang'),'ja');
        if(!blocked){
          const scenario=JSON.stringify({browserLanguage,expected,saved});
          await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
          const persisted=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
          assert.equal(persisted?.locale,'ja',scenario+' persists the selected language before reload');
          await page.reload();
          const restored=await page.evaluate(key=>({lang:document.documentElement.lang,locale:LogroomI18n.locale,stored:JSON.parse(localStorage.getItem(key))?.locale}),key);
          assert.equal(restored.lang,'ja',scenario+' after reload: '+JSON.stringify(restored));
          assert.equal(restored.locale,'ja',scenario+' restores the application locale');
          assert.equal(restored.stored,'ja',scenario+' retains the persisted preference');
          if(saved!==undefined)assert.equal(await page.locator('#notes').inputValue(),'Keep this investigation note');
        }
        assert.deepEqual(errors,[]);
      }finally{await context.close();}
    }
    console.log('Browser defaults: ja/th/other, stored choices, invalid choice, denied storage and reload passed.');
  }finally{
    try{await browser?.close();}
    finally{await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
