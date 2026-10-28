'use strict';
const {chromium,launchOptions}=require('./helpers.js');
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const url=pathToFileURL(path.resolve(__dirname,'../../index.html')).href;
const key='logroom.offline.v1';
(async()=>{
  const browser=await chromium.launch(launchOptions);
  try{
    for(const [browserLanguage,expected,saved,blocked]of [
      ['ja-JP','ja'],['th-TH','th'],['en-US','en'],['fr-FR','en'],
      ['en-US','ja','ja'],['ja-JP','th','th'],['th-TH','en','en'],
      ['th-TH','th','invalid'],['th-TH','th',undefined,true],
    ]){
      const context=await browser.newContext({locale:browserLanguage});
      try{
        const page=await context.newPage();const errors=[];
        page.on('pageerror',error=>errors.push(error.message));
        await page.addInitScript(({saved,blocked,key})=>{
          if(saved!==undefined&&!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({version:1,caseId:'ssh',cases:{ssh:{notes:'Keep this investigation note'}},locale:saved}));
          if(blocked)Object.defineProperty(window,'localStorage',{get(){throw new DOMException('blocked','SecurityError');}});
        },{saved,blocked,key});
        await page.goto(url);
        assert.equal(await page.locator('html').getAttribute('lang'),expected);
        assert.equal(await page.locator('#language-select').inputValue(),expected);
        assert.equal(await page.evaluate(()=>LogroomI18n.locale),expected);
        if(saved!==undefined)assert.equal(await page.locator('#notes').inputValue(),'Keep this investigation note');
        await page.locator('#language-select').selectOption('ja');
        assert.equal(await page.locator('html').getAttribute('lang'),'ja');
        if(!blocked){await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));await page.reload();assert.equal(await page.locator('html').getAttribute('lang'),'ja');}
        assert.deepEqual(errors,[]);
      }finally{await context.close();}
    }
    console.log('Browser defaults: ja/th/other, stored choices, invalid choice, denied storage and reload passed.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
