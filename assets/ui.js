/* ============================================================
   Helper UI: sanitasi, toast, modal, download
   ============================================================ */
'use strict';

const UI = (() => {
  const ESCAPE_MAP = {
    '&': '&amp;', '<': '&lt;', '>': '&gt;',
    '"': '&quot;', "'": '&#39;', '/': '&#x2F;'
  };

  function escapeHtml(str) {
    return String(str).replace(/[&<>"'/]/g, m => ESCAPE_MAP[m]);
  }

  function sanitizeText(str, maxLen = 5000) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .slice(0, maxLen)
      .trim();
  }

  // ---- Toast ----
  let toastTimer;
  function toast(message, type = 'info', duration = 3000) {
    let el = document.getElementById('__toast');
    if (!el) {
      el = document.createElement('div');
      el.id = '__toast';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    const colors = { info: '#334155', success: '#16a34a', error: '#dc2626', warn: '#f59e0b' };
    el.textContent = message;
    el.style.cssText = `
      position:fixed; left:50%; bottom:24px; transform:translate(-50%, 20px);
      background:${colors[type] || colors.info}; color:#fff;
      padding:12px 20px; border-radius:12px; font-size:14px;
      z-index:99999; box-shadow:0 10px 30px rgba(0,0,0,.4);
      max-width:90vw; text-align:center; opacity:0;
      transition:opacity .2s, transform .2s; pointer-events:none;
    `;
    requestAnimationFrame(() => {
      el.style.opacity = '1';
      el.style.transform = 'translate(-50%, 0)';
    });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translate(-50%, 20px)';
    }, duration);
  }

  // ---- Confirm dialog ----
  function confirmDialog(message) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position:fixed; inset:0; background:rgba(0,0,0,.6);
        display:flex; align-items:center; justify-content:center;
        z-index:99998; padding:20px;
      `;
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');

      const box = document.createElement('div');
      box.style.cssText = `
        background:#1e293b; border:1px solid rgba(255,255,255,.1);
        border-radius:16px; padding:20px; max-width:340px; width:100%;
        color:#fff; box-shadow:0 20px 60px rgba(0,0,0,.5);
      `;
      box.innerHTML = `
        <p style="font-size:15px; line-height:1.5; margin-bottom:18px;">${escapeHtml(message)}</p>
        <div style="display:flex; gap:10px;">
          <button data-role="no"  style="flex:1; padding:12px; border-radius:10px; border:1px solid rgba(255,255,255,.15); background:transparent; color:#fff; font-size:14px; cursor:pointer;">Batal</button>
          <button data-role="yes" style="flex:1; padding:12px; border-radius:10px; border:none; background:#dc2626; color:#fff; font-size:14px; font-weight:600; cursor:pointer;">Ya</button>
        </div>
      `;
      overlay.appendChild(box);
      document.body.appendChild(overlay);

      const yes = box.querySelector('[data-role="yes"]');
      const no  = box.querySelector('[data-role="no"]');
      yes.focus();

      function close(val) {
        overlay.remove();
        document.removeEventListener('keydown', onKey);
        resolve(val);
      }
      function onKey(e) {
        if (e.key === 'Escape') close(false);
        if (e.key === 'Enter') close(true);
      }
      yes.addEventListener('click', () => close(true));
      no.addEventListener('click', () => close(false));
      overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
      document.addEventListener('keydown', onKey);
    });
  }

  // ---- Prompt dialog (pengganti window.prompt, aman dari CSP) ----
  function promptDialog(message, { placeholder = '', type = 'text', minLen = 0 } = {}) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position:fixed; inset:0; background:rgba(0,0,0,.6);
        display:flex; align-items:center; justify-content:center;
        z-index:99998; padding:20px;
      `;
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');

      const box = document.createElement('div');
      box.style.cssText = `
        background:#1e293b; border:1px solid rgba(255,255,255,.1);
        border-radius:16px; padding:20px; max-width:340px; width:100%;
        color:#fff; box-shadow:0 20px 60px rgba(0,0,0,.5);
      `;
      box.innerHTML = `
        <p style="font-size:15px; line-height:1.5; margin-bottom:14px;">${escapeHtml(message)}</p>
        <input data-role="input" type="${type}" placeholder="${escapeHtml(placeholder)}"
               autocomplete="off" style="
          width:100%; padding:12px 14px; border-radius:10px;
          border:1px solid rgba(255,255,255,.15);
          background:rgba(255,255,255,.06); color:#fff;
          font-size:16px; outline:none; font-family:inherit;
        ">
        <div style="display:flex; gap:10px; margin-top:16px;">
          <button data-role="no"  style="flex:1; padding:12px; border-radius:10px; border:1px solid rgba(255,255,255,.15); background:transparent; color:#fff; font-size:14px; cursor:pointer;">Batal</button>
          <button data-role="yes" style="flex:1; padding:12px; border-radius:10px; border:none; background:#6366f1; color:#fff; font-size:14px; font-weight:600; cursor:pointer;">OK</button>
        </div>
      `;
      overlay.appendChild(box);
      document.body.appendChild(overlay);

      const input = box.querySelector('[data-role="input"]');
      const yes = box.querySelector('[data-role="yes"]');
      const no  = box.querySelector('[data-role="no"]');
      input.focus();

      function close(val) {
        overlay.remove();
        document.removeEventListener('keydown', onKey);
        resolve(val);
      }
      function submit() {
        const v = input.value.trim();
        if (minLen && v.length < minLen) {
          input.style.borderColor = '#dc2626';
          return;
        }
        close(v);
      }
      function onKey(e) {
        if (e.key === 'Escape') close(null);
        if (e.key === 'Enter') submit();
      }
      yes.addEventListener('click', submit);
      no.addEventListener('click', () => close(null));
      overlay.addEventListener('click', (e) => { if (e.target === overlay) close(null); });
      document.addEventListener('keydown', onKey);
    });
  }

  // ---- Download file ----
  function downloadFile(filename, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  return { escapeHtml, sanitizeText, toast, confirmDialog, promptDialog, downloadFile };
})();

window.UI = UI;