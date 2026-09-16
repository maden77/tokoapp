/* ============================================================
   Toko App — Main Application Logic
   Local-first, encrypted, no cloud
   ============================================================ */
'use strict';

// ---------- Database ----------
const db = new Dexie('toko_app_db');
db.version(1).stores({
  notes:  '++id, date',
  photos: '++id, date',
  meta:   'key'
});

// ---------- State ----------
const State = {
  cryptoKey: null,
  lockTimer: null,
  IDLE_MS: 3 * 60 * 1000,   // 3 menit idle → auto-lock
  HIDDEN_GRACE_MS: 30_000,  // 30 detik di background → auto-lock
  currentStream: null,
  app: new URLSearchParams(location.search).get('app') || 'catatan'
};

// ---------- Helpers ----------
const $ = (sel, root = document) => root.querySelector(sel);

function setTitle(t) { $('#appTitle').textContent = t; }
function setContent(html) { $('#appContent').innerHTML = html; }
const escapeHtml = (s) => UI.escapeHtml(s);

// ============================================================
//   PIN / LOCK SYSTEM
// ============================================================
async function hasPIN() {
  const rec = await db.meta.get('pin');
  return !!rec;
}

async function setupPIN(pin) {
  const salt = await CRYPTO.createSalt();
  const key = await CRYPTO.deriveKey(pin, salt);
  const verifier = await CRYPTO.makeVerifier(key);
  await db.meta.put({
    key: 'pin',
    salt: CRYPTO.bufToB64(salt),
    verifier
  });
  return key;
}

async function verifyPIN(pin) {
  const rec = await db.meta.get('pin');
  if (!rec) return null;
  const salt = new Uint8Array(CRYPTO.b64ToBuf(rec.salt));
  const key = await CRYPTO.deriveKey(pin, salt);
  const ok = await CRYPTO.checkVerifier(key, rec.verifier);
  return ok ? key : null;
}

function showLock() {
  $('#lockScreen').hidden = false;
  $('#main').hidden = true;
  const inp = $('#pinInput');
  if (inp) { inp.value = ''; setTimeout(() => inp.focus(), 50); }
}

function hideLock() {
  $('#lockScreen').hidden = true;
  $('#main').hidden = false;
}

function scheduleAutoLock() {
  clearTimeout(State.lockTimer);
  State.lockTimer = setTimeout(lockApp, State.IDLE_MS);
}

function lockApp() {
  State.cryptoKey = null;
  stopCamera();
  showLock();
  bindUnlockHandler();
}

['click', 'keydown', 'touchstart', 'pointerdown'].forEach(evt => {
  document.addEventListener(evt, () => {
    if (State.cryptoKey) scheduleAutoLock();
  }, { passive: true });
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && State.cryptoKey) {
    setTimeout(() => {
      if (document.hidden && State.cryptoKey) lockApp();
    }, State.HIDDEN_GRACE_MS);
  }
});

// ============================================================
//   CATATAN
// ============================================================
async function loadCatatan() {
  setTitle('📝 Catatan');
  setContent(`
    <div class="note-container">
      <textarea class="note-input" id="noteInput"
        placeholder="Tulis catatan (akan dienkripsi)..."
        maxlength="5000" aria-label="Isi catatan"></textarea>
      <button class="btn" id="btnSimpan">💾 Simpan (Terenkripsi)</button>
      <div class="notes-list" id="notesList" aria-live="polite"></div>
    </div>
  `);

  const input = $('#noteInput');
  const list  = $('#notesList');

  async function render() {
    const notes = await db.notes.orderBy('date').reverse().toArray();
    if (!notes.length) {
      list.innerHTML = '<div class="empty">Belum ada catatan</div>';
      return;
    }
    const decrypted = await Promise.all(notes.map(async n => {
      try {
        const text = await CRYPTO.decrypt(State.cryptoKey, n.cipher);
        return { ...n, text };
      } catch {
        return { ...n, text: '⚠️ Gagal dekripsi' };
      }
    }));

    list.innerHTML = decrypted.map(n => `
      <div class="note-item">
        <p>${escapeHtml(n.text)}</p>
        <small>${escapeHtml(n.date)}</small>
        <button class="note-delete" data-id="${n.id}" aria-label="Hapus">✕</button>
      </div>
    `).join('');

    list.querySelectorAll('.note-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ok = await UI.confirmDialog('Hapus catatan ini?');
        if (!ok) return;
        await db.notes.delete(Number(btn.dataset.id));
        UI.toast('Catatan dihapus', 'success');
        render();
      });
    });
  }

  $('#btnSimpan').addEventListener('click', async () => {
    const text = UI.sanitizeText(input.value, 5000);
    if (!text) { UI.toast('Catatan kosong', 'warn'); return; }

    try {
      const cipher = await CRYPTO.encrypt(State.cryptoKey, text);
      await db.notes.add({ cipher, date: new Date().toISOString() });
      input.value = '';
      UI.toast('Catatan disimpan & terenkripsi', 'success');
      render();
    } catch (err) {
      console.error(err);
      UI.toast('Gagal menyimpan catatan', 'error');
    }
  });

  render();
}

