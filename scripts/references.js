'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
for(const file of ['cases.js','cases-extra.js','case-context.js','case-reading-a.js','case-reading-b.js'])require(path.join(root,'src',file));
const lines=['# 参考資料','',
  '各ケースの技術解説と歴史的事案に付けた公開資料へのリンクです。原文・画像・ソフトウェアは同梱していません。資料の権利と利用条件は各公開元に帰属します。外部資料の閲覧にはインターネット接続が必要ですが、演習本体はオフラインで利用できます。','',
  '演習は架空の合成ログです。紹介する実際の事案と同じ製品・構成・攻撃経路を再現しているとは限りません。共通点と相違点は各ケースの解説で確認してください。',''];
for(const [index,c] of globalThis.LOG_LAB_CASES.entries()){
  lines.push(`## ${String(index+1).padStart(2,'0')}. ${c.title}`,'');
  lines.push('### 関連する事案の一次資料','');
  for(const h of c.debrief.history)lines.push(`- [${h.title}（${h.year}）](${h.url}) — ${h.sourceTitle}`);
  lines.push('','### 技術資料','');
  for(const r of c.debrief.references)lines.push(`- [${r.title}](${r.url}) — ${r.description}`);
  lines.push('');
}
fs.writeFileSync(path.join(root,'docs/REFERENCES.md'),lines.join('\n'));
console.log('Generated docs/REFERENCES.md from the case explanations.');
