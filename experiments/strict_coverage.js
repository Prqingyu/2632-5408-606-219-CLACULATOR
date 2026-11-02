// 严格保序规则下：统计 1..120 在"最多用 4 个给定数"时的搜索命中率
'use strict';
const BIG = 1n << 256n;
function abs(x) { return x < 0n ? -x : x; }
function gcd(a, b) { a = abs(a); b = abs(b); while (b) { const t = a % b; a = b; b = t; } return a || 1n; }
function fr(n, d = 1n) {
  if (d === 0n) return null;
  if (d < 0n) { n = -n; d = -d; }
  if (n > BIG || n < -BIG || d > BIG) return null;
  const g = gcd(n, d); return { n: n / g, d: d / g };
}
function key(f) { return f.n.toString(36) + '/' + f.d.toString(36); }
function add(a, b) { const g = gcd(a.d, b.d); return fr(a.n * (b.d / g) + b.n * (a.d / g), a.d / g * b.d); }
function sub(a, b) { return add(a, { n: -b.n, d: b.d }); }
function mul(a, b) { return fr(a.n * b.n, a.d * b.d); }
function div(a, b) { return b.n === 0n ? null : fr(a.n * b.d, a.d * b.n); }
function parse(text) {
  let neg = false, s = text;
  if (s[0] === '-') { neg = true; s = s.slice(1); }
  const parts = s.split('.');
  const ip = parts[0] || '0';
  const fp = parts.length > 1 ? parts[1] : '';
  let n = BigInt(ip + fp), d = 10n ** BigInt(fp.length);
  if (neg) n = -n;
  return fr(n, d);
}
function pieceVariants(piece) {
  const out = new Map();
  const L = piece.length;
  function put(text) { const v = parse(text); if (!v) return; const k = key(v); if (!out.has(k)) out.set(k, v); }
  const leadingZero = piece[0] === '0' && L > 1;
  if (!leadingZero) put(piece);
  put('.' + piece);
  for (let p = 1; p < L; p++) put(piece.slice(0, p) + '.' + piece.slice(p));
  return out;
}
const SOURCES = ['26', '32', '219', '5408', '606'];

function partitions(str) {
  const out = []; const L = str.length;
  for (let mask = 0; mask < (1 << (L - 1)); mask++) {
    const pieces = []; let start = 0;
    for (let i = 0; i < L - 1; i++) if (mask & (1 << i)) { pieces.push(str.slice(start, i + 1)); start = i + 1; }
    pieces.push(str.slice(start)); out.push(pieces);
  }
  return out;
}
function orderedValues(pieces) {
  const n = pieces.length;
  const varSets = pieces.map(pieceVariants);
  const E = Array.from({ length: n }, () => Array(n).fill(null));
  for (let i = 0; i < n; i++) E[i][i] = varSets[i];
  for (let len = 2; len <= n; len++) {
    for (let i = 0; i + len - 1 < n; i++) {
      const j = i + len - 1; const out = new Map();
      for (let k = i; k < j; k++) {
        const A = E[i][k], B = E[k + 1][j];
        A.forEach((ta) => { B.forEach((tb) => {
          const vals = [add(ta, tb), sub(ta, tb), sub(tb, ta), mul(ta, tb)];
          if (tb.n !== 0n) vals.push(div(ta, tb));
          if (ta.n !== 0n) vals.push(div(tb, ta));
          for (const v of vals) if (v) out.set(key(v), v);
        }); });
      }
      E[i][j] = out;
    }
  }
  return E[0][n - 1];
}

// V1
const V1 = [];
for (const src of SOURCES) {
  const values = new Map();
  for (const pieces of partitions(src)) orderedValues(pieces).forEach((v, k) => { if (!values.has(k)) values.set(k, v); });
  V1.push(values);
}
// V2 (index by mask)
const V2 = new Map();
const OPS = [
  (a, b) => add(a, b),
  (a, b) => sub(a, b),
  (a, b) => sub(b, a),
  (a, b) => mul(a, b),
  (a, b) => (b.n !== 0n ? div(a, b) : null),
  (a, b) => (a.n !== 0n ? div(b, a) : null)
];
for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) {
  const out = new Map(); const A = V1[i], B = V1[j];
  A.forEach((a) => B.forEach((b) => { for (const f of OPS) { const v = f(a, b); if (v) out.set(key(v), v); } }));
  V2.set((1 << i) | (1 << j), out);
}
// 剪枝后的规模（|v| 在 [1e-9, 1e12]，分子/分母位长 ≤ 160）
function bitLen(x) { return (x < 0n ? -x : x).toString(2).length; }
function keep(v) {
  if (bitLen(v.n) > 160 || bitLen(v.d) > 160) return false;
  const num = Number(v.n), den = Number(v.d);
  if (!isFinite(num) || !isFinite(den)) return false;
  const x = Math.abs(num / den);
  return x === 0 || (x >= 1e-9 && x <= 1e12);
}
for (const [mask, map] of V2) {
  let kept = 0, total = 0;
  for (const v of map.values()) { total++; if (keep(v)) kept++; }
  console.log('pair mask', mask, 'total', total, 'kept', kept);
}
function listBits(mask) { const r = []; for (let i = 0; i < 5; i++) if (mask & (1 << i)) r.push(i); return r; }
function inv(T, a) {
  const forms = [
    { b: sub(T, a), op: 0, flip: false },
    { b: sub(a, T), op: 1, flip: false },
    { b: add(T, a), op: 2, flip: true },
    { b: a.n !== 0n ? div(T, a) : null, op: 3, flip: false },
    { b: T.n !== 0n ? div(a, T) : null, op: 4, flip: false },
    { b: mul(T, a), op: 5, flip: true }
  ];
  return forms.filter((f) => f.b);
}
function hasTriple(T, mask) {
  const bits = listBits(mask);
  for (const i of bits) {
    const rest = mask ^ (1 << i);
    const pair = V2.get(rest); if (!pair) continue;
    for (const a of V1[i].values()) {
      for (const f of inv(T, a)) if (pair.has(key(f.b))) return true;
    }
  }
  return false;
}
function hasQuad(T, mask) {
  const bits = listBits(mask);
  for (let x = 0; x < bits.length; x++) for (let y = x + 1; y < bits.length; y++) {
    const pairA = (1 << bits[x]) | (1 << bits[y]);
    const pairB = mask ^ pairA;
    if (!V2.has(pairA) || !V2.has(pairB)) continue;
    let A = V2.get(pairA), B = V2.get(pairB);
    if (A.size > B.size) { const t = A; A = B; B = t; }
    for (const a of A.values()) for (const f of inv(T, a)) if (B.has(key(f.b))) return true;
  }
  return false;
}

