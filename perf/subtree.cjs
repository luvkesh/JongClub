// Inclusive time of functions called under a named function in a .cpuprofile. usage: node subtree.cjs prof fnName
const fs = require('fs');
const [f, root] = process.argv.slice(2);
const p = JSON.parse(fs.readFileSync(f));
const byId = new Map(p.nodes.map((n) => [n.id, n]));
const parent = new Map(); for (const n of p.nodes) for (const c of n.children || []) parent.set(c, n.id);
const incl = new Map(); let tot = 0;
const key = (n) => `${n.callFrame.functionName || '(anon)'}:${n.callFrame.lineNumber}`;
for (let i = 0; i < p.samples.length; i++) {
  const dt = (p.timeDeltas[i + 1] ?? 0) / 1000; let id = p.samples[i]; const chain = [];
  while (id !== undefined) { chain.push(byId.get(id)); id = parent.get(id); }
  const ri = chain.findIndex((n) => n.callFrame.functionName === root); if (ri < 0) continue;
  tot += dt; const seen = new Set();
  for (const n of chain.slice(0, ri)) { const k = key(n); if (!seen.has(k)) { seen.add(k); incl.set(k, (incl.get(k) || 0) + dt); } }
}
console.log(root, 'total', tot.toFixed(0), 'ms');
console.log([...incl].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([k, v]) => `${v.toFixed(0).padStart(6)}  ${k}`).join('\n'));
