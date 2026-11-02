// NumberForge engine tests (v2 严格保序规则) — run: node test/engine.test.js
'use strict';
const assert = require('assert');
const NF = require('../engine.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ✓ ' + name);
  } catch (e) {
    failed++;
    console.log('  ✗ ' + name + '\n    ' + (e && e.message ? e.message : e));
  }
}
function fracOf(text) {
  const p = NF.parseTargetInput(text);
  assert(p.ok, 'parse failed: ' + text);
  return p.frac;
}
function searchCandidates(res) {
  return res.candidates.filter((c) => c.mode === 'search');
}
function assertStrict(res, targetText) {
  const target = fracOf(targetText);
  res.candidates.forEach((c) => {
    if (c.mode !== 'search') return;
    const chk = NF._debug.validateNode(c.node, target);
    assert(chk.ok, targetText + ' 候选不满足整串保序: ' + c.plain + ' / ' + chk.reasons.join('; '));
  });
}

console.log('— 解析 —');
test('整数 / 小数 / 分数 / 负数 / 非法输入', () => {
  assert.deepStrictEqual(NF.parseTargetInput('2026').frac, { n: 2026n, d: 1n });
  assert.deepStrictEqual(NF.parseTargetInput('3.14').frac, { n: 157n, d: 50n });
  assert.deepStrictEqual(NF.parseTargetInput('1/3').frac, { n: 1n, d: 3n });
  assert.deepStrictEqual(NF.parseTargetInput('-2.5').frac, { n: -5n, d: 2n });
  assert.strictEqual(NF.parseTargetInput('abc').ok, false);
  assert.strictEqual(NF.parseTargetInput('1/0').ok, false);
  assert.strictEqual(NF.parseTargetInput('').ok, false);
});

console.log('— 严格保序构造 —');
test('8 个给定数字已加载', () => assert.strictEqual(NF.SOURCES.length, 8));
const sampleTargets = ['0', '1', '2', '3', '4', '5', '7', '12', '22', '25', '26', '32', '100', '219', '606',
  '326', '2632', '3226', '3.14', '26.32', '32.26', '3.226', '0.5', '1/3', '219.5', '3.1416', '-22',
  '1000', '1234', '2026', '1729', '2048', '9999', '12345', '54321', '65536',
  '88888', '114514', '314159'];
sampleTargets.forEach((t) => {
  test('目标 ' + t, () => {
    const res = NF.construct(t, { budget: 2000 });
    assert(res.ok, 'construct failed');
    assert(res.candidates.length > 0, 'no candidate');
    assertStrict(res, t);
  });
});

test('1..30 全部有严格保序搜索结果', () => {
  const misses = [];
  for (let i = 1; i <= 30; i++) {
    const res = NF.construct(String(i), { budget: 1800 });
    if (!searchCandidates(res).length) misses.push(i);
    assertStrict(res, String(i));
  }
  assert.deepStrictEqual(misses, []);
});

test('回归：不会出现把 26 写成 6…2 的倒序式子', () => {
  // 4 = 2×? / 6−2 是旧引擎的错误答案；新引擎必须整串保序
  const res = NF.construct('4', { budget: 1800 });
  assertStrict(res, '4');
  const bad = searchCandidates(res).filter((c) => /^6\s*[-−]\s*2$/.test(c.plain));
  assert.strictEqual(bad.length, 0, '出现了倒序式子: ' + (bad[0] && bad[0].plain));
});

test('新增数字 2632 / 3226 可直接命中', () => {
  ['2632', '3226'].forEach((t) => {
    const res = NF.construct(t, { budget: 1500 });
    const c = res.candidates[0];
    assert.strictEqual(c.mode, 'search', t + ' 应直接命中');
    assertStrict(res, t);
  });
});

console.log('— 选项 —');
test('关闭拆数字时仍可用整块数/小数点构造', () => {
  const res = NF.construct('32', { allowSplit: false, allowPoint: true, budget: 1200 });
  assert(searchCandidates(res).length > 0);
  assertStrict(res, '32');
});
test('关闭对数兜底时，仅靠兜底的目标没有候选', () => {
  const res = NF.construct('314159', { allowFallback: false, budget: 1800 });
  assert.strictEqual(res.candidates.length, 0);
});

console.log('— 对数兜底 —');
function log2(x) { return Math.log(x) / Math.log(2); }
function log6(x) { return Math.log(x) / Math.log(6); }
test('整数兜底公式数值验证 (n=3,7,20)', () => {
  [3, 7, 20].forEach((n) => {
    const val = -log2(log2(Math.pow(2, Math.pow(2, -n))));
    assert(Math.abs(val - n) < 1e-9, 'n=' + n + ' val=' + val);
  });
});
test('分数兜底公式数值验证 (p/q = 3/8, 22/7)', () => {
  [[3, 8], [22, 7]].forEach(([p, q]) => {
    const g2 = -log2(log2(Math.pow(2, Math.pow(2, -p))));
    const g6 = -log6(log6(Math.pow(6, Math.pow(2, -q)))) / log6(2);
    assert(Math.abs(g2 - p) < 1e-9, 'g2 不对: ' + g2);
    assert(Math.abs(g6 - q) < 1e-9, 'g6 不对: ' + g6);
    assert(Math.abs(g2 / g6 - p / q) < 1e-9, 'ratio 不对');
  });
});
test('兜底候选标记 cheat + 不保序说明', () => {
  const c = NF.fallbackCandidate(fracOf('314159'));
  assert.strictEqual(c.mode, 'fallback');
  assert.strictEqual(c.cheat, true);
  assert(/保序/.test(c.note) && /作弊/.test(c.note));
});

console.log('— 覆盖率与性能（1..120）—');
{
  let hits = 0, maxMs = 0, totalMs = 0;
  for (let i = 1; i <= 120; i++) {
    const res = NF.construct(String(i), { budget: 2000 });
    totalMs += res.elapsedMs;
    maxMs = Math.max(maxMs, res.elapsedMs);
    if (searchCandidates(res).length) hits++;
    assertStrict(res, String(i));
  }
  console.log('    搜索命中 %d/120，平均 %dms，最大 %dms', hits, Math.round(totalMs / 120), maxMs);
  test('1..120 搜索命中率 100%', () => assert.strictEqual(hits, 120));
  test('单次构造耗时 ≤ 2500ms', () => assert(maxMs <= 2500, 'max ' + maxMs));
}

console.log('\n结果: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