let hit = 0; const miss = [];
const stageCount = { v1: 0, v2: 0, v3: 0, v4: 0 };
const t0 = Date.now();
for (let n = 1; n <= 120; n++) {
  const T = fr(BigInt(n), 1n);
  let stage = '';
  for (let i = 0; i < 5 && !stage; i++) if (V1[i].has(key(T))) stage = 'v1';
  for (const m of V2.keys()) if (!stage && V2.get(m).has(key(T))) stage = 'v2';
  if (!stage) for (let mask = 0; mask < 32; mask++) { if (popcount(mask) !== 3) continue; if (hasTriple(T, mask)) { stage = 'v3'; break; } }
  if (!stage) for (let mask = 0; mask < 32; mask++) { if (popcount(mask) !== 4) continue; if (hasQuad(T, mask)) { stage = 'v4'; break; } }
  if (stage) { hit++; stageCount[stage]++; } else miss.push(n);
}
function popcount(x) { let c = 0; while (x) { x &= x - 1; c++; } return c; }
console.log('strict rule, ≤4 sources: hit', hit, '/120  in', Date.now() - t0, 'ms');
console.log('by stage:', stageCount, 'misses:', miss.join(','));

// 1..1000，只看 V1/V2
{
  const t1 = Date.now(); let h = 0; const ms = [];
  for (let n = 1; n <= 1000; n++) {
    const T = fr(BigInt(n), 1n); let ok = false;
    for (let i = 0; i < 5 && !ok; i++) if (V1[i].has(key(T))) ok = true;
    for (const m of V2.keys()) if (!ok && V2.get(m).has(key(T))) ok = true;
    if (ok) h++; else ms.push(n);
  }
  console.log('1..1000 via V1/V2 only: hit', h, '/1000 in', Date.now() - t1, 'ms, first misses:', ms.slice(0, 30).join(','));
}

// 1..10000，只看 V1/V2
{
  const t2 = Date.now(); let h = 0; const ms = [];
  for (let n = 1; n <= 10000; n++) {
    const T = fr(BigInt(n), 1n); let ok = false;
    for (let i = 0; i < 5 && !ok; i++) if (V1[i].has(key(T))) ok = true;
    for (const m of V2.keys()) if (!ok && V2.get(m).has(key(T))) ok = true;
    if (ok) h++; else if (ms.length < 30) ms.push(n);
  }
  console.log('1..10000 via V1/V2 only: hit', h, '/10000 in', Date.now() - t2, 'ms, first misses:', ms.join(','));
}

// 一些小数目标
{
  const tests = ['3.14', '0.5', '26.32', '219.5', '3.1416', '0.001', '2.718', '1/3', '0.123'];
  for (const t of tests) {
    let T;
    if (t.includes('/')) { const [a, b] = t.split('/'); T = fr(BigInt(a), BigInt(b)); }
    else { const parts = t.split('.'); T = fr(BigInt(parts[0] + (parts[1] || '')), 10n ** BigInt((parts[1] || '').length)); }
    let stage = 'MISS';
    for (let i = 0; i < 5 && stage === 'MISS'; i++) if (V1[i].has(key(T))) stage = 'v1';
    for (const m of V2.keys()) if (stage === 'MISS' && V2.get(m).has(key(T))) stage = 'v2';
    if (stage === 'MISS') for (let mask = 0; mask < 32; mask++) { if (popcount(mask) !== 3) continue; if (hasTriple(T, mask)) { stage = 'v3'; break; } }
    console.log('target', t, '->', stage);
  }
}
