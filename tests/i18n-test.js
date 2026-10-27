'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');

// Relative imports make this suite work in an extracted release or any checkout.
for (const source of [
  'cases', 'cases-extra', 'case-context', 'case-reading-a', 'case-reading-b'
]) require('../src/' + source + '.js');

for (const source of ['locales/ui', 'locales/cases-a', 'locales/cases-b', 'locales/cases-c', 'i18n']) {
  require('../src/' + source + '.js');
}

require('../src/curriculum.js');
const cases = globalThis.LOG_LAB_CASES;
const japaneseSnapshot = JSON.stringify(cases);
const i18n = globalThis.LogroomI18n;
const caseCatalog = globalThis.LOGROOM_CASE_TRANSLATIONS;
const uiCatalog = globalThis.LOGROOM_UI_TRANSLATIONS;
const japaneseText = /[\u3040-\u30ff\u3400-\u9fff]/u;
const readmePath = '/home/analyst/README.txt';
const protectedKeys = new Set(['id', 'command', 'commands', 'answer', 'accepted', 'evidence', 'url']);
const excludedTrees = new Set(['files', 'baselineFiles', 'logPaths']);
let assertions = 0;
let caseTextCount = 0;
let verifiedLogCopies = 0;

function ok(value, message) { assertions++; assert.ok(value, message); }
function equal(actual, expected, message) { assertions++; assert.equal(actual, expected, message); }
function deepEqual(actual, expected, message) { assertions++; assert.deepEqual(actual, expected, message); }
function hash(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function getPath(value, path) {
  for (const part of path.split('.')) {
    if (!value || !Object.prototype.hasOwnProperty.call(value, part)) return undefined;
    value = value[part];
  }
  return value;
}
function humanJapaneseLeaves(value, prefix = '', result = {}) {
  if (typeof value === 'string') {
    if (japaneseText.test(value)) result[prefix] = value;
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => humanJapaneseLeaves(item, prefix ? prefix + '.' + index : String(index), result));
  } else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (protectedKeys.has(key) || excludedTrees.has(key)) continue;
      humanJapaneseLeaves(item, prefix ? prefix + '.' + key : key, result);
    }
  }
  return result;
}
function requiredTexts(c) {
  const result = humanJapaneseLeaves(c);
  if (japaneseText.test(c.baselineFiles[readmePath] || '')) result['fileTexts.normalReadme'] = c.baselineFiles[readmePath];
  if (japaneseText.test(c.files[readmePath] || '')) result['fileTexts.attackedReadme'] = c.files[readmePath];
  return result;
}
function withoutPreservedCommand(text) {
  // The source README deliberately contains this sample command. Its literal
  // argument and path may remain canonical while surrounding prose is translated.
  return text.replaceAll('grep -n "キーワード" /var/log/対象.log', '');
}
function assertProtectedData(base, localized, location) {
  if (!base || typeof base !== 'object') return;
  if (Array.isArray(base)) {
    equal(localized.length, base.length, location + ': array length');
    base.forEach((item, index) => assertProtectedData(item, localized[index], location + '.' + index));
    return;
  }
  deepEqual(Object.keys(localized).sort(), Object.keys(base).sort(), location + ': property names');
  for (const [key, value] of Object.entries(base)) {
    const path = location + '.' + key;
    if (protectedKeys.has(key) || key === 'logPaths') {
      deepEqual(localized[key], value, path + ': canonical data');
    } else if (key === 'files' || key === 'baselineFiles') {
      deepEqual(Object.keys(localized[key]).sort(), Object.keys(value).sort(), path + ': file paths');
      for (const [file, bytes] of Object.entries(value)) {
        if (file === readmePath) continue;
        equal(localized[key][file], bytes, path + ':' + file + ': exact log bytes');
        equal(hash(localized[key][file]), hash(bytes), path + ':' + file + ': log hash');
        verifiedLogCopies++;
      }
    } else if (value && typeof value === 'object') {
      assertProtectedData(value, localized[key], path);
    } else if (typeof value !== 'string') {
      deepEqual(localized[key], value, path + ': non-text metadata');
    }
  }
}
function objectSet(value, result = new Set()) {
  if (!value || typeof value !== 'object' || result.has(value)) return result;
  result.add(value);
  for (const child of Object.values(value)) objectSet(child, result);
  return result;
}
function assertDisjoint(left, right, message) {
  const objects = objectSet(left);
  for (const object of objectSet(right)) ok(!objects.has(object), message);
}

