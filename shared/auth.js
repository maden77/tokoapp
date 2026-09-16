/* ============================================================
   Modul Auth: PIN, Lock, Auto-lock
   Versi: Multi-file HTML (bukan SPA)
   ============================================================ */
'use strict';

const Auth = (() => {
  // ---------- Database ----------
  const db = new Dexie('toko_app_db');
  db.version(2).stores({
    notes:    '++id, date',
    photos:   '++id, date',
    meta:     'key',
    messages: '++id, date, type'
  });

  // ---------- State ----------
  let cryptoKey = null;
  let lockTimer = null;
  let initialized = false;
  const IDLE_MS = 3 * 60 * 1000;        // 3 menit idle
  const HIDDEN_GRACE_MS = 30 * 1000;    // 30 detik di background

  // ---------- Helpers ----------
  function $(sel) { return document.querySelector(sel); }

  function showLock() {
    const lock = $('#lockScreen');
    const main = $('#main');
    if (lock) lock.hidden = false;
    if (main) main.hidden = true;
    const inp = $('#pinInput');
    if (inp) { inp.value = ''; setTimeout(() => inp.focus(), 100); }
  }

  function hideLock() {
    const lock = $('#lockScreen');
    const main = $('#main');
    if (lock) lock.hidden = true;
    if (main) main.hidden = false;
  }

  function scheduleAutoLock() {
    clearTimeout(lockTimer);
    lockTimer = setTimeout(lockApp, IDLE_MS);
  }

  function lockApp() {
    cryptoKey = null;
    showLock();
    bindUnlockHandler();
  }

  // ---------- PIN Management ----------
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

  // ---------- Bind handlers ----------
  function bindSetupHandler() {
    const btn = $('#unlockBtn');
    const inp = $('#pinInput');
    const msg = $('#lockMsg');
    if (!btn || !inp) return;

    if (msg) msg.textContent = 'Buat PIN baru (min 6 digit) untuk mengenkripsi data';
    inp.placeholder = 'PIN baru';
    btn.textContent = 'Buat PIN';

    btn.onclick = async () => {
      const pin = inp.value.trim();
      if (pin.length < 6) {
        UI.toast('PIN minimal 6 digit', 'warn');
        return;
      }
      const pin2 = await UI.promptDialog('Konfirmasi PIN:', {
        type: 'password',
        minLen: 6,
        placeholder: '••••••'
      });
      if (!pin2) return;
      if (pin !== pin2) {
        UI.toast('PIN tidak cocok', 'error');
        return;
      }

      try {
        cryptoKey = await setupPIN(pin);
        hideLock();
        scheduleAutoLock();
        window.dispatchEvent(new Event('app-ready'));
      } catch (err) {
        console.error('Setup PIN error:', err);
        UI.toast('Gagal membuat PIN', 'error');
      }
    };

    inp.onkeydown = (e) => {
      if (e.key === 'Enter') btn.click();
    };
  }

  function bindUnlockHandler() {
    const btn = $('#unlockBtn');
    const inp = $('#pinInput');
    const msg = $('#lockMsg');
    if (!btn || !inp) return;

    if (msg) msg.textContent = 'Masukkan PIN untuk membuka';
    inp.placeholder = '••••';
    btn.textContent = 'Buka';

    btn.onclick = async () => {
      const pin = inp.value.trim();
      if (!pin) return;

      try {
        const key = await verifyPIN(pin);
        if (!key) {
          UI.toast('PIN salah', 'error');
          inp.value = '';
          return;
        }
        cryptoKey = key;
        hideLock();
        scheduleAutoLock();
        window.dispatchEvent(new Event('app-ready'));
      } catch (err) {
        console.error('Unlock error:', err);
        UI.toast('Gagal membuka', 'error');
      }
    };

    inp.onkeydown = (e) => {
      if (e.key === 'Enter') btn.click();
    };
  }

  // ---------- Auto-lock listeners ----------
  function bindAutoLockListeners() {
    ['click', 'keydown', 'touchstart', 'pointerdown'].forEach(evt => {
      document.addEventListener(evt, () => {
        if (cryptoKey) scheduleAutoLock();
      }, { passive: true });
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && cryptoKey) {
        setTimeout(() => {
          if (document.hidden && cryptoKey) lockApp();
        }, HIDDEN_GRACE_MS);
      }
    });
  }

  // ---------- Init ----------
  async function init() {
    if (initialized) return;
    initialized = true;

    // Anti clickjacking
    if (window.top !== window.self) {
      document.documentElement.innerHTML = 'Akses ditolak.';
      throw new Error('Framed');
    }

    // Auto-lock listeners
    bindAutoLockListeners();

    // Cek apakah halaman ini punya lock screen
    const lockScreen = $('#lockScreen');
    if (!lockScreen) {
      // Halaman tanpa lock (mis. home page)
      // Tidak perlu apa-apa
      return;
    }

    // Cek apakah sudah ada PIN
    const hasPin = await hasPIN();

    if (!hasPin) {
      // Mode setup: buat PIN baru
      lockScreen.hidden = false;
      bindSetupHandler();
    } else {
      // Mode unlock: minta PIN
      lockScreen.hidden = false;
      bindUnlockHandler();
    }
  }

  // ---------- Public API ----------
  const api = {
    db,
    init,
    getKey: () => cryptoKey,
    lock: lockApp,
    isLocked: () => !cryptoKey,
    hasPIN,
    setupPIN,
    verifyPIN
  };

  return api;
})();

window.Auth = Auth;

// ---------- Auto-init ----------
// Panggil init() setelah DOM ready, tapi hanya jika ada lockScreen
// atau kalau dipanggil manual oleh halaman
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // Hanya auto-init kalau ada lockScreen di halaman
    if (document.getElementById('lockScreen')) {
      Auth.init().catch(err => console.error('Auth init error:', err));
    }
  });
} else {
  if (document.getElementById('lockScreen')) {
    Auth.init().catch(err => console.error('Auth init error:', err));
  }
}