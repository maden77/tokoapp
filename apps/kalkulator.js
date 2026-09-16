'use strict';

// ---------- Format angka Indonesia ----------
function formatNumber(num) {
  if (!isFinite(num)) return '∞';
  const rounded = Math.round(num * 1e10) / 1e10;
  const str = rounded.toString();
  const [intPart, decPart] = str.split('.');
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return decPart ? `${formatted},${decPart}` : formatted;
}

function tokenize(expr) {
  const tokens = [];
  let i = 0;
  while (i < expr.length) {
    const c = expr[i];
    if (c === ' ') { i++; continue; }
    if (/[0-9.,]/.test(c)) {
      let num = '';
      while (i < expr.length && /[0-9.,]/.test(expr[i])) {
        num += expr[i] === ',' ? '.' : expr[i];
        i++;
      }
      tokens.push({ type: 'number', value: parseFloat(num) });
    } else if ('+-×÷()'.includes(c)) {
      tokens.push({ type: 'op', value: c });
      i++;
    } else {
      throw new Error('Karakter tidak dikenal: ' + c);
    }
  }
  return tokens;
}

function parse(tokens) {
  let pos = 0;
  const peek = () => tokens[pos];
  const consume = () => tokens[pos++];

  function parseExpr() {
    let left = parseTerm();
    while (peek() && (peek().value === '+' || peek().value === '-')) {
      const op = consume().value;
      const right = parseTerm();
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  function parseTerm() {
    let left = parseFactor();
    while (peek() && (peek().value === '×' || peek().value === '÷')) {
      const op = consume().value;
      const right = parseFactor();
      if (op === '÷' && right === 0) throw new Error('Tidak bisa dibagi 0');
      left = op === '×' ? left * right : left / right;
    }
    return left;
  }

  function parseFactor() {
    const tok = peek();
    if (!tok) throw new Error('Ekspresi tidak lengkap');
    if (tok.value === '-') { consume(); return -parseFactor(); }
    if (tok.value === '+') { consume(); return parseFactor(); }
    if (tok.value === '(') {
      consume();
      const val = parseExpr();
      if (!peek() || peek().value !== ')') throw new Error('Kurung tidak ditutup');
      consume();
      return val;
    }
    if (tok.type === 'number') { consume(); return tok.value; }
    throw new Error('Token tidak valid: ' + tok.value);
  }

  const result = parseExpr();
  if (pos < tokens.length) throw new Error('Ekspresi tidak valid');
  return result;
}

function tokensToString(tks) {
  return tks.map(t => t.type === 'number' ? formatNumber(t.value) : t.value).join(' ');
}

function buildBreakdown(tokens) {
  const steps = [];
  const working = JSON.parse(JSON.stringify(tokens));
  steps.push(tokensToString(working));

  let safety = 50;
  while (safety-- > 0) {
    let openIdx = -1, closeIdx = -1;
    for (let i = 0; i < working.length; i++) {
      if (working[i].value === '(') openIdx = i;
      if (working[i].value === ')' && openIdx >= 0) { closeIdx = i; break; }
    }
    if (openIdx >= 0 && closeIdx >= 0) {
      const inner = working.slice(openIdx + 1, closeIdx);
      const result = parse(inner);
      steps.push(`${tokensToString(inner)} = ${formatNumber(result)}`);
      working.splice(openIdx, closeIdx - openIdx + 1, { type: 'number', value: result });
      continue;
    }

    let opIdx = -1;
    for (let i = 0; i < working.length; i++) {
      if (working[i].value === '×' || working[i].value === '÷') { opIdx = i; break; }
    }
    if (opIdx >= 0) {
      const left = working[opIdx - 1], op = working[opIdx], right = working[opIdx + 1];
      if (op.value === '÷' && right.value === 0) throw new Error('Tidak bisa dibagi 0');
      const result = op.value === '×' ? left.value * right.value : left.value / right.value;
      steps.push(`${formatNumber(left.value)} ${op.value} ${formatNumber(right.value)} = ${formatNumber(result)}`);
      working.splice(opIdx - 1, 3, { type: 'number', value: result });
      continue;
    }

    let addSubIdx = -1;
    for (let i = 1; i < working.length; i++) {
      if (working[i].value === '+' || working[i].value === '-') { addSubIdx = i; break; }
    }
    if (addSubIdx >= 0) {
      const left = working[addSubIdx - 1], op = working[addSubIdx], right = working[addSubIdx + 1];
      const result = op.value === '+' ? left.value + right.value : left.value - right.value;
      steps.push(`${formatNumber(left.value)} ${op.value} ${formatNumber(right.value)} = ${formatNumber(result)}`);
      working.splice(addSubIdx - 1, 3, { type: 'number', value: result });
      continue;
    }
    break;
  }
  return steps;
}

function calculate(expression) {
  let normalized = expression.replace(/,/g, '.').replace(/\s+/g, '');
  if (!normalized) throw new Error('Ekspresi kosong');

  const openCount = (normalized.match(/\(/g) || []).length;
  const closeCount = (normalized.match(/\)/g) || []).length;
  for (let i = 0; i < openCount - closeCount; i++) normalized += ')';

  const tokens = tokenize(normalized);
  const result = parse(tokens);
  const breakdown = buildBreakdown(tokenize(normalized));

  return { expression, result, resultFormatted: formatNumber(result), breakdown };
}

export async function render() {
  const shell = document.createElement('app-shell');
  shell.setAttribute('title', '🧮 Kalkulator');

  const container = document.createElement('div');
  container.className = 'page-container';
  container.innerHTML = `
    <div class="calc-display">
      <div class="calc-expression" id="calcExpr">0</div>
      <div class="calc-result" id="calcResult">0</div>
    </div>

    <div class="calc-buttons">
      <button class="calc-btn danger" data-action="clear">C</button>
      <button class="calc-btn op" data-action="backspace">⌫</button>
      <button class="calc-btn op" data-action="open">(</button>
      <button class="calc-btn op" data-val="÷">÷</button>

      <button class="calc-btn" data-val="7">7</button>
      <button class="calc-btn" data-val="8">8</button>
      <button class="calc-btn" data-val="9">9</button>
      <button class="calc-btn op" data-val="×">×</button>

      <button class="calc-btn" data-val="4">4</button>
      <button class="calc-btn" data-val="5">5</button>
      <button class="calc-btn" data-val="6">6</button>
      <button class="calc-btn op" data-val="-">−</button>

      <button class="calc-btn" data-val="1">1</button>
      <button class="calc-btn" data-val="2">2</button>
      <button class="calc-btn" data-val="3">3</button>
      <button class="calc-btn op" data-val="+">+</button>

      <button class="calc-btn" data-action="close">)</button>
      <button class="calc-btn" data-val="0">0</button>
      <button class="calc-btn" data-val=".">.</button>
      <button class="calc-btn eq" data-action="equals">=</button>
    </div>

    <div class="calc-history">
      <div class="calc-history-header">
        <h3>📜 Riwayat</h3>
        <div>
          <button class="btn-clear-history" id="btnClearHistory">🗑️</button>
          <button class="btn-download" id="btnDownload">⬇️ Download</button>
        </div>
      </div>
      <div id="historyList"></div>
    </div>
  `;
  shell.appendChild(container);

  const db = Auth.db;
  const $ = (s) => container.querySelector(s);

  const exprEl = $('#calcExpr');
  const resultEl = $('#calcResult');
  const historyList = $('#historyList');

  let currentExpr = '';

  function updateDisplay() { exprEl.textContent = currentExpr || '0'; }

  function updatePreview() {
    if (!currentExpr) { resultEl.textContent = '0'; return; }
    try {
      const res = calculate(currentExpr);
      resultEl.textContent = res.resultFormatted;
    } catch {}
  }

  async function renderHistory() {
    const history = await db.meta.get('calc_history');
    const items = history ? history.value : [];

    if (!items.length) {
      historyList.innerHTML = '<div class="empty">Belum ada riwayat</div>';
      return;
    }

    historyList.innerHTML = items.slice(0, 20).map((item, idx) => `
      <div class="history-item">
        <button class="history-delete" data-idx="${idx}">✕</button>
        ${UI.escapeHtml(item.text)}
        <span class="history-item-result">= ${UI.escapeHtml(item.result)}</span>
      </div>
    `).join('');

    historyList.querySelectorAll('.history-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const idx = Number(btn.dataset.idx);
        const history = await db.meta.get('calc_history');
        const items = history ? history.value : [];
        items.splice(idx, 1);
        await db.meta.put({ key: 'calc_history', value: items });
        renderHistory();
      });
    });
  }

  async function saveHistory(r) {
    const historyRec = await db.meta.get('calc_history');
    const items = historyRec ? historyRec.value : [];
    const textLines = [`${r.expression} = ${r.resultFormatted}`, ...r.breakdown].join('\n');

    items.unshift({
      text: textLines,
      expression: r.expression,
      result: r.resultFormatted,
      breakdown: r.breakdown,
      date: new Date().toISOString()
    });
    if (items.length > 100) items.length = 100;

    await db.meta.put({ key: 'calc_history', value: items });
    renderHistory();
  }

  container.querySelectorAll('.calc-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const action = btn.dataset.action;
      const val = btn.dataset.val;

      if (action === 'clear') { currentExpr = ''; resultEl.textContent = '0'; updateDisplay(); return; }
      if (action === 'backspace') { currentExpr = currentExpr.slice(0, -1); updateDisplay(); updatePreview(); return; }

      if (action === 'equals') {
        if (!currentExpr) return;
        try {
          const res = calculate(currentExpr);
          resultEl.textContent = res.resultFormatted;
          await saveHistory(res);
          currentExpr = res.resultFormatted.replace(/\./g, '');
          updateDisplay();
        } catch (err) {
          UI.toast(err.message, 'error');
          resultEl.textContent = 'Error';
        }
        return;
      }

      if (action === 'open') { currentExpr += '('; updateDisplay(); updatePreview(); return; }
      if (action === 'close') { currentExpr += ')'; updateDisplay(); updatePreview(); return; }
      if (val) { currentExpr += val; updateDisplay(); updatePreview(); }
    });
  });

  $('#btnDownload').addEventListener('click', async () => {
    const historyRec = await db.meta.get('calc_history');
    const items = historyRec ? historyRec.value : [];
    if (!items.length) { UI.toast('Belum ada riwayat', 'warn'); return; }

    const header = [
      '========================================',
      '  RIWAYAT KALKULATOR - TOKO APP',
      `  Diekspor: ${new Date().toLocaleString('id-ID')}`,
      `  Total: ${items.length} perhitungan`,
      '========================================',
      ''
    ].join('\n');

    const body = items.map((item, idx) =>
      `[${idx + 1}] ${new Date(item.date).toLocaleString('id-ID')}\n${item.text}\n${'─'.repeat(40)}\n`
    ).join('\n');

    const footer = '\n========================================\nDibuat dengan Toko App PWA\n========================================';

    const blob = new Blob([header + body + footer], { type: 'text/plain;charset=utf-8' });
    const date = new Date().toISOString().slice(0, 10);
    UI.downloadFile(`riwayat-kalkulator-${date}.txt`, blob);
    UI.toast('File riwayat di-download', 'success');
  });

  $('#btnClearHistory').addEventListener('click', async () => {
    const ok = await UI.confirmDialog('Hapus SEMUA riwayat kalkulator?');
    if (!ok) return;
    await db.meta.put({ key: 'calc_history', value: [] });
    UI.toast('Riwayat dihapus', 'success');
    renderHistory();
  });

  updateDisplay();
  renderHistory();
  return shell;
}