// ============================================================
//   KAMERA
// ============================================================
function stopCamera() {
  if (State.currentStream) {
    State.currentStream.getTracks().forEach(t => t.stop());
    State.currentStream = null;
  }
}

function compressImage(blob, maxDim, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const c = document.createElement('canvas');
      c.width = width; c.height = height;
      c.getContext('2d').drawImage(img, 0, 0, width, height);
      c.toBlob(
        b => b ? resolve(b) : reject(new Error('compress fail')),
        'image/jpeg', quality
      );
    };
    img.onerror = reject;
    img.src = url;
  });
}

async function loadKamera() {
  setTitle('📷 Kamera');
  setContent(`
    <div class="cam-container">
      <div class="video-wrap">
        <video id="video" autoplay playsinline muted aria-label="Preview kamera"></video>
      </div>
      <button class="cam-btn" id="btnCapture" disabled>⏳ Menyiapkan kamera...</button>
      <div class="gallery-title">Galeri Foto (terenkripsi)</div>
      <div class="gallery" id="gallery"></div>
    </div>
  `);

  const video = $('#video');
  const gallery = $('#gallery');
  const btnCapture = $('#btnCapture');
  const canvas = document.createElement('canvas');

  async function startCamera() {
    stopCamera();
    try {
      State.currentStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width:  { ideal: 1920 },
          height: { ideal: 1920 }
        },
        audio: false
      });
      video.srcObject = State.currentStream;
      btnCapture.disabled = false;
      btnCapture.textContent = '📸 Ambil Foto';
    } catch (err) {
      console.error('Camera error', err);
      btnCapture.textContent = '❌ Kamera tidak tersedia';
      UI.toast('Kamera tidak dapat diakses', 'error');
    }
  }

  async function renderGallery() {
    if (gallery._objectUrls) {
      gallery._objectUrls.forEach(u => URL.revokeObjectURL(u));
    }

    const photos = await db.photos.orderBy('date').reverse().limit(50).toArray();
    if (!photos.length) {
      gallery.innerHTML = '<div class="empty" style="grid-column:1/-1;">Belum ada foto</div>';
      gallery._objectUrls = [];
      return;
    }

    const urls = [];
    const items = await Promise.all(photos.map(async p => {
      try {
        const blob = await CRYPTO.decryptBlob(State.cryptoKey, p.blob);
        const url = URL.createObjectURL(blob);
        urls.push(url);
        return `<img src="${url}" data-id="${p.id}" alt="Foto" loading="lazy">`;
      } catch {
        return '';
      }
    }));

    gallery.innerHTML = items.join('');
    gallery._objectUrls = urls;

    gallery.querySelectorAll('img').forEach(img => {
      img.addEventListener('click', async () => {
        const ok = await UI.confirmDialog('Hapus foto ini?');
        if (!ok) return;
        await db.photos.delete(Number(img.dataset.id));
        UI.toast('Foto dihapus', 'success');
        renderGallery();
      });
    });
  }

  btnCapture.addEventListener('click', async () => {
    if (!video.videoWidth) return;
    btnCapture.disabled = true;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);

    canvas.toBlob(async (rawBlob) => {
      try {
        const compressed = await compressImage(rawBlob, 1600, 0.75);
        const encryptedBlob = await CRYPTO.encryptBlob(State.cryptoKey, compressed);
        await db.photos.add({
          blob: encryptedBlob,
          date: new Date().toISOString(),
          size: encryptedBlob.size
        });
        UI.toast('Foto tersimpan (terenkripsi)', 'success');
        renderGallery();
      } catch (err) {
        console.error(err);
        UI.toast('Gagal menyimpan foto', 'error');
      } finally {
        btnCapture.disabled = false;
      }
    }, 'image/jpeg', 0.85);

    const wrap = $('.video-wrap');
    const flash = document.createElement('div');
    flash.style.cssText = 'position:absolute;inset:0;background:#fff;opacity:.8;transition:opacity .3s;pointer-events:none;';
    wrap.appendChild(flash);
    setTimeout(() => flash.style.opacity = '0', 30);
    setTimeout(() => flash.remove(), 400);
  });

  startCamera();
  renderGallery();

  window.addEventListener('beforeunload', stopCamera);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopCamera();
    else if (State.app === 'kamera' && State.cryptoKey) startCamera();
  });
}

