// Дерево слоёв SVG (как в панели слоёв Figma: сверху — последние)
const fs = require('fs');
const svg = fs.readFileSync(process.argv[2], 'utf8').replace(/<defs>[\s\S]*<\/defs>/, '');
const maxDepth = Number(process.argv[3] || 4);
const re = /<(\/?)(g|text|rect|path|tspan)\b([^>]*?)(\/?)>/g;
let m, depth = 0; const stack = [{ kids: [] }];
while ((m = re.exec(svg))) {
  const [, close, tag, attrs, self] = m;
  if (tag === 'tspan') continue;
  if (close) { const n = stack.pop(); stack[stack.length - 1].kids.push(n); continue; }
  const id = (attrs.match(/id="([^"]*)"/) || [])[1] || '';
  const node = { tag, id, kids: [] };
  if (self || tag !== 'g' && tag !== 'text') stack[stack.length - 1].kids.push(node);
  else stack.push(node);
}
function pr(n, d) {
  if (d > maxDepth) return;
  const kids = n.kids.slice().reverse();
  const groups = kids.filter(k => k.tag === 'g');
  if (n.id) console.log('  '.repeat(d) + (n.tag === 'g' ? '▸ ' : '· ') + n.id + (n.tag === 'g' ? `  (${n.kids.length})` : ''));
  if (n.tag === 'g') for (const k of kids) { if (k.tag === 'g' || d < maxDepth - 1) pr(k, d + 1); }
}
for (const k of stack[0].kids) pr(k, 0);
