// 严格保序规则下的规模探测：
// 每个给定数字必须整串使用、按原顺序、相邻出现（只允许插小数点/运算符）
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
const OPS = ['+', '-', '*', '/'];

function partitions(str) {
  const out = [];
  const L = str.length;
  for (let mask = 0; mask < (1 << (L - 1)); mask++) {
    const pieces = [];
    let start = 0;
    for (let i = 0; i < L - 1; i++) {
      if (mask & (1 << i)) { pieces.push(str.slice(start, i + 1)); start = i + 1; }
    }
    pieces.push(str.slice(start));
    out.push(pieces);
  }
  return out;
}

function orderedValues(pieces, opts) {
  // 区间 DP：pieces 必须按顺序作为叶子
  const n = pieces.length;
  const varSets = pieces.map(pieceVariants);
  const E = Array.from({ length: n }, () => Array(n).fill(null));
  for (let i = 0; i < n; i++) E[i][i] = varSets[i];
  for (let len = 2; len <= n; len++) {
    for (let i = 0; i + len - 1 < n; i++) {
      const j = i + len - 1;
      const out = new Map();
      for (let k = i; k < j; k++) {
        const A = E[i][k], B = E[k + 1][j];
        A.forEach((ta, ka) => {
          B.forEach((tb, kb) => {
            const pairs = [
              [add(ta, tb)], [sub(ta, tb)], [sub(tb, ta)],
              [mul(ta, tb)]
            ];
            if (tb.n !== 0n) pairs.push([div(ta, tb)]);
            if (ta.n !== 0n) pairs.push([div(tb, ta)]);
            for (const [v] of pairs) {
              if (!v) continue;
              const kk = key(v);
              if (!out.has(kk)) out.set(kk, v);
            }
          });
        });
      }
      E[i][j] = out;
    }
  }
  return E[0][n - 1];
}

const overall = {};
for (const src of SOURCES) {
  const t0 = Date.now();
  const parts = partitions(src);
  const values = new Map();
  let rawTotal = 0;
  for (const pieces of parts) {
    const vals = orderedValues(pieces);
    rawTotal += vals.size;
    vals.forEach((v, k) => { if (!values.has(k)) values.set(k, v); });
  }  const big = [...values.keys()].filter((k) => k.length > 40).length;
  console.log(src, '| partitions', parts.length, '| rawValues', rawTotal, '| uniqueValues', values.size, '| longKeys', big, '|', Date.now() - t0 + 'ms');
  overall[src] = values;
}

function b36(s) { let x = 0n; for (const c of s) x = x * 36n + BigInt(parseInt(c, 36)); return x; }
function keyToFrac(k) { const [n, d] = k.split('/'); return { n: b36(n), d: b36(d) }; }

// 两两组合规模
let worst = { pair: '', raw: 0, uniq: 0 };
for (let i = 0; i < SOURCES.length; i++) {
  for (let j = i + 1; j < SOURCES.length; j++) {
    const A = overall[SOURCES[i]], B = overall[SOURCES[j]];
    const t0 = Date.now();
    const out = new Map();
    A.forEach((a) => {
      B.forEach((b) => {
        const vals = [add(a, b), sub(a, b), sub(b, a), mul(a, b)];
        if (b.n !== 0n) vals.push(div(a, b));
        if (a.n !== 0n) vals.push(div(b, a));
        for (const v of vals) if (v) out.set(key(v), v);
      });
    });
    const item = { pair: SOURCES[i] + '×' + SOURCES[j], raw: A.size * B.size * 6, uniq: out.size };
    if (item.uniq > worst.uniq) worst = item;
    console.log('pair', SOURCES[i], ',', SOURCES[j], '| raw', item.raw, '| unique', out.size, '|', Date.now() - t0 + 'ms');
  }
}
console.log('worst pair:', worst);