equal(cases.length, 11, 'all eleven cases are loaded');
equal(cases.reduce((count, c) => count + c.tasks.length, 0), 108, 'all 108 questions are loaded');
equal(new Set(cases.map(c => c.id)).size, cases.length, 'case IDs are unique');
equal(JSON.stringify(cases), japaneseSnapshot, 'loading catalogs must not mutate Japanese source');
deepEqual(i18n.languages, ['ja', 'en', 'th'], 'supported languages');
equal(i18n.locale, 'ja', 'initial locale');
equal(i18n.localizeCases(cases, 'ja'), cases, 'Japanese uses the canonical cases');

const localizedByLanguage = {};
for (const language of ['en', 'th']) {
  const localized = i18n.localizeCases(cases, language);
  localizedByLanguage[language] = localized;
  deepEqual(Object.keys(caseCatalog[language]).sort(), cases.map(c => c.id).sort(), language + ': complete case catalog');
  equal(localized.length, cases.length, language + ': case count');
  equal(localized.reduce((count, c) => count + c.tasks.length, 0), 108, language + ': question count');
  for (let index = 0; index < cases.length; index++) {
    const base = cases[index];
    const actual = localized[index];
    const catalog = caseCatalog[language][base.id];
    const required = requiredTexts(base);
    if (language === 'en') caseTextCount += Object.keys(required).length;
    const missing = Object.keys(required).filter(path => typeof catalog[path] !== 'string' || !catalog[path].trim());
    deepEqual(missing, [], language + ' ' + base.id + ': all Japanese human-facing leaves are covered');
    for (const [path, translation] of Object.entries(catalog)) {
      const label = language + ' ' + base.id + '.' + path;
      equal(typeof translation, 'string', label + ': string value');
      ok(translation.trim(), label + ': nonempty translation');
      ok(!japaneseText.test(withoutPreservedCommand(translation)), label + ': no untranslated Japanese prose');
      ok(!path.split('.').some(part => protectedKeys.has(part) || excludedTrees.has(part)), label + ': no protected field translation');
      if (path.startsWith('fileTexts.')) {
        ok(['fileTexts.normalReadme', 'fileTexts.attackedReadme'].includes(path), label + ': known README variant');
        const fileSet = path === 'fileTexts.normalReadme' ? 'baselineFiles' : 'files';
        equal(actual[fileSet][readmePath], translation, label + ': localized README applied');
      } else {
        equal(typeof getPath(base, path), 'string', label + ': genuine source text path');
        equal(getPath(actual, path), translation, label + ': translation applied');
      }
    }
    for (const path of Object.keys(required)) {
      if (path.startsWith('fileTexts.')) continue;
      ok(!japaneseText.test(withoutPreservedCommand(getPath(actual, path))), language + ' ' + base.id + '.' + path + ': no fallback to Japanese');
    }
    assertProtectedData(base, actual, language + '.' + base.id);
    // Evidence remains a literal line of the unchanged attacked fixture.
    for (const task of actual.tasks) for (const evidence of task.evidence || []) {
      equal(actual.files[evidence.path].split('\n')[evidence.line - 1], evidence.quote, language + '.' + base.id + ': evidence line still matches');
    }
  }
  equal(JSON.stringify(cases), japaneseSnapshot, language + ': localization must not mutate Japanese source');
  assertDisjoint(cases, localized, language + ': locale object must not share mutable references with Japanese data');
}
assertDisjoint(localizedByLanguage.en, localizedByLanguage.th, 'English and Thai must not share mutable references');

// Mutating one returned locale must not alter either the canonical data, a second
// language, or a fresh localization. Include answers and log maps in this probe.
const english = localizedByLanguage.en;
const thaiSnapshot = JSON.stringify(localizedByLanguage.th);
const originalEnglishTitle = english[1].title;
english[1].title = 'CHANGED TEST TITLE';
english[1].tasks[0].accepted.push('TEST ANSWER');
english[1].tasks[0].evidence[0].quote = 'CHANGED EVIDENCE';
english[1].tasks[0].hints[0].command = 'CHANGED COMMAND';
english[1].context.hosts[0].services.push('CHANGED SERVICE');
english[1].files[readmePath] = 'CHANGED README';
english[1].baselineFiles['/var/log/auth.log'] = 'CHANGED LOG';
english[1].debrief.references[0].url = 'https://example.invalid/test';
equal(JSON.stringify(cases), japaneseSnapshot, 'editing localized nested data must not alter Japanese source');
equal(JSON.stringify(localizedByLanguage.th), thaiSnapshot, 'editing English must not alter Thai');
const freshEnglish = i18n.localizeCases(cases, 'en');
equal(freshEnglish[1].title, originalEnglishTitle, 'fresh localization is independent of previous mutations');
assertProtectedData(cases[1], freshEnglish[1], 'freshEnglish.ssh');
assertDisjoint(english, freshEnglish, 'repeated localizations must not share mutable references');