// ============================================================
//   KALKULATOR
// ============================================================
async function loadKalkulator() {
  setTitle('🧮 Kalkulator');
  setContent(`
    <div class="calc-container">
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
    </div>
  `);

  const exprEl = document.getElementById('calcExpr');
  const resultEl = document.getElementById('calcResult');
  const historyList = document.getElementById('historyList');

  let currentExpr = '';

  function updateDisplay() {
    exprEl.textContent = currentExpr || '0';
  }

  function updatePreview() {
    if (!currentExpr) {
      resultEl.textContent = '0';
      return;
    }
    try {
      const res = Calculator.calculate(currentExpr);
      resultEl.textContent = res.resultFormatted;
    } catch {
      // Abaikan error saat live preview
    }
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
        ${escapeHtml(item.text)}
        <span class="history-item-result">= ${escapeHtml(item.result)}</span>
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

  async function saveHistory(calcResult) {
    const historyRec = await db.meta.get('calc_history');
    const items = historyRec ? historyRec.value : [];

    const textLines = [
      `${calcResult.expression} = ${calcResult.resultFormatted}`,
      ...calcResult.breakdown
    ].join('\n');

    items.unshift({
      text: textLines,
      expression: calcResult.expression,
      result: calcResult.resultFormatted,
      breakdown: calcResult.breakdown,
      date: new Date().toISOString()
    });

    if (items.length > 100) items.length = 100;

    await db.meta.put({ key: 'calc_history', value: items });
    renderHistory();
  }

  document.querySelectorAll('.calc-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const action = btn.dataset.action;
      const val = btn.dataset.val;

      if (action === 'clear') {
        currentExpr = '';
        resultEl.textContent = '0';
        updateDisplay();
        return;
      }

      if (action === 'backspace') {
        currentExpr = currentExpr.slice(0, -1);
        updateDisplay();
        updatePreview();
        return;
      }

      if (action === 'equals') {
        if (!currentExpr) return;
        try {
          const res = Calculator.calculate(currentExpr);
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

      if (action === 'open') {
        currentExpr += '(';
        updateDisplay();
        updatePreview();
        return;
      }

      if (action === 'close') {
        currentExpr += ')';
        updateDisplay();
        updatePreview();
        return;
      }

      if (val) {
        currentExpr += val;
        updateDisplay();
        updatePreview();
      }
    });
  });

  document.getElementById('btnDownload').addEventListener('click', async () => {
    const historyRec = await db.meta.get('calc_history');
    const items = historyRec ? historyRec.value : [];

    if (!items.length) {
      UI.toast('Belum ada riwayat untuk di-download', 'warn');
      return;
    }

    const header = [
      '========================================',
      '  RIWAYAT KALKULATOR - TOKO APP',
      `  Diekspor: ${new Date().toLocaleString('id-ID')}`,
      `  Total: ${items.length} perhitungan`,
      '========================================',
      ''
    ].join('\n');

    const body = items.map((item, idx) => {
      return `[${idx + 1}] ${new Date(item.date).toLocaleString('id-ID')}\n${item.text}\n${'─'.repeat(40)}\n`;
    }).join('\n');

    const footer = [
      '',
      '========================================',
      'Dibuat dengan Toko App PWA',
      'Data terenkripsi lokal, tidak ada cloud',
      '========================================'
    ].join('\n');

    const content = header + body + footer;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });

    const date = new Date().toISOString().slice(0, 10);
    UI.downloadFile(`riwayat-kalkulator-${date}.txt`, blob);
    UI.toast('File riwayat berhasil di-download', 'success');
  });

  document.getElementById('btnClearHistory').addEventListener('click', async () => {
    const ok = await UI.confirmDialog('Hapus SEMUA riwayat kalkulator?');
    if (!ok) return;
    await db.meta.put({ key: 'calc_history', value: [] });
    UI.toast('Riwayat dihapus', 'success');
    renderHistory();
  });

  // Keyboard support
  const keyHandler = (e) => {
    if (/^[0-9]$/.test(e.key)) {
      currentExpr += e.key;
    } else if (e.key === '+' || e.key === '-') {
      currentExpr += e.key;
    } else if (e.key === '*') {
      currentExpr += '×';
    } else if (e.key === '/') {
      currentExpr += '÷';
    } else if (e.key === '.') {
      currentExpr += '.';
    } else if (e.key === '(' || e.key === ')') {
      currentExpr += e.key;
    } else if (e.key === 'Enter' || e.key === '=') {
      document.querySelector('.calc-btn[data-action="equals"]').click();
      return;
    } else if (e.key === 'Backspace') {
      currentExpr = currentExpr.slice(0, -1);
    } else if (e.key === 'Escape') {
      currentExpr = '';
      resultEl.textContent = '0';
      updateDisplay();
      return;
    } else {
      return;
    }
    updateDisplay();
    updatePreview();
  };

  document.addEventListener('keydown', keyHandler);
  window.addEventListener('beforeunload', () => {
    document.removeEventListener('keydown', keyHandler);
  });

  updateDisplay();
  renderHistory();
}

