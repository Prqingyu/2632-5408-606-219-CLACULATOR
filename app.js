/* ============ 2632？ 任意数构造器 · UI 逻辑 ============ */
(function () {
  'use strict';

  var NF = window.NumberForge;
  var $ = function (sel) { return document.querySelector(sel); };

  var state = {
    input: '2026',
    result: null,
    candidates: [],
    index: 0,
    busy: false,
    deepTried: {},
    history: loadHistory()
  };

  /* ---------------- 初始化 ---------------- */
  function init() {
    buildSourcesLine();
    buildKeypad();
    bindEvents();
    renderHistory();
    setInput(state.input);
    // 首屏自动演示一次
    setTimeout(function () { generate(); }, 260);
  }

  function buildSourcesLine() {
    var box = $('#sourcesLine');
    box.innerHTML = NF.SOURCES.map(function (s) {
      return '<span class="src-chip plain" style="--c:' + s.color + '">' +
        '<span class="dot"></span>' + s.label + '</span>';
    }).join('');
  }

  function buildKeypad() {
    var keypad = $('#keypad');
    var keys = ['1', '2', '3', '⌫', '4', '5', '6', 'C', '7', '8', '9', '−', '.', '0', '00', '='];
    keys.forEach(function (k) {
      var btn = document.createElement('button');
      btn.className = 'key' + ('⌫C−='.indexOf(k) >= 0 ? ' fn' : '') + (k === '=' ? ' key-eq' : '');
      btn.textContent = k;
      btn.type = 'button';
      if (k === '⌫') btn.addEventListener('click', function () { backspace(); });
      else if (k === 'C') btn.addEventListener('click', function () { clearInput(); });
      else if (k === '−') btn.addEventListener('click', function () { toggleMinus(); });
      else if (k === '=') btn.addEventListener('click', function () { generate(); });
      else btn.addEventListener('click', function () { appendText(k); });
      keypad.appendChild(btn);
    });
  }

  function bindEvents() {
    $('#generateBtn').addEventListener('click', generate);
    $('#randomBtn').addEventListener('click', randomTarget);
    $('#nextBtn').addEventListener('click', nextCandidate);
    $('#copyBtn').addEventListener('click', copyExpression);
    $('#deepBtn').addEventListener('click', deepSearch);
    $('#clearHistory').addEventListener('click', function () {
      state.history = [];
      saveHistory();
      renderHistory();
    });

    var input = $('#targetInput');
    input.addEventListener('input', function () { state.input = input.value; });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); generate(); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Tab' && state.candidates.length > 1 && document.activeElement !== input) {
        e.preventDefault();
        nextCandidate();
      }
    });
    $('#backspaceBtn').addEventListener('click', backspace);
    $('#clearBtn').addEventListener('click', clearInput);
  }

  /* ---------------- 输入操作 ---------------- */
  function setInput(text) {
    state.input = text;
    $('#targetInput').value = text;
  }
  function appendText(text) {
    if (state.input.length > 38) return;
    setInput(state.input + text);
    $('#targetInput').focus();
  }
  function backspace() {
    setInput(state.input.slice(0, -1));
    $('#targetInput').focus();
  }
  function clearInput() {
    setInput('');
    $('#targetInput').focus();
  }
  function toggleMinus() {
    if (state.input.charAt(0) === '-') setInput(state.input.slice(1));
    else setInput('-' + state.input);
    $('#targetInput').focus();
  }

  function randomTarget() {
    var roll = Math.random();
    var text;
    if (roll < 0.78) {
      text = String(1 + Math.floor(Math.random() * 9999));
    } else if (roll < 0.92) {
      text = String(1 + Math.floor(Math.random() * 9999)) + '.' + String(1 + Math.floor(Math.random() * 99));
    } else {
      text = String(1 + Math.floor(Math.random() * 99)) + '/' + String(2 + Math.floor(Math.random() * 99));
    }
    setInput(text);
    generate();
  }

  /* ---------------- 选项 ---------------- */
  function readOptions(deep) {
    return {
      allowSplit: $('#optSplit').checked,
      allowPoint: $('#optPoint').checked,
      power: $('#optPower').checked,
      factorial: $('#optFact').checked,
      sqrt: $('#optSqrt').checked,
      allowFallback: $('#optFallback').checked,
      deep: !!deep,
      budget: deep ? 5000 : 1800
    };
  }

  /* ---------------- 生成 ---------------- */
  function generate() {
    if (state.busy) return;
    var raw = String(state.input || '').trim();
    setBusy(true, '搜索引擎启动…');
    // 先让浏览器把忙碌状态画出来，再进入同步计算
    setTimeout(function () {
      var t0 = Date.now();
      var res;
      try {
        res = NF.construct(raw, readOptions(false));
      } catch (err) {
        console.error(err);
        res = { ok: false, error: '计算出错：' + (err && err.message ? err.message : err) };
      }
      setBusy(false);
      if (!res.ok) {
        showError(res.error || '无法解析这个数字');
        return;
      }
      state.result = res;
      state.candidates = res.candidates || [];
      state.index = 0;
      state.deepTried = {};
      state.elapsed = Date.now() - t0;
      renderResult();
      pushHistory(res);
    }, 60);
  }

  function deepSearch() {
    if (state.busy) return;
    var raw = String(state.input || '').trim();
    setBusy(true, '加强搜索中（可能需要几秒）…');
    setTimeout(function () {
      var res;
      try {
        res = NF.construct(raw, readOptions(true));
      } catch (err) {
        res = { ok: false, error: '计算出错：' + (err && err.message ? err.message : err) };
      }
      setBusy(false);
      if (!res.ok) { showError(res.error || '无法解析这个数字'); return; }
      // 合并候选（按 plain 去重）
      var seen = {};
      var merged = [];
      state.candidates.forEach(function (c) { if (!seen[c.plain]) { seen[c.plain] = 1; merged.push(c); } });
      (res.candidates || []).forEach(function (c) { if (!seen[c.plain]) { seen[c.plain] = 1; merged.push(c); } });
      merged.sort(function (a, b) { return (a.score || 0) - (b.score || 0); });
      state.candidates = merged;
      state.result = res;
      state.index = 0;
      renderResult();
    }, 60);
  }

  function setBusy(busy, text) {
    state.busy = busy;
    $('#busy').hidden = !busy;
    if (text) $('#busyText').textContent = text;
    $('#generateBtn').disabled = busy;
    $('#deepBtn').disabled = busy;
    $('#nextBtn').disabled = busy;
    $('#copyBtn').disabled = busy;
  }

  function showError(msg) {
    $('#modeBadge').className = 'mode-badge error';
    $('#modeBadge').textContent = '输入有误';
    $('#expression').innerHTML = '<span class="empty-tip">' + escapeHtml(msg) + '</span>';
    $('#expression').classList.add('rise');
    $('#resultMeta').textContent = '';
    $('#used').innerHTML = '';
    $('#note').hidden = true;
    $('#exprLabel').textContent = '';
  }

  /* ---------------- 渲染结果 ---------------- */
  function renderResult() {
    if (!state.candidates.length) {
      showError(state.result && state.result.ok ? '没有找到构造方式（可尝试打开「对数兜底」或加强搜索）' : '未生成结果');
      return;
    }
    var c = state.candidates[state.index];
    var res = state.result;
    var targetText = res.target.text;

    // 模式标签
    var badge = $('#modeBadge');
    if (c.mode === 'fallback') {
      badge.className = 'mode-badge fallback';
      badge.textContent = '🪄 对数兜底（作弊）';
    } else {
      badge.className = 'mode-badge search';
      badge.textContent = '⚡ 搜索命中' + (c.advanced ? ' · 高级运算' : '');
    }

    // 表达式
    $('#exprLabel').innerHTML = '目标 <b>' + escapeHtml(targetText) + '</b>' + (res.target.textLong !== targetText ? ' = ' + escapeHtml(res.target.textLong) : '') + ' =';
    var expr = $('#expression');
    expr.innerHTML = c.html;
    expr.classList.remove('rise');
    void expr.offsetWidth;
    expr.classList.add('rise');

    // 元信息
    var candCount = state.candidates.length;
    var meta = [];
    meta.push('候选 ' + (state.index + 1) + '/' + candCount);
    meta.push('叶子 ' + c.leaves);
    meta.push('用时 ' + (res.elapsedMs || 0) + 'ms');
    meta.push('校验 ✓');
    $('#resultMeta').textContent = meta.join('  ·  ');

    // 使用数字
    var usedMap = {};
    (c.used || []).forEach(function (u) { usedMap[u.src] = u.pieces; });
    var usedHtml = NF.SOURCES.map(function (s, idx) {
      var pieces = usedMap[idx];
      if (pieces && pieces.length) {
        return '<span class="src-chip used" style="--c:' + s.color + '">' +
          '<span class="dot"></span>' + s.label +
          '<span class="arrow">→</span><span class="pieces">' + escapeHtml(pieces.join(' · ')) + '</span></span>';
      }
      return '<span class="src-chip" style="--c:' + s.color + '"><span class="dot"></span>' + s.label + '</span>';
    }).join('');
    $('#used').innerHTML = usedHtml;

    // 备注（兜底说明）
    var note = $('#note');
    if (c.note) {
      note.hidden = false;
      note.textContent = c.note;
    } else if (c.mode === 'fallback') {
      note.hidden = false;
      note.textContent = '对数兜底不遵守整串保序规则。';
    } else {
      note.hidden = true;
    }
  }

  function nextCandidate() {
    if (!state.candidates.length) return;
    if (state.candidates.length === 1 && !state.deepTried[state.input]) {
      state.deepTried[state.input] = true;
      deepSearch();
      return;
    }
    state.index = (state.index + 1) % state.candidates.length;
    renderResult();
  }

  function copyExpression() {
    if (!state.candidates.length) return;
    var text = state.result.target.text + ' = ' + state.candidates[state.index].plain;
    copyText(text);
    var btn = $('#copyBtn');
    var old = btn.textContent;
    btn.textContent = '已复制 ✓';
    setTimeout(function () { btn.textContent = old; }, 1200);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(function () { fallbackCopy(text); });
    } else {
      fallbackCopy(text);
    }
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* ignore */ }
    document.body.removeChild(ta);
  }

  /* ---------------- 历史记录 ---------------- */
  function loadHistory() {
    try {
      var raw = localStorage.getItem('nf-history-v1');
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }
  function saveHistory() {
    try { localStorage.setItem('nf-history-v1', JSON.stringify(state.history.slice(0, 10))); } catch (e) { /* ignore */ }
  }
  function pushHistory(res) {
    if (!res || !res.candidates || !res.candidates.length) return;
    var c = res.candidates[0];
    state.history = state.history.filter(function (h) { return h.target !== res.target.text; });
    state.history.unshift({
      target: res.target.text,
      plain: c.plain,
      mode: c.mode,
      time: res.elapsedMs || 0
    });
    state.history = state.history.slice(0, 10);
    saveHistory();
    renderHistory();
  }
  function renderHistory() {
    var box = $('#history');
    if (!state.history.length) {
      box.innerHTML = '<li class="empty">还没有记录</li>';
      return;
    }
    box.innerHTML = state.history.map(function (h, i) {
      return '<li data-i="' + i + '">' +
        '<span class="h-target">' + escapeHtml(h.target) + '</span>' +
        '<span class="h-expr">= ' + escapeHtml(h.plain) + '</span>' +
        '<span class="h-mode ' + (h.mode === 'fallback' ? 'fallback' : 'search') + '">' + (h.mode === 'fallback' ? '兜底' : '搜索') + '</span>' +
        '</li>';
    }).join('');
    Array.prototype.forEach.call(box.querySelectorAll('li[data-i]'), function (li) {
      li.addEventListener('click', function () {
        var h = state.history[Number(li.getAttribute('data-i'))];
        if (!h) return;
        setInput(h.target);
        generate();
      });
    });
  }

  /* ---------------- 工具 ---------------- */
  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
