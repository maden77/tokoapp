/* ============================================================
   Modul Auth: PIN, Lock, Auto-lock — versi SPA
   ============================================================ */
'use strict';

const Auth = (() => {
  const db = new Dexie('toko_app_db');
  db.version(2).stores({
    notes:  '++id, date',
    photos: '++id, date',
    meta:   'key',
    messages: '++id, date, type'
  });

  let cryptoKey = null;
  let lockTimer = null;
  const IDLE_MS = 3 * 60 * 1000;
  const HIDDEN_GRACE_MS = 30_000;
  let onReadyCallback = null;

  function setOnReady(cb) { onReadyCallback = cb; }

  function isLocked() { return !cryptoKey; }

  function fireReady() {
    if (onReadyCallback) onReadyCallback();
  }

  function scheduleAutoLock() {
    clearTimeout(lockTimer);
    lockTimer = setTimeout(lockApp, IDLE_MS);
  }

  function lockApp() {
    cryptoKey = null;
    const lockEl = document.querySelector('lock-screen');
    if (lockEl) lockEl.show();
    bindUnlockHandler();
  }

  async function hasPIN() {
    return !!(await db.meta.get('pin'));
  }

  async function setupPIN(pin) {
    const salt = await CRYPTO.createSalt();
    const key = await CRYPTO.deriveKey(pin, salt);
    const verifier = await CRYPTO.makeVerifier(key);
    await db.meta.put({ key: 'pin', salt: CRYPTO.bufToB64(salt), verifier });
    return key;
  }

  async function verifyPIN(pin) {
    const rec = await db.meta.get('pin');
    if (!rec) return null;
    const salt = new Uint8Array(CRYPTO.b64ToBuf(rec.salt));
    const key = await CRYPTO.deriveKey(pin, salt);
    return (await CRYPTO.checkVerifier(key, rec.verifier)) ? key : null;
  }

  function bindSetupHandler() {
    const lockEl = document.querySelector('lock-screen');
    if (!lockEl) return;
    
    lockEl.setMode('setup');
    lockEl.onSubmit(async (pin) => {
      if (pin.length < 6) { UI.toast('PIN minimal 6 digit', 'warn'); return; }
      const pin2 = await UI.promptDialog('Konfirmasi PIN:', { type: 'password', minLen: 6, placeholder: '••••••' });
      if (pin !== pin2) { UI.toast('PIN tidak cocok', 'error'); return; }
      cryptoKey = await setupPIN(pin);
      lockEl.hide();
      scheduleAutoLock();
      fireReady();
    });
  }

  function bindUnlockHandler() {
    const lockEl = document.querySelector('lock-screen');
    if (!lockEl) return;
    
    lockEl.setMode('unlock');
    lockEl.onSubmit(async (pin) => {
      if (!pin) return;
      const key = await verifyPIN(pin);
      if (!key) { UI.toast('PIN salah', 'error'); lockEl.clear(); return; }
      cryptoKey = key;
      lockEl.hide();
      scheduleAutoLock();
      fireReady();
    });
  }

  async function init() {
    ['click', 'keydown', 'touchstart', 'pointerdown'].forEach(evt => {
      document.addEventListener(evt, () => { if (cryptoKey) scheduleAutoLock(); }, { passive: true });
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && cryptoKey) {
        setTimeout(() => { if (document.hidden && cryptoKey) lockApp(); }, HIDDEN_GRACE_MS);
      }
    });

    if (window.top !== window.self) {
      document.documentElement.innerHTML = 'Akses ditolak.';
      throw new Error('Framed');
    }

    const lockEl = document.querySelector('lock-screen');
    if (!(await hasPIN())) {
      if (!lockEl) return;
      lockEl.show();
      bindSetupHandler();
      return;
    }
    if (!lockEl) return;
    lockEl.show();
    bindUnlockHandler();
  }

  return {
    db,
    init,
    getKey: () => cryptoKey,
    lock: lockApp,
    isLocked,
    setOnReady
  };
})();

window.Auth = Auth;