// ============================================================
//   PENGATURAN
// ============================================================
async function loadPengaturan() {
  setTitle('⚙️ Pengaturan');
  setContent(`
    <div class="note-container">
      <h3 style="margin-bottom:12px;">🔐 Keamanan</h3>
      <button class="btn" id="btnChangePIN" style="background:linear-gradient(90deg,#6366f1,#a855f7);">Ganti PIN</button>
      <button class="btn" id="btnLockNow" style="background:linear-gradient(90deg,#f59e0b,#dc2626);">🔒 Kunci Sekarang</button>

      <h3 style="margin:24px 0 12px;">💾 Backup (Terenkripsi)</h3>
      <p style="color:#94a3b8; font-size:13px; margin-bottom:12px;">
        File backup dienkripsi dengan PIN Anda. Simpan di tempat aman.
      </p>
      <button class="btn" id="btnBackup" style="background:linear-gradient(90deg,#10b981,#059669);">📤 Export Backup</button>
      <label class="btn" style="background:linear-gradient(90deg,#0ea5e9,#0284c7); display:block; text-align:center; cursor:pointer;">
        📥 Import Backup
        <input type="file" id="fileImport" accept=".tokobak" hidden>
      </label>

      <h3 style="margin:24px 0 12px;">🗑️ Zona Bahaya</h3>
      <button class="btn" id="btnWipe" style="background:linear-gradient(90deg,#7f1d1d,#dc2626);">Hapus Semua Data</button>

      <p style="color:#64748b; font-size:11px; margin-top:24px; text-align:center;">
        Semua data tersimpan di perangkat Anda. Tidak ada server.
      </p>
    </div>
  `);

  $('#btnLockNow').addEventListener('click', () => lockApp());

  $('#btnChangePIN').addEventListener('click', async () => {
    const oldPin = await UI.promptDialog('Masukkan PIN lama:', {
      type: 'password', minLen: 6, placeholder: '••••••'
    });
    if (!oldPin) return;

    const oldKey = await verifyPIN(oldPin);
    if (!oldKey) { UI.toast('PIN lama salah', 'error'); return; }

    const newPin = await UI.promptDialog('Masukkan PIN baru (min 6 digit):', {
      type: 'password', minLen: 6, placeholder: '••••••'
    });
    if (!newPin) return;

    const confirmPin = await UI.promptDialog('Konfirmasi PIN baru:', {
      type: 'password', minLen: 6, placeholder: '••••••'
    });
    if (newPin !== confirmPin) { UI.toast('PIN tidak cocok', 'error'); return; }

    try {
      const newKey = await setupPIN(newPin);

      const notes = await db.notes.toArray();
      for (const n of notes) {
        const text = await CRYPTO.decrypt(oldKey, n.cipher);
        n.cipher = await CRYPTO.encrypt(newKey, text);
        await db.notes.put(n);
      }
      const photos = await db.photos.toArray();
      for (const p of photos) {
        const blob = await CRYPTO.decryptBlob(oldKey, p.blob);
        p.blob = await CRYPTO.encryptBlob(newKey, blob);
        await db.photos.put(p);
      }
      State.cryptoKey = newKey;
      UI.toast('PIN berhasil diubah', 'success');
    } catch (err) {
      console.error(err);
      UI.toast('Gagal mengubah PIN', 'error');
    }
  });

  $('#btnBackup').addEventListener('click', async () => {
    try {
      const notes = await db.notes.toArray();
      const rawPhotos = await db.photos.toArray();
      const photos = await Promise.all(rawPhotos.map(async p => ({
        date: p.date,
        data: CRYPTO.bufToB64(await p.blob.arrayBuffer())
      })));
      const meta = await db.meta.toArray();

      const payload = {
        v: 1,
        exportedAt: new Date().toISOString(),
        meta, notes, photos
      };

      const cipher = await CRYPTO.encrypt(State.cryptoKey, JSON.stringify(payload));
      const blob = new Blob([cipher], { type: 'application/octet-stream' });
      UI.downloadFile(`tokoapp-backup-${Date.now()}.tokobak`, blob);
      UI.toast('Backup terunduh', 'success');
    } catch (err) {
      console.error(err);
      UI.toast('Gagal membuat backup', 'error');
    }
  });

  $('#fileImport').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const cipher = await file.text();
      const json = await CRYPTO.decrypt(State.cryptoKey, cipher);
      const payload = JSON.parse(json);

      const ok = await UI.confirmDialog('Import akan MENGGANTI semua data saat ini. Lanjut?');
      if (!ok) { e.target.value = ''; return; }

      await db.transaction('rw', db.notes, db.photos, db.meta, async () => {
        await db.notes.clear();
        await db.photos.clear();
        await db.meta.clear();

        for (const n of payload.notes) await db.notes.add(n);
        for (const p of payload.photos) {
          const bin = CRYPTO.b64ToBuf(p.data);
          await db.photos.add({ blob: new Blob([bin]), date: p.date });
        }
        for (const m of payload.meta) await db.meta.put(m);
      });

      UI.toast('Backup berhasil di-import', 'success');
      setTimeout(() => location.reload(), 1200);
    } catch (err) {
      console.error(err);
      UI.toast('File backup tidak valid atau PIN salah', 'error');
    } finally {
      e.target.value = '';
    }
  });

  $('#btnWipe').addEventListener('click', async () => {
    const ok = await UI.confirmDialog('HAPUS SEMUA DATA? Tindakan ini tidak bisa dibatalkan.');
    if (!ok) return;

    await db.delete();
    localStorage.clear();
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    UI.toast('Semua data dihapus', 'success');
    setTimeout(() => location.reload(), 1000);
  });
}

// ============================================================
//   LOCK SCREEN BINDINGS
// ============================================================
function bindSetupHandler() {
  const btn = $('#unlockBtn');
  const inp = $('#pinInput');
  btn.onclick = async () => {
    const pin = inp.value.trim();
    if (pin.length < 6) { UI.toast('PIN minimal 6 digit', 'warn'); return; }
    const pin2 = await UI.promptDialog('Konfirmasi PIN:', {
      type: 'password', minLen: 6, placeholder: '••••••'
    });
    if (pin !== pin2) { UI.toast('PIN tidak cocok', 'error'); return; }

    State.cryptoKey = await setupPIN(pin);
    hideLock();
    scheduleAutoLock();
    route(State.app);
  };
  inp.onkeydown = (e) => { if (e.key === 'Enter') btn.click(); };
}

function bindUnlockHandler() {
  const btn = $('#unlockBtn');
  const inp = $('#pinInput');
  btn.onclick = async () => {
    const pin = inp.value.trim();
    if (!pin) return;
    const key = await verifyPIN(pin);
    if (!key) {
      UI.toast('PIN salah', 'error');
      inp.value = '';
      return;
    }
    State.cryptoKey = key;
    hideLock();
    scheduleAutoLock();
    route(State.app);
  };
  inp.onkeydown = (e) => { if (e.key === 'Enter') btn.click(); };
}

// ============================================================
//   ROUTER + INIT
// ============================================================
function route(app) {
  if (app === 'kamera') loadKamera();
  else if (app === 'pengaturan') loadPengaturan();
  else if (app === 'kalkulator') loadKalkulator();
  else loadCatatan();
}

async function init() {
  if (window.top !== window.self) {
    document.documentElement.innerHTML = 'Akses ditolak.';
    throw new Error('Framed');
  }

  const btnBack = document.getElementById('btnBack');
  if (btnBack) {
    btnBack.addEventListener('click', () => {
      stopCamera();
      location.href = 'index.html';
    });
  }

  if (!(await hasPIN())) {
    $('#lockScreen').hidden = false;
    $('#lockMsg').textContent = 'Buat PIN baru (min 6 digit) untuk mengenkripsi data';
    $('#pinInput').setAttribute('placeholder', 'PIN baru');
    $('#unlockBtn').textContent = 'Buat PIN';
    bindSetupHandler();
    return;
  }

  showLock();
  bindUnlockHandler();
}

init().catch(err => {
  console.error(err);
  document.body.innerHTML = '<div style="padding:40px;text-align:center;color:#f87171;">Terjadi kesalahan. Muat ulang halaman.</div>';
});
