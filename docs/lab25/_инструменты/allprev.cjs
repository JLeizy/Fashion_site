// Превью JPG для всех SVG: docs/lab25/Превью/<раздел>/<имя>.jpg
const fs = require('fs');
const path = require('path');
const L = require('./lib.cjs');
const DOCS = '/home/user/Fashion_site/docs/lab25';
const only = process.argv[2] ? new RegExp(process.argv[2]) : null;
function walk(d) { return fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.svg') ? [path.join(d, e.name)] : []); }
(async () => {
  const browser = await L.chromium.launch();
  const files = walk(DOCS).filter((f) => !f.includes('/Превью/') && (!only || only.test(f)));
  for (const f of files) {
    const rel = path.relative(DOCS, f);
    const sub = rel.startsWith('3_Прототип/') ? rel.slice('3_Прототип/'.length) : path.basename(rel);
    const out = path.join(DOCS, 'Превью', sub.replace(/\.svg$/, '.jpg'));
    await L.preview(browser, f, out, 800 / 1920);
    console.log('превью', path.relative(DOCS, out));
  }
  await browser.close();
})();
