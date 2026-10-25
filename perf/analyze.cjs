// Summarise a .cpuprofile: self time by function, and inclusive time for key functions.
const fs = require('fs');
const p = JSON.parse(fs.readFileSync(process.argv[2]));
const byId = new Map(p.nodes.map((n) => [n.id, n]));
const parent = new Map(); for (const n of p.nodes) for (const c of n.children || []) parent.set(c, n.id);
const self = new Map(), incl = new Map();
const dts = p.timeDeltas; let total = 0;
for (let i = 0; i < p.samples.length; i++) {
  const dt = (dts[i + 1] ?? 0) / 1000; total += dt;
  let id = p.samples[i]; const n = byId.get(id);
  const key = (n) => `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').pop()}:${n.callFrame.lineNumber}`;
  self.set(key(n), (self.get(key(n)) || 0) + dt);
  const seen = new Set();
  while (id !== undefined) { const m = byId.get(id); const k = key(m); if (!seen.has(k)) { seen.add(k); incl.set(k, (incl.get(k) || 0) + dt); } id = parent.get(id); }
}
const top = (m, n) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${v.toFixed(0).padStart(7)} ms  ${k}`).join('\n');
console.log('total', total.toFixed(0), 'ms\n--- self\n' + top(self, 30) + '\n--- inclusive\n' + top(incl, Number(process.argv[3] || 45)));