// Both UI catalogs use the same Japanese keys and preserve positional tokens.
const englishKeys = Object.keys(uiCatalog.en).sort();
deepEqual(Object.keys(uiCatalog.th).sort(), englishKeys, 'English/Thai UI catalog keys match');
ok(englishKeys.length > 300, 'the complete UI catalog is loaded');
const tokens = text => (text.match(/\{\d+\}/g) || []).sort();
// Japanese grammatical tails can intentionally disappear in another language;
// they are combined with a separately translated clause by the existing UI.
const optionalGrammaticalTails = new Set([' です', 'で比較できます。']);
for (const language of ['en', 'th']) {
  i18n.setLocale(language);
  equal(i18n.locale, language, language + ': locale setter');
  for (const key of englishKeys) {
    const text = uiCatalog[language][key];
    equal(typeof text, 'string', language + ': UI value type for ' + key);
    ok(text.trim() || optionalGrammaticalTails.has(key), language + ': UI value is not empty except for an optional grammatical tail: ' + key);
    ok(!japaneseText.test(text), language + ': UI value has no Japanese prose for ' + key);
    deepEqual(tokens(text), tokens(key), language + ': positional placeholders preserved for ' + key);
    equal(i18n.t(key), text, language + ': exact UI lookup for ' + key);
  }
  const exactKey = 'このブラウザに保存済み';
  equal(i18n.t(' \n' + exactKey + '\t '), ' \n' + uiCatalog[language][exactKey] + '\t ', language + ': trimmed-key lookup preserves whitespace');
  const unknownKey = '未登録のメッセージ / unknown-key';
  equal(i18n.t(unknownKey), unknownKey, language + ': unknown key falls back to Japanese source');
  equal(i18n.t('解答：{0}', 'SHOULD NOT BE INSERTED'), uiCatalog[language]['解答：{0}'], language + ': exact strings are not interpolated');
  for (const value of ['$&', '$1 $$ $` $\'', '{0} {1} {{braces}}', '日本語の調査メモ', 'a\\b\\c\n二行目', '<script>alert("x")</script>', 0, false, null, undefined]) {
    const result = i18n.t`解答：${value}`;
    const expected = uiCatalog[language]['解答：{0}'].replace('{0}', () => String(value));
    equal(result, expected, language + ': tagged interpolation preserves literal user value ' + String(value));
  }
  const left = '$& {1} 日本語のメモ';
  const right = '{0} \\ $$';
  const result = i18n.t`${left} / ${right} 正解`;
  equal(result, uiCatalog[language]['{0} / {1} 正解'].replace(/\{(\d+)\}/g, (_, n) => [left, right][+n]), language + ': inserted braces are not recursively interpolated');
  equal(i18n.t`未登録:${left}:${right}`, '未登録:' + left + ':' + right, language + ': unknown tagged key preserves all user values');
}

i18n.setLocale('ja');
equal(i18n.t('このブラウザに保存済み'), 'このブラウザに保存済み', 'Japanese exact lookup');
equal(i18n.t`解答：${'$& {0} 日本語のメモ'}`, '解答：$& {0} 日本語のメモ', 'Japanese tagged interpolation preserves user data');
equal(i18n.t(undefined), undefined, 'undefined input is preserved');
equal(i18n.t(null), null, 'null input is preserved');
equal(i18n.t(0), '0', 'numeric input');
for (const value of ['fr', 'EN', 'TH', '', null, undefined, {}, ['en']]) {
  i18n.setLocale('th');
  equal(i18n.setLocale(value), 'ja', 'invalid locale falls back to Japanese');
  equal(i18n.locale, 'ja', 'invalid locale updates current state consistently');
  equal(i18n.t('このブラウザに保存済み'), 'このブラウザに保存済み', 'invalid locale uses source UI');
}
deepEqual(i18n.localizeCases(cases, 'unknown'), cases, 'invalid case locale falls back to source content');
equal(JSON.stringify(cases), japaneseSnapshot, 'final Japanese source snapshot remains unchanged');

console.log('i18n: ' + assertions + ' assertions passed; 11 cases / 108 questions; ' + caseTextCount + ' case text leaves per locale; ' + englishKeys.length + ' UI keys per locale; ' + verifiedLogCopies + ' unchanged log copies verified.');
