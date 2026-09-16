/* ============================================================
   Web Components: <lock-screen>, <app-shell>
   ============================================================ */
'use strict';

// ============================================================
//   <lock-screen>
// ============================================================
class LockScreen extends HTMLElement {
  constructor() {
    super();
    this._mode = 'unlock';
    this._submitHandler = null;
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          position: fixed;
          inset: 0;
          background: #0f172a;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 20px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        :host([hidden]) { display: none !important; }
        .lock-box {
          width: 100%;
          max-width: 320px;
          text-align: center;
          color: #fff;
        }
        h2 { font-size: 22px; margin: 0 0 8px 0; }
        p { color: #94a3b8; font-size: 13px; margin: 0 0 20px 0; }
        input {
          width: 100%;
          padding: 16px;
          background: rgba(255,255,255,.06);
          border: 1px solid rgba(255,255,255,.1);
          border-radius: 12px;
          color: #fff;
          font-size: 24px;
          letter-spacing: 8px;
          text-align: center;
          outline: none;
          font-family: inherit;
          box-sizing: border-box;
        }
        input:focus { border-color: #6366f1; }
        button {
          margin-top: 16px;
          width: 100%;
          padding: 14px;
          background: linear-gradient(90deg, #6366f1, #a855f7);
          border: none;
          border-radius: 12px;
          color: #fff;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
        }
      </style>
      <div class="lock-box">
        <h2 id="title">🔒 Terkunci</h2>
        <p id="msg">Masukkan PIN untuk membuka</p>
        <input id="pin" type="password" inputmode="numeric" maxlength="12" autocomplete="off" placeholder="••••">
        <button id="btn">Buka</button>
      </div>
    `;

    this._input = this.shadowRoot.getElementById('pin');
    this._btn = this.shadowRoot.getElementById('btn');
    this._title = this.shadowRoot.getElementById('title');
    this._msg = this.shadowRoot.getElementById('msg');

    this._btn.addEventListener('click', () => this._submit());
    this._input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._submit();
    });

    this._applyMode();
  }

  _applyMode() {
    if (!this._title) return;
    if (this._mode === 'setup') {
      this._title.textContent = '🔐 Buat PIN';
      this._msg.textContent = 'PIN baru (min 6 digit) untuk mengenkripsi data';
      this._input.placeholder = 'PIN baru';
      this._btn.textContent = 'Buat PIN';
    } else {
      this._title.textContent = '🔒 Terkunci';
      this._msg.textContent = 'Masukkan PIN untuk membuka';
      this._input.placeholder = '••••';
      this._btn.textContent = 'Buka';
    }
  }

  setMode(mode) {
    this._mode = mode;
    this._applyMode();
  }

  onSubmit(handler) {
    this._submitHandler = handler;
  }

  _submit() {
    const val = this._input.value.trim();
    if (this._submitHandler) this._submitHandler(val);
  }

  clear() {
    if (this._input) this._input.value = '';
    this._input?.focus();
  }

  show() {
    this.hidden = false;
    setTimeout(() => this._input?.focus(), 50);
  }

  hide() {
    this.hidden = true;
  }
}

customElements.define('lock-screen', LockScreen);

// ============================================================
//   <app-shell> — wrapper topbar + content
// ============================================================
class AppShell extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    const title = this.getAttribute('title') || 'App';
    const showBack = this.getAttribute('no-back') === null;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: flex;
          flex-direction: column;
          flex: 1;
          min-height: 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .topbar {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 20px;
          padding-top: calc(16px + env(safe-area-inset-top, 0px));
          background: rgba(15,23,42,.95);
          backdrop-filter: blur(10px);
          position: sticky; top: 0; z-index: 10;
          border-bottom: 1px solid rgba(255,255,255,.1);
          flex-shrink: 0;
        }
        .back {
          background: rgba(255,255,255,.1);
          border: none;
          color: #fff;
          width: 38px; height: 38px;
          border-radius: 10px;
          font-size: 18px;
          cursor: pointer;
        }
        .back:hover { background: rgba(255,255,255,.15); }
        .back[hidden] { display: none; }
        h1 { font-size: 18px; color: #fff; margin: 0; flex: 1; }
        .content {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 0;
        }
      </style>
      <div class="topbar">
        <button class="back" ${showBack ? '' : 'hidden'} aria-label="Kembali">←</button>
        <h1>${title}</h1>
      </div>
      <div class="content">
        <slot></slot>
      </div>
    `;

    this.shadowRoot.querySelector('.back').addEventListener('click', () => {
      Router.back();
    });
  }
}

customElements.define('app-shell', AppShell);