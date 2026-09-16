/* ============================================================
   Kalkulator dengan Riwayat & Download
   Format angka: Indonesia (koma desimal, titik ribuan)
   Urutan operasi: × ÷ dulu, baru + -
   ============================================================ */
'use strict';

const Calculator = (() => {

  // ---------- Format angka Indonesia ----------
  function formatNumber(num) {
    if (!isFinite(num)) return '∞';
    // Bulatkan jika terlalu banyak desimal
    const rounded = Math.round(num * 1e10) / 1e10;
    
    // Pisah integer & desimal
    const str = rounded.toString();
    const [intPart, decPart] = str.split('.');
    
    // Format ribuan
    const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    
    // Gabung pakai koma
    return decPart ? `${formatted},${decPart}` : formatted;
  }

  // ---------- Parser & Evaluator dengan Urutan Operasi ----------
  // Tokenizer: pisah angka, operator, kurung
  function tokenize(expr) {
    const tokens = [];
    let i = 0;
    while (i < expr.length) {
      const c = expr[i];
      if (c === ' ') { i++; continue; }
      if (/[0-9.,]/.test(c)) {
        let num = '';
        while (i < expr.length && /[0-9.,]/.test(expr[i])) {
          // Normalisasi: koma jadi titik untuk parsing
          num += expr[i] === ',' ? '.' : expr[i];
          i++;
        }
        tokens.push({ type: 'number', value: parseFloat(num) });
      } else if ('+-×÷()'.includes(c)) {
        tokens.push({ type: c === '×' ? '×' : c === '÷' ? '÷' : 'op', value: c });
        i++;
      } else {
        throw new Error(`Karakter tidak dikenal: ${c}`);
      }
    }
    return tokens;
  }

  // Parser dengan urutan operasi
  // Grammar:
  //   expr    := term (('+' | '-') term)*
  //   term    := factor (('×' | '÷') factor)*
  //   factor  := '-' factor | '(' expr ')' | number

  function parse(tokens) {
    let pos = 0;

    function peek() { return tokens[pos]; }
    function consume() { return tokens[pos++]; }

    function parseExpr() {
      let left = parseTerm();
      while (peek() && peek().value === '+' || peek() && peek().value === '-') {
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
        if (op === '÷' && right === 0) {
          throw new Error('Tidak bisa dibagi 0');
        }
        left = op === '×' ? left * right : left / right;
      }
      return left;
    }

    function parseFactor() {
      const tok = peek();
      if (!tok) throw new Error('Ekspresi tidak lengkap');
      
      // Unary minus
      if (tok.value === '-') {
        consume();
        return -parseFactor();
      }
      if (tok.value === '+') {
        consume();
        return parseFactor();
      }
      // Kurung
      if (tok.value === '(') {
        consume();
        const val = parseExpr();
        if (!peek() || peek().value !== ')') {
          throw new Error('Kurung tidak ditutup');
        }
        consume();
        return val;
      }
      // Angka
      if (tok.type === 'number') {
        consume();
        return tok.value;
      }
      throw new Error(`Token tidak valid: ${tok.value}`);
    }

    const result = parseExpr();
    if (pos < tokens.length) {
      throw new Error('Ekspresi tidak valid');
    }
    return result;
  }

  // ---------- Breakdown Langkah-Langkah ----------
  // Buat langkah-langkah perhitungan seperti contoh user
  function buildBreakdown(tokens) {
    const steps = [];
    const working = JSON.parse(JSON.stringify(tokens)); // deep copy

    // Helper: tampilkan tokens sebagai string
    function tokensToString(tks) {
      return tks.map(t => {
        if (t.type === 'number') return formatNumber(t.value);
        return t.value;
      }).join(' ');
    }

    // Step 1: Tampilkan ekspresi awal dengan kurung otomatis
    steps.push(tokensToString(working));

    // Iterasi: selesaikan kurung dulu, lalu × ÷, lalu + -
    // Loop maksimal 50 iterasi untuk keamanan
    let safety = 50;

    while (safety-- > 0) {
      // Cari kurung terdalam
      let openIdx = -1;
      let closeIdx = -1;
      for (let i = 0; i < working.length; i++) {
        if (working[i].value === '(') openIdx = i;
        if (working[i].value === ')' && openIdx >= 0) {
          closeIdx = i;
          break;
        }
      }

      if (openIdx >= 0 && closeIdx >= 0) {
        // Evaluasi isi kurung
        const innerTokens = working.slice(openIdx + 1, closeIdx);
        const innerResult = parse(innerTokens);
        const innerStr = tokensToString(innerTokens);
        
        // Catat langkah
        steps.push(`${innerStr} = ${formatNumber(innerResult)}`);

        // Ganti kurung dengan hasil
        working.splice(openIdx, closeIdx - openIdx + 1, { type: 'number', value: innerResult });
        continue;
      }

      // Tidak ada kurung, selesaikan × ÷
      let opIdx = -1;
      for (let i = 0; i < working.length; i++) {
        if (working[i].value === '×' || working[i].value === '÷') {
          opIdx = i;
          break;
        }
      }

      if (opIdx >= 0) {
        const left = working[opIdx - 1];
        const op = working[opIdx];
        const right = working[opIdx + 1];
        
        if (op.value === '÷' && right.value === 0) {
          throw new Error('Tidak bisa dibagi 0');
        }
        
        const result = op.value === '×' ? left.value * right.value : left.value / right.value;
        const stepStr = `${formatNumber(left.value)} ${op.value} ${formatNumber(right.value)} = ${formatNumber(result)}`;
        steps.push(stepStr);
        
        working.splice(opIdx - 1, 3, { type: 'number', value: result });
        continue;
      }

      // Selesaikan + -
      let addSubIdx = -1;
      for (let i = 0; i < working.length; i++) {
        if (working[i].value === '+' || working[i].value === '-') {
          // Skip unary minus di awal
          if (i === 0) continue;
          addSubIdx = i;
          break;
        }
      }

      if (addSubIdx >= 0) {
        const left = working[addSubIdx - 1];
        const op = working[addSubIdx];
        const right = working[addSubIdx + 1];
        const result = op.value === '+' ? left.value + right.value : left.value - right.value;
        const stepStr = `${formatNumber(left.value)} ${op.value} ${formatNumber(right.value)} = ${formatNumber(result)}`;
        steps.push(stepStr);
        
        working.splice(addSubIdx - 1, 3, { type: 'number', value: result });
        continue;
      }

      // Selesai
      break;
    }

    return steps;
  }

  // ---------- API Utama ----------
  function calculate(expression) {
    // Normalisasi input: ganti ÷, ×, kurung, spasi
    let normalized = expression
      .replace(/,/g, '.')     // koma → titik untuk parsing
      .replace(/\s+/g, '');   // hapus spasi
    
    if (!normalized) throw new Error('Ekspresi kosong');

    // Auto-tutup kurung jika kurang
    const openCount = (normalized.match(/\(/g) || []).length;
    const closeCount = (normalized.match(/\)/g) || []).length;
    for (let i = 0; i < openCount - closeCount; i++) {
      normalized += ')';
    }

    const tokens = tokenize(normalized);
    const result = parse(tokens);
    const breakdown = buildBreakdown(tokenize(normalized));

    return {
      expression: expression,
      result: result,
      resultFormatted: formatNumber(result),
      breakdown: breakdown
    };
  }

  // ---------- Export ----------
  return {
    calculate,
    formatNumber
  };
})();

// Expose ke global
window.Calculator = Calculator;