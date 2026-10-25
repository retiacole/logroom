'use strict';

const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'src');
const modules = {
  CSS: 'style.css',
  SLSTYLE: 'sl.css',
  UI_LOCALE: 'locales/ui.js',
  I18N: 'i18n.js',
  SHELL: 'shell.js',
  VI: 'vi.js',
  SL: 'sl.js',
  CASES: 'cases.js',
  EXTRA: 'cases-extra.js',
  CONTEXT: 'case-context.js',
  READING_A: 'case-reading-a.js',
  READING_B: 'case-reading-b.js',
  LOCALE_A: 'locales/cases-a.js',
  LOCALE_B: 'locales/cases-b.js',
  LOCALE_C: 'locales/cases-c.js',
  PRACTICE: 'practice.js',
  APP: 'app.js'
};

function render() {
  let html = fs.readFileSync(path.join(source, 'ui.html'), 'utf8');
  const imageMarker = '__GUIDE_ENDING_IMAGE__';
  if (html.split(imageMarker).length !== 2) throw new Error('Expected one guide illustration marker');
  const guideImage = fs.readFileSync(path.join(source, 'assets/guide-ending.png'));
  html = html.replace(imageMarker, () => 'data:image/png;base64,' + guideImage.toString('base64'));
  for (const [token, filename] of Object.entries(modules)) {
    const marker = `/*__${token}__*/`;
    if (html.split(marker).length !== 2) {
      throw new Error(`src/ui.html must contain exactly one ${marker}`);
    }
    const content = fs.readFileSync(path.join(source, filename), 'utf8');
    const escaped = filename.endsWith('.js') ? content.replace(/<\/script/gi, '<\\/script') : content;
    html = html.replace(marker, () => escaped);
  }
  if (/\/\*__[A-Z_]+__\*\//.test(html)) throw new Error('Unresolved build marker');
  const license = fs.readFileSync(path.join(root, 'LICENSE'), 'utf8');
  if (license.includes('-->')) throw new Error('LICENSE cannot contain an HTML comment terminator');
  return html.replace('<!doctype html>', () => '<!doctype html>\n<!--\n'+license+'-->');
}

if (require.main === module) {
  const html = render();
  fs.mkdirSync(path.join(root, 'dist'), {recursive: true});
  for (const target of ['index.html', 'dist/index.html', 'dist/logroom.html']) {
    fs.writeFileSync(path.join(root, target), html);
  }
  fs.writeFileSync(path.join(root, 'dist/.nojekyll'), '');
  console.log(`Built index.html and dist/{index.html,logroom.html}: ${Buffer.byteLength(html).toLocaleString('en-US')} bytes each`);
}

module.exports = {render, modules};
