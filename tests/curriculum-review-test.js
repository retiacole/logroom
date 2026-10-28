'use strict';
const assert=require('node:assert/strict');
for(const source of ['cases','cases-extra','case-context','case-reading-a','case-reading-b','locales/ui','locales/cases-a','locales/cases-b','locales/cases-c','i18n','curriculum'])require('../src/'+source+'.js');
const originals=LOG_LAB_CASES.filter(c=>!c.entry);
const positions=originals.map(c=>c.conceptCheck.options.findIndex(option=>option.value===c.conceptCheck.answer));
assert.equal(positions.filter(index=>index===0).length,5,'five correct answers appear first');
assert.equal(positions.filter(index=>index===1).length,5,'five correct answers appear second');
assert.deepEqual(positions,[0,1,1,0,1,1,0,0,1,0],'stable order by case preserves display between sessions');
for(const language of ['ja','en','th']){
  const cases=LogroomI18n.localizeCases(LOG_LAB_CASES,language);
  const entry=cases.find(c=>c.entry);
  assert(entry.context.network.includes('entry-01'));
  assert(entry.context.network.includes('/var/log/entry.log'));
  assert(entry.context.network.includes('SSH'));
  assert(!entry.context.network.includes('invalid user'),'network explains collection rather than column extraction');
  assert.notEqual(entry.context.network,entry.briefing[1]);
  for(const c of cases.filter(c=>!c.entry)){
    const original=originals.find(base=>base.id===c.id),check=c.conceptCheck;
    assert.equal(check.answer,'supported','keep stored answer values compatible');
    assert.deepEqual(check.options.map(option=>option.value),original.conceptCheck.options.map(option=>option.value),'translation keeps option identity and order');
    for(let i=0;i<check.options.length;i++){
      const canonicalLabel=original.conceptCheck.options[i].label;
      assert.equal(check.options[i].label,language==='ja'?canonicalLabel:LOGROOM_UI_TRANSLATIONS[language][canonicalLabel],'each translated option retains its intended meaning');
    }
    const mentionsJsonl=c.preparation.some(note=>note.includes('JSONL'));
    assert(!mentionsJsonl||c.logPaths.some(path=>path.endsWith('.jsonl')),'JSONL counting advice requires a provided JSONL view');
    if(['ssh','egress'].includes(c.id)){
      assert(!mentionsJsonl,'no JSONL-specific advice for '+c.id);
      assert(c.preparation.at(-1).length>20,'general counting advice is retained');
    }
    if(['sqli','cmdinj','pathtraversal','webauth','upload','tamper'].includes(c.id))assert(mentionsJsonl,'paired audit views retain deduplication advice');
  }
}
console.log('Curriculum review: balanced stable answer positions, translated option meanings, entry collection context, and source-aware counting notes verified.');
