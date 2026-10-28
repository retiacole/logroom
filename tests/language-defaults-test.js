'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../src/i18n.js'),'utf8');
function load(navigator){
  const context=vm.createContext(navigator===undefined?{}:{navigator});
  vm.runInContext(source,context);
  return context.LogroomI18n;
}
const cases=[
  [{languages:['ja-JP'],language:'en-US'},'ja'],
  [{languages:['JA-jp'],language:'en'},'ja'],
  [{languages:['th-TH'],language:'en'},'th'],
  [{languages:['TH-th'],language:'en'},'th'],
  [{languages:['fr-FR','ja','th'],language:'ja'},'en'],
  [{languages:['en-US','th'],language:'th'},'en'],
  [{languages:[null,' ','th-TH'],language:'ja'},'th'],
  [{languages:[],language:'ja-JP'},'ja'],
  [{language:'th-TH'},'th'],
  [{languages:['de'],language:'ja-JP'},'en'],
  [{languages:'ja',language:'th-TH'},'th'],
  [{language:42},'en'],
  [{},'en'],[undefined,'en'],
  [{get languages(){throw Error('denied');},language:'ja'},'ja'],
  [{get languages(){throw Error('denied');},get language(){throw Error('denied');}},'en'],
];
for(const [navigator,expected]of cases){
  const i18n=load(navigator);
  assert.equal(i18n.locale,expected);
  for(const saved of ['ja','en','th'])assert.equal(i18n.setLocale(saved),saved,'a valid saved/manual preference wins');
  for(const invalid of [undefined,null,'',{},'de'])assert.equal(i18n.setLocale(invalid),expected,'invalid or missing stored language uses browser default');
}
console.log('Language defaults: Japanese, Thai, English fallback, priority, stored choices, missing/restricted navigator passed.');
