// 严格保序引擎快速测试
'use strict';
const NF = require('../engine.js');

const targets = ['0', '1', '2', '3', '4', '5', '7', '12', '22', '25', '26', '32', '100', '219', '606',
  '3.14', '0.5', '26.32', '219.5', '1/3', '3.1416', '-22', '1000', '2026', '1729', '2048', '1234', '9999', '114514'];

let hits = 0, total = 0;
const t0 = Date.now();
for (const t of targets) {
  const r = NF.construct(t, { budget: 1500 });
  const c = r.candidates[0];
  total++;
  const search = r.candidates.filter((x) => x.mode === 'search');
  if (search.length) hits++;
  let note = '';
  if (c && c.mode === 'search') {
    const chk = NF._debug.validateNode(c.node, r.target.frac);
    note = chk.ok ? '✓' : ('严格校验失败: ' + chk.reasons.join('; '));
  }
  console.log(String(t).padEnd(8), (c ? c.mode : 'none').padEnd(9),
    ('cands=' + r.candidates.length).padEnd(10),
    (r.elapsedMs + 'ms').padEnd(8),
    note.padEnd(10),
    c ? c.plain.slice(0, 84) : '');
}
console.log('\nsearch hit', hits, '/', total, 'total time', Date.now() - t0, 'ms');
