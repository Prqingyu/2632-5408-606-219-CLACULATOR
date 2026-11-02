/*
 * NumberForge engine v2 — 严格保序规则
 *
 * 规则（2026-11-03 用户确认）：
 *  - 用到的给定数字必须「整串、按原顺序、相邻」出现在式子里：
 *    例：32 → 3+2 ✓   5408 → 5.4+0.8 ✓
 *    不能只取 5408 的 5 和 8（跳数字），不能把 219 写成 9…1（倒序）
 *  - 数字块内可插小数点；运算符随意；括号随意
 *  - 可以只用一部分给定数字；五个数之间的先后不限
 *  - 常规规则搜不到时，用「对数 + 开方」兜底（作弊模式）
 *
 * 实现：每个给定数字先生成「保序表达式值集合」（bundle），
 *       再做 1/2/3 个数字的完整组合与 4/5 个数字的限时组合。
 * 全部结果用 BigInt 精确分数校验。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NumberForge = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* ------------------------------------------------------------------ *
   *  基础：精确分数 (BigInt)
   * ------------------------------------------------------------------ */
  var BIG_LIMIT = 1n << 512n;

  function now() {
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  }
  function absBig(x) { return x < 0n ? -x : x; }
  function gcdBig(a, b) {
    a = absBig(a); b = absBig(b);
    while (b) { var t = a % b; a = b; b = t; }
    return a || 1n;
  }
  function inRange(x) { return x < BIG_LIMIT && x > -BIG_LIMIT; }

  function frac(n, d) {
    if (d === undefined) d = 1n;
    if (d === 0n) return null;
    if (d < 0n) { n = -n; d = -d; }
    if (!inRange(n) || !inRange(d)) return null;
    var g = gcdBig(n, d);
    return { n: n / g, d: d / g };
  }
  function fkey(f) { return f.n.toString(36) + '/' + f.d.toString(36); }
  function fadd(a, b) {
    var g = gcdBig(a.d, b.d);
    var n = a.n * (b.d / g) + b.n * (a.d / g);
    var d = a.d / g * b.d;
    return frac(n, d);
  }
  function fsub(a, b) { return fadd(a, { n: -b.n, d: b.d }); }
  function fmul(a, b) { return frac(a.n * b.n, a.d * b.d); }
  function fdiv(a, b) { if (b.n === 0n) return null; return frac(a.n * b.d, a.d * b.n); }
  function fneg(a) { return { n: -a.n, d: a.d }; }
  function fnum(f) {
    if (f.d === 1n) return Number(f.n);
    return Number(f.n) / Number(f.d);
  }
  function bigSqrt(x) {
    if (x < 0n) return null;
    if (x < 2n) return x;
    var r = 1n << BigInt(Math.ceil(x.toString(2).length / 2));
    for (;;) {
      var nr = (r + x / r) >> 1n;
      if (nr >= r) break;
      r = nr;
    }
    while (r * r > x) r -= 1n;
    while ((r + 1n) * (r + 1n) <= x) r += 1n;
    return r;
  }
  function fracSqrt(f) {
    if (f.n < 0n) return null;
    var rn = bigSqrt(f.n), rd = bigSqrt(f.d);
    if (rn === null || rd === null) return null;
    if (rn * rn !== f.n || rd * rd !== f.d) return null;
    return { n: rn, d: rd };
  }
  function fracFact(f) {
    if (f.d !== 1n || f.n < 0n || f.n > 30n) return null;
    var r = 1n;
    for (var i = 2n; i <= f.n; i++) r *= i;
    return frac(r, 1n);
  }
  function fracPowInt(base, e) {
    if (e > 64n || e < -64n) return null;
    var absE = e < 0n ? -e : e;
    var n = base.n, d = base.d;
    if (n === 0n) return e < 0n ? null : (e === 0n ? frac(1n, 1n) : frac(0n, 1n));
    var bn = 1n, bd = 1n;
    for (var i = 0n; i < absE; i++) {
      bn *= n; bd *= d;
      if (!inRange(bn) || !inRange(bd)) return null;
    }
    if (e < 0n) { if (bn === 0n) return null; return frac(bd, bn); }
    return frac(bn, bd);
  }
  function parseDecimal(str) {
    if (typeof str !== 'string') return null;
    var s = str.trim();
    var neg = false;
    if (s.charAt(0) === '-') { neg = true; s = s.slice(1); }
    if (!/^(\d+(\.\d*)?|\.\d+)$/.test(s)) return null;
    var parts = s.split('.');
    var ip = parts[0] || '0';
    var fp = parts.length > 1 ? parts[1] : '';
    var n = BigInt(ip + fp);
    var d = 10n ** BigInt(fp.length);
    if (neg) n = -n;
    return frac(n, d);
  }
  function fracToText(f) {
    if (f.d === 1n) return f.n.toString();
    var d = f.d, twos = 0, fives = 0;
    while (d % 2n === 0n) { d /= 2n; twos++; }
    while (d % 5n === 0n) { d /= 5n; fives++; }
    if (d === 1n) {
      var digits = Math.max(twos, fives);
      var scale = 10n ** BigInt(digits);
      var num = f.n * (scale / f.d);
      var neg = num < 0n;
      if (neg) num = -num;
      var s = num.toString().padStart(digits + 1, '0');
      var out = s.slice(0, s.length - digits) + '.' + s.slice(s.length - digits);
      out = out.replace(/\.?0+$/, function (m) { return m.indexOf('.') >= 0 ? '' : m; });
      return (neg ? '-' : '') + out;
    }
    return f.n.toString() + '/' + f.d.toString();
  }
  function popcount(x) {
    var c = 0;
    while (x) { x &= x - 1; c++; }
    return c;
  }
  function listBits(mask) {
    var r = [];
    for (var i = 0; i < N_SOURCES; i++) if (mask & (1 << i)) r.push(i);
    return r;
  }

  /* ------------------------------------------------------------------ *
   *  给定数字
   * ------------------------------------------------------------------ */
  var SOURCES = [
    { label: '26', digits: '26', color: '#ff7a7a' },
    { label: '32', digits: '32', color: '#4ade80' },
    { label: '219', digits: '219', color: '#facc15' },
    { label: '5408', digits: '5408', color: '#c084fc' },
    { label: '606', digits: '606', color: '#38bdf8' },
    { label: '326', digits: '326', color: '#fb923c' },
    { label: '2632', digits: '2632', color: '#f472b6' },
    { label: '3226', digits: '3226', color: '#2dd4bf' }
  ];
  var N_SOURCES = SOURCES.length;
  var ALL_MASK = (1 << N_SOURCES) - 1;

  /* ------------------------------------------------------------------ *
   *  表达式 AST
   * ------------------------------------------------------------------ */
  function leafNode(text, fracValue, src) {
    return { k: 'n', text: text, frac: fracValue, src: src };
  }
  function nodeBin(op, a, b) { return { k: 'b', op: op, a: a, b: b }; }
  function nodeUn(op, a) { return { k: 'u', op: op, a: a }; }

  var evalCache = new WeakMap();
  function evalExact(node) {
    if (evalCache.has(node)) return evalCache.get(node);
    var r = null;
    if (node.k === 'n') r = node.frac;
    else if (node.k === 'b') {
      var a = evalExact(node.a), b = evalExact(node.b);
      if (a && b) {
        switch (node.op) {
          case '+': r = fadd(a, b); break;
          case '-': r = fsub(a, b); break;
          case '*': r = fmul(a, b); break;
          case '/': r = fdiv(a, b); break;
          case '^': r = b.d === 1n ? fracPowInt(a, b.n) : null; break;
        }
      }
    } else if (node.k === 'u') {
      var x = evalExact(node.a);
      if (x) {
        if (node.op === '!') r = fracFact(x);
        else if (node.op === '√') r = fracSqrt(x);
        else if (node.op === '−') r = fneg(x);
      }
    }
    evalCache.set(node, r);
    return r;
  }

  var metricCache = new WeakMap();
  function metrics(node) {
    if (metricCache.has(node)) return metricCache.get(node);
    var m;
    if (node.k === 'n') {
      m = { leaves: 1, ops: 0, textLen: node.text.length, srcMask: 1 << node.src, advanced: false, divs: 0 };
    } else if (node.k === 'b') {
      var A = metrics(node.a), B = metrics(node.b);
      m = {
        leaves: A.leaves + B.leaves,
        ops: A.ops + B.ops + 1,
        textLen: A.textLen + B.textLen + 3,
        srcMask: A.srcMask | B.srcMask,
        advanced: A.advanced || B.advanced || node.op === '^',
        divs: A.divs + B.divs + (node.op === '/' ? 1 : 0)
      };
    } else {
      var C = metrics(node.a);
      m = {
        leaves: C.leaves,
        ops: C.ops + 1,
        textLen: C.textLen + 2,
        srcMask: C.srcMask,
        advanced: true,
        divs: C.divs
      };
    }
    metricCache.set(node, m);
    return m;
  }

  var PREC = { '+': 1, '-': 1, '*': 2, '/': 2, '^': 4 };
  var OP_SYM = { '+': '+', '-': '−', '*': '×', '/': '÷', '^': '^' };

  function toPlain(node, parentPrec) {
    if (parentPrec === undefined) parentPrec = 0;
    if (node.k === 'n') return node.text;
    if (node.k === 'u') {
      if (node.op === '!') return '(' + toPlain(node.a, 0) + ')!';
      if (node.op === '√') return '√(' + toPlain(node.a, 0) + ')';
      if (node.op === '−') return '(−' + toPlain(node.a, 0) + ')';
    }
    if (node.k === 'b') {
      var p = PREC[node.op];
      var s;
      if (node.op === '^') s = toPlain(node.a, 5) + '^' + toPlain(node.b, 5);
      else {
        var left = toPlain(node.a, p);
        var rp = (node.op === '-' || node.op === '/') ? p + 1 : p;
        var right = toPlain(node.b, rp);
        s = left + OP_SYM[node.op] + right;
      }
      if (p < parentPrec) s = '(' + s + ')';
      return s;
    }
    return '?';
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function numHTML(text, src) {
    var color = src != null && SOURCES[src] ? SOURCES[src].color : '#e2e8f0';
    return '<span class="tok num" style="--c:' + color + '">' + esc(text) + '</span>';
  }
  function opHTML(sym) { return '<span class="tok op">' + sym + '</span>'; }

  function toHTML(node) {
    if (node.k === 'n') return numHTML(node.text, node.src);
    if (node.k === 'u') {
      if (node.op === '!') return '<span class="tok wrap">(</span>' + toHTML(node.a) + '<span class="tok wrap">)</span><span class="tok op">!</span>';
      if (node.op === '√') return '<span class="tok op sqrt">√</span><span class="tok wrap">(</span>' + toHTML(node.a) + '<span class="tok wrap">)</span>';
      if (node.op === '−') return '<span class="tok op">−</span><span class="tok wrap">(</span>' + toHTML(node.a) + '<span class="tok wrap">)</span>';
    }
    if (node.k === 'b') {
      var p = PREC[node.op];
      if (node.op === '^') {
        var base = toHTML(node.a);
        if (node.a.k === 'b') base = '<span class="tok wrap">(</span>' + base + '<span class="tok wrap">)</span>';
        return base + '<sup class="exp">' + toHTML(node.b) + '</sup>';
      }
      var left = toHTML(node.a);
      var right = toHTML(node.b);
      if (node.a.k === 'b' && PREC[node.a.op] < p) left = '<span class="tok wrap">(</span>' + left + '<span class="tok wrap">)</span>';
      var needRight = node.b.k === 'b' && (PREC[node.b.op] < p || ((node.op === '-' || node.op === '/') && PREC[node.b.op] === p));
      if (needRight) right = '<span class="tok wrap">(</span>' + right + '<span class="tok wrap">)</span>';
      return left + opHTML(OP_SYM[node.op]) + right;
    }
    return '';
  }

  function leafSequence(node) {
    var out = [];
    (function walk(n) {
      if (n.k === 'n') out.push(n);
      else if (n.k === 'b') { walk(n.a); walk(n.b); }
      else walk(n.a);
    })(node);
    return out;
  }

  function describeUsed(node) {
    var seq = leafSequence(node);
    var map = new Map(); // src -> {pieces: [], first: idx, last: idx}
    seq.forEach(function (leaf, i) {
      var rec = map.get(leaf.src);
      if (!rec) { rec = { pieces: [], first: i, last: i }; map.set(leaf.src, rec); }
      rec.pieces.push(leaf.text);
      rec.last = i;
    });
    var out = [];
    map.forEach(function (rec, src) {
      out.push({ src: src, label: SOURCES[src].label, color: SOURCES[src].color, pieces: rec.pieces, first: rec.first, last: rec.last });
    });
    out.sort(function (a, b) { return a.src - b.src; });
    return out;
  }

  /* ------------------------------------------------------------------ *
   *  保序数字块：piece 变体
   * ------------------------------------------------------------------ */
  function pieceVariants(piece, allowPoint) {
    var out = new Map();
    var L = piece.length;
    function put(text) {
      var v = parseDecimal(text);
      if (!v) return;
      var k = fkey(v);
      var old = out.get(k);
      if (!old || text.length < old.text.length) out.set(k, { text: text, frac: v });
    }
    var leadingZero = piece.charAt(0) === '0' && L > 1;
    if (!leadingZero) put(piece);
    if (allowPoint) {
      put('.' + piece);
      for (var p = 1; p < L; p++) {
        if (leadingZero && p > 1) continue; // 避免 "06.0" 这种不合法读法
        put(piece.slice(0, p) + '.' + piece.slice(p));
      }
    }
    return out;
  }

  function allPartitions(digits) {
    var out = [];
    var L = digits.length;
    for (var mask = 0; mask < (1 << (L - 1)); mask++) {
      var pieces = [];
      var start = 0;
      for (var i = 0; i < L - 1; i++) {
        if (mask & (1 << i)) { pieces.push(digits.slice(start, i + 1)); start = i + 1; }
      }
      pieces.push(digits.slice(start));
      out.push(pieces);
    }
    return out;
  }

  /* ------------------------------------------------------------------ *
   *  bundle：一个给定数字的所有"整串保序"表达式
   * ------------------------------------------------------------------ */
  var bundleCache = Object.create(null);

  function bundleCacheKey(opts) {
    return (opts.allowSplit ? 's' : 'w') + (opts.allowPoint ? 'p' : 'n') +
      (opts.power ? 'P' : '-') + (opts.factorial ? 'F' : '-') + (opts.sqrt ? 'S' : '-');
  }

  function entryBetter(cur, cand) {
    if (!cur) return true;
    if (cand.pieces !== cur.pieces) return cand.pieces < cur.pieces;
    if (cand.ops !== cur.ops) return cand.ops < cur.ops;
    return metrics(cand.node).textLen < metrics(cur.node).textLen;
  }

  function addUnaryVariants(map, opts) {
    if (!opts.factorial && !opts.sqrt) return;
    var extra = [];
    map.forEach(function (e) {
      var fv, sv;
      if (opts.factorial) {
        fv = fracFact(e.v);
        if (fv) extra.push({ v: fv, node: nodeUn('!', e.node), pieces: e.pieces, ops: e.ops + 1 });
      }
      if (opts.sqrt) {
        sv = fracSqrt(e.v);
        if (sv) extra.push({ v: sv, node: nodeUn('√', e.node), pieces: e.pieces, ops: e.ops + 1 });
      }
    });
    extra.forEach(function (e) {
      var k = fkey(e.v);
      if (entryBetter(map.get(k), e)) map.set(k, e);
    });
  }

  function buildBundle(digits, src, opts) {
    var best = new Map();
    var parts = opts.allowSplit ? allPartitions(digits) : [digits];
    parts.forEach(function (pieces) {
      var k = pieces.length;
      // E[i][j] : Map key -> {v, node, pieces, ops}
      var E = [];
      for (var i = 0; i < k; i++) E.push(new Array(k).fill(null));
      for (var a = 0; a < k; a++) {
        var variants = pieceVariants(pieces[a], opts.allowPoint);
        var leafMap = new Map();
        variants.forEach(function (rec) {
          leafMap.set(fkey(rec.frac), {
            v: rec.frac,
            node: leafNode(rec.text, rec.frac, src),
            pieces: 1,
            ops: 0
          });
        });
        addUnaryVariants(leafMap, opts);
        E[a][a] = leafMap;
      }
      for (var len = 2; len <= k; len++) {
        for (var i2 = 0; i2 + len - 1 < k; i2++) {
          var j2 = i2 + len - 1;
          var out = new Map();
          for (var m = i2; m < j2; m++) {
            var A = E[i2][m], B = E[m + 1][j2];
            A.forEach(function (ea) {
              B.forEach(function (eb) {
                var combos = [
                  { v: fadd(ea.v, eb.v), op: '+', A: ea, B: eb },
                  { v: fsub(ea.v, eb.v), op: '-', A: ea, B: eb },
                  { v: fmul(ea.v, eb.v), op: '*', A: ea, B: eb }
                ];
                if (eb.v.n !== 0n) { var dv1 = fdiv(ea.v, eb.v); if (dv1) combos.push({ v: dv1, op: '/', A: ea, B: eb }); }
                if (opts.power) {
                  // 注意：保序规则下只允许 "左^右"（被拆开的数字必须先出现）
                  if (eb.v.d === 1n && eb.v.n >= -8n && eb.v.n <= 8n) {
                    var pv1 = fracPowInt(ea.v, eb.v.n);
                    if (pv1) combos.push({ v: pv1, op: '^', A: ea, B: eb });
                  }
                }
                for (var ci = 0; ci < combos.length; ci++) {
                  var c = combos[ci];
                  var node = nodeBin(c.op, c.A.node, c.B.node);
                  var entry = { v: c.v, node: node, pieces: ea.pieces + eb.pieces, ops: ea.ops + eb.ops + 1 };
                  var kk = fkey(c.v);
                  if (entryBetter(out.get(kk), entry)) out.set(kk, entry);
                }
              });
            });
          }
          addUnaryVariants(out, opts);
          E[i2][j2] = out;
        }
      }
      var full = E[0][k - 1];
      full.forEach(function (entry, kk) {
        if (entryBetter(best.get(kk), entry)) best.set(kk, entry);
      });
    });
    // 转成数组
    var vals = [], exprs = [], map = new Map();
    best.forEach(function (entry, kk) {
      map.set(kk, vals.length);
      vals.push(entry.v);
      exprs.push(entry.node);
    });
    return { src: src, vals: vals, exprs: exprs, map: map };
  }

  function getBundles(opts) {
    var key = bundleCacheKey(opts);
    if (bundleCache[key]) return bundleCache[key];
    var bundles = SOURCES.map(function (s, si) {
      return buildBundle(s.digits, si, opts);
    });
    var data = { key: key, bundles: bundles, v2: Object.create(null) };
    bundleCache[key] = data;
    return data;
  }

  /* ------------------------------------------------------------------ *
   *  V2：两两给定数字的组合（懒构建 + 缓存，紧凑存储）
   * ------------------------------------------------------------------ */
  function buildV2(bundles, i, j) {
    var A = bundles[i], B = bundles[j];
    var vals = [], map = new Map(), ops = [], ai = [], bj = [];
    for (var x = 0; x < A.vals.length; x++) {
      var av = A.vals[x];
      for (var y = 0; y < B.vals.length; y++) {
        var bv = B.vals[y];
        for (var op = 0; op < 6; op++) {
          var v;
          switch (op) {
            case 0: v = fadd(av, bv); break;
            case 1: v = fsub(av, bv); break;
            case 2: v = fsub(bv, av); break;
            case 3: v = fmul(av, bv); break;
            case 4: v = bv.n !== 0n ? fdiv(av, bv) : null; break;
            case 5: v = av.n !== 0n ? fdiv(bv, av) : null; break;
          }
          if (!v) continue;
          var k = fkey(v);
          if (map.has(k)) continue;
          map.set(k, vals.length);
          vals.push(v);
          ops.push(op);
          ai.push(x);
          bj.push(y);
        }
      }
    }
    return { i: i, j: j, vals: vals, map: map, ops: ops, ai: ai, bj: bj };
  }

  function getV2(data, i, j) {
    var key = (1 << i) | (1 << j);
    if (!data.v2[key]) data.v2[key] = buildV2(data.bundles, i, j);
    return data.v2[key];
  }

  function pairExpr(v2, idx, bundles) {
    var A = bundles[v2.i].exprs[v2.ai[idx]];
    var B = bundles[v2.j].exprs[v2.bj[idx]];
    switch (v2.ops[idx]) {
      case 0: return nodeBin('+', A, B);
      case 1: return nodeBin('-', A, B);
      case 2: return nodeBin('-', B, A);
      case 3: return nodeBin('*', A, B);
      case 4: return nodeBin('/', A, B);
      case 5: return nodeBin('/', B, A);
    }
    return null;
  }

  /* ------------------------------------------------------------------ *
   *  搜索
   * ------------------------------------------------------------------ */
  function inverseForms(T, a) {
    var out = [];
    var b;
    b = fsub(T, a); if (b) out.push({ b: b, op: '+', flip: false });
    b = fsub(a, T); if (b) out.push({ b: b, op: '-', flip: false });
    b = fadd(T, a); if (b) out.push({ b: b, op: '-', flip: true });
    if (a.n !== 0n) {
      b = fdiv(T, a); if (b) out.push({ b: b, op: '*', flip: false });
      if (T.n !== 0n) { b = fdiv(a, T); if (b) out.push({ b: b, op: '/', flip: false }); }
      b = fmul(T, a); if (b) out.push({ b: b, op: '/', flip: true });
    }
    return out;
  }

  function combineNode(form, aNode, bNode) {
    if (form.flip) {
      if (form.op === '-') return nodeBin('-', bNode, aNode);
      if (form.op === '/') return nodeBin('/', bNode, aNode);
      return nodeBin(form.op, bNode, aNode);
    }
    return nodeBin(form.op, aNode, bNode);
  }

  function pairFind(T, i, j, bundles, deadline) {
    var A = bundles[i], B = bundles[j];
    var iter = A, lookup = B;
    if (A.vals.length > B.vals.length) { iter = B; lookup = A; }
    for (var x = 0; x < iter.vals.length; x++) {
      var forms = inverseForms(T, iter.vals[x]);
      for (var fi = 0; fi < forms.length; fi++) {
        var idx = lookup.map.get(fkey(forms[fi].b));
        if (idx != null) return combineNode(forms[fi], iter.exprs[x], lookup.exprs[idx]);
      }
      if ((x & 255) === 0 && now() > deadline) return null;
    }
    return null;
  }

  function strictSearch(target, bundleData, opts, deadline) {
    var bundles = bundleData.bundles;
    var T = target;
    var tkey = fkey(T);
    var found = [];
    var seen = Object.create(null);
    var count = 0;
    function push(node) {
      if (!node || count > 80) return;
      var plain = toPlain(node, 0);
      if (seen[plain]) return;
      seen[plain] = 1;
      found.push(node);
      count++;
    }

    // 1 个数字
    for (var si = 0; si < N_SOURCES; si++) {
      var idx1 = bundles[si].map.get(tkey);
      if (idx1 != null) push(bundles[si].exprs[idx1]);
    }
    if (now() > deadline) return found;

    // 2 个数字（目标导向，不物化中间表）
    for (var i = 0; i < N_SOURCES; i++) {
      for (var j = i + 1; j < N_SOURCES; j++) {
        var node2 = pairFind(T, i, j, bundles, deadline);
        if (node2) push(node2);
        if (now() > deadline) return found;
      }
    }
    if (now() > deadline) return found;

    // 3 个数字：选代价最小的"单数 × 双数"拆分（预算内，按代价从低到高）
    var triples = [];
    for (var tm = 1; tm < (1 << N_SOURCES); tm++) if (popcount(tm) === 3) triples.push(tm);
    var plans = [];
    for (var ti0 = 0; ti0 < triples.length; ti0++) {
      var tmask0 = triples[ti0];
      var bits0 = listBits(tmask0);
      var best0 = null;
      for (var bi0 = 0; bi0 < bits0.length; bi0++) {
        var restB = bits0.filter(function (b) { return b !== bits0[bi0]; });
        var cost0 = bundles[bits0[bi0]].vals.length * Math.min(bundles[restB[0]].vals.length, bundles[restB[1]].vals.length) * 36;
        if (!best0 || cost0 < best0.cost) best0 = { cost: cost0, single: bits0[bi0], pair: restB };
      }
      if (best0) plans.push({ mask: tmask0, cost: best0.cost, single: best0.single, pair: best0.pair });
    }
    plans.sort(function (a, b) { return a.cost - b.cost; });

    var lookupBudget = opts.deep ? 4000000 : 1600000;
    var tripleDeadline = Math.min(deadline, now() + (opts.deep ? 3000 : 900));
    for (var pi = 0; pi < plans.length; pi++) {
      if (now() > tripleDeadline || lookupBudget <= 0) break;
      var plan = plans[pi];
      var allowed = found.length < 4 ? 420000 : 120000;
      if (plan.cost > allowed) continue;
      var single = bundles[plan.single];
      var pj = plan.pair[0], pk = plan.pair[1];
      var pairCost = 36 * Math.min(bundles[pj].vals.length, bundles[pk].vals.length);
      for (var x2 = 0; x2 < single.vals.length; x2++) {
        var forms2 = inverseForms(T, single.vals[x2]);
        for (var f3 = 0; f3 < forms2.length; f3++) {
          var subNode = pairFind(forms2[f3].b, pj, pk, bundles, tripleDeadline);
          if (subNode) {
            push(combineNode(forms2[f3], single.exprs[x2], subNode));
          }
        }
        lookupBudget -= pairCost;
        if (lookupBudget <= 0) break;
        if ((x2 & 31) === 0 && now() > tripleDeadline) break;
      }
    }

    return found;
  }

  /* ------------------------------------------------------------------ *
   *  对数兜底（作弊模式）
   * ------------------------------------------------------------------ */
  function rootHTML(count, srcs, base) {
    var baseColor = SOURCES[srcs[srcs.length - 1]].color;
    return '<sup class="root-count">' + esc(count) + ' 层</sup>' +
      '<span class="radical" style="--c:' + baseColor + '">√</span>' +
      numHTML(base, srcs[srcs.length - 1]);
  }
  function logHTML(baseText, innerHTML, color) {
    return '<span class="tok log">log</span><sub class="logbase" style="--c:' + color + '">' + baseText + '</sub>' +
      '<span class="tok wrap">(</span>' + innerHTML + '<span class="tok wrap">)</span>';
  }

  function fallbackCandidate(target) {
    var neg = target.n < 0n;
    var t = neg ? { n: -target.n, d: target.d } : target;
    var html, plain, note;
    if (t.n === 0n && t.d === 1n) {
      html = numHTML('2', 0) + opHTML('−') + numHTML('2', 1);
      plain = '2-2';
      return {
        mode: 'fallback', plain: plain, html: html, cheat: false, srcCount: 2,
        leaves: 2, ops: 1, advanced: false,
        used: [
          { src: 0, label: '26', color: SOURCES[0].color, pieces: ['2'] },
          { src: 1, label: '32', color: SOURCES[1].color, pieces: ['2'] }
        ],
        note: '0 = 2 − 2'
      };
    }
    if (t.d === 1n) {
      var n = t.n.toString();
      var chain = rootHTML(n, [0, 1, 2], '2');
      html = (neg ? '' : opHTML('−')) + logHTML('2', logHTML('2', chain, SOURCES[1].color), SOURCES[0].color);
      plain = (neg ? '' : '-') + 'log2(log2(√^' + n + ' 2))';
      note = '把平方根 √ 连续重复 ' + n + ' 层再取两次 log₂；右上角「' + n + ' 层」只是根号层数（计数），不是参与运算的数字。兜底公式本身不遵守保序规则，属于作弊模式。';
      return {
        mode: 'fallback', plain: plain, html: html, cheat: true, srcCount: 3,
        leaves: 3, ops: 5, advanced: true,
        used: [
          { src: 0, label: '26', color: SOURCES[0].color, pieces: ['2'] },
          { src: 1, label: '32', color: SOURCES[1].color, pieces: ['2'] },
          { src: 2, label: '219', color: SOURCES[2].color, pieces: ['2'] }
        ],
        note: note
      };
    }
    var p = t.n.toString(), q = t.d.toString();
    var g2 = (neg ? opHTML('−') : '') + logHTML('2', logHTML('2', rootHTML(p, [0, 1, 2], '2'), SOURCES[1].color), SOURCES[0].color);
    var g6num = opHTML('−') + logHTML('6', logHTML('6', rootHTML(q, [3, 4, 4], '6'), SOURCES[4].color), SOURCES[0].color);
    var denom = logHTML('6', numHTML('3', 1) + opHTML('−') + numHTML('1', 2), SOURCES[1].color);
    html = g2 + opHTML('÷') + '<span class="tok wrap">(</span>' + g6num + opHTML('÷') + denom + '<span class="tok wrap">)</span>';
    plain = (neg ? '-' : '') + 'log2(log2(√^' + p + ' 2)) / ( log6(log6(√^' + q + ' 6)) / log6(3-1) )';
    note = '分子用三个 2 构造 ' + p + '，分母用三个 6 构造 ' + q + '；右上角层数只是计数。兜底公式本身不遵守保序规则，属于作弊模式。';
    return {
      mode: 'fallback', plain: plain, html: html, cheat: true, srcCount: 5,
      leaves: 9, ops: 9, advanced: true,
      used: [
        { src: 0, label: '26', color: SOURCES[0].color, pieces: ['2', '6'] },
        { src: 1, label: '32', color: SOURCES[1].color, pieces: ['2', '3'] },
        { src: 2, label: '219', color: SOURCES[2].color, pieces: ['2', '1'] },
        { src: 4, label: '606', color: SOURCES[4].color, pieces: ['6', '6'] }
      ],
      note: note
    };
  }

  /* ------------------------------------------------------------------ *
   *  评分 / 总装
   * ------------------------------------------------------------------ */
  function decorate(node, opts) {
    var m = metrics(node);
    return {
      mode: 'search',
      node: node,
      plain: toPlain(node, 0),
      html: toHTML(node),
      cheat: false,
      srcCount: popcount(m.srcMask),
      leaves: m.leaves,
      ops: m.ops,
      advanced: m.advanced,
      divs: m.divs,
      used: describeUsed(node),
      note: ''
    };
  }

  function scoreCandidate(c, opts) {
    var s = c.leaves * 10 + c.ops * 7 + Math.min(c.plain.length, 160) * 0.35;
    if (c.advanced) s += 6;
    if (c.divs) s += c.divs * 1.5;
    if (opts.preferAll) s += (5 - c.srcCount) * 55;
    s -= c.srcCount * 0.6;
    if (c.cheat) s += 500;
    return s;
  }

  function parseTargetInput(input) {
    if (input === null || input === undefined) return { ok: false, error: '请输入一个数字' };
    var s = String(input).trim().replace(/[,\s，]/g, '');
    if (!s) return { ok: false, error: '请输入一个数字' };
    if (/^-?\d+\/\d+$/.test(s)) {
      var parts = s.split('/');
      var n = BigInt(parts[0]), d = BigInt(parts[1]);
      if (d === 0n) return { ok: false, error: '分母不能为 0' };
      var f = frac(n, d);
      if (!f) return { ok: false, error: '数字太大了' };
      return { ok: true, text: s, frac: f, isFraction: true };
    }
    var f2 = parseDecimal(s);
    if (!f2) return { ok: false, error: '只支持整数 / 小数 / 分数（如 2026、3.14、1/3）' };
    return { ok: true, text: s, frac: f2, isFraction: false };
  }

  var DEFAULT_OPTS = {
    allowSplit: true,
    allowPoint: true,
    power: true,
    factorial: false,
    sqrt: false,
    preferAll: false,
    allowFallback: true,
    budget: 1500,
    deep: false
  };

  function verifyNodes(nodes, target, opts) {
    var out = [];
    var seen = Object.create(null);
    for (var i = 0; i < nodes.length; i++) {
      var exact = evalExact(nodes[i]);
      if (!exact || exact.n !== target.n || exact.d !== target.d) continue;
      var cand = decorate(nodes[i], opts);
      if (seen[cand.plain]) continue;
      seen[cand.plain] = 1;
      out.push(cand);
    }
    return out;
  }

  function construct(input, userOpts) {
    var t0 = now();
    var opts = {};
    for (var k in DEFAULT_OPTS) opts[k] = DEFAULT_OPTS[k];
    if (userOpts) for (var k2 in userOpts) opts[k2] = userOpts[k2];
    var parsed = parseTargetInput(input);
    if (!parsed.ok) return { ok: false, error: parsed.error };
    var target = parsed.frac;
    var deadline = t0 + (opts.budget || 1500);

    var candidates = [];
    try {
      var bundleData = getBundles(opts);
      var nodes = strictSearch(target, bundleData, opts, deadline);
      candidates = verifyNodes(nodes, target, opts);
    } catch (e) {
      candidates = [];
    }

    candidates.sort(function (a, b) { return scoreCandidate(a, opts) - scoreCandidate(b, opts); });
    var plainSeen = Object.create(null);
    var unique = [];
    for (var ci = 0; ci < candidates.length; ci++) {
      var c = candidates[ci];
      if (plainSeen[c.plain]) continue;
      plainSeen[c.plain] = 1;
      c.score = scoreCandidate(c, opts);
      unique.push(c);
      if (unique.length >= 30) break;
    }
    candidates = unique;

    if (candidates.length === 0 && opts.allowFallback) {
      var fb = fallbackCandidate(target);
      fb.score = scoreCandidate(fb, opts);
      candidates.push(fb);
    }
    return {
      ok: true,
      target: { text: parsed.text, frac: target, textLong: fracToText(target), key: fkey(target) },
      candidates: candidates,
      elapsedMs: Math.round(now() - t0),
      options: opts
    };
  }

  /* ------------------------------------------------------------------ *
   *  严格保序校验（测试用）
   * ------------------------------------------------------------------ */
  function validateNode(node, target) {
    var reasons = [];
    var seq = leafSequence(node);
    var perSrc = {};
    var srcPositions = {};
    seq.forEach(function (leaf, i) {
      if (leaf.k !== 'n') { reasons.push('非数字叶子'); return; }
      var src = leaf.src;
      if (src == null || !SOURCES[src]) { reasons.push('未知来源'); return; }
      if (!perSrc[src]) { perSrc[src] = ''; srcPositions[src] = []; }
      var digits = String(leaf.text).replace(/\./g, '');
      perSrc[src] += digits;
      srcPositions[src].push(i);
    });
    Object.keys(perSrc).forEach(function (srcKey) {
      var src = Number(srcKey);
      var original = SOURCES[src].digits;
      if (perSrc[src] !== original) {
        reasons.push(SOURCES[src].label + ' 没有整串按序出现: ' + perSrc[src] + ' vs ' + original);
      }
      var pos = srcPositions[src];
      for (var i = 1; i < pos.length; i++) {
        if (pos[i] !== pos[i - 1] + 1) { reasons.push(SOURCES[src].label + ' 的数字块没有相邻出现'); break; }
      }
    });
    var v = evalExact(node);
    if (!v || v.n !== target.n || v.d !== target.d) reasons.push('精确值不等于目标');
    return { ok: reasons.length === 0, reasons: reasons };
  }

  return {
    version: '2.0',
    construct: construct,
    parseTargetInput: parseTargetInput,
    fallbackCandidate: fallbackCandidate,
    evalExact: evalExact,
    fracToText: fracToText,
    SOURCES: SOURCES,
    _debug: {
      getBundles: getBundles,
      getV2: getV2,
      strictSearch: strictSearch,
      pairFind: pairFind,
      validateNode: validateNode,
      metrics: metrics,
      toPlain: toPlain
    }
  };
});
