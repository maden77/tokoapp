/* ============================================================
   SPA Router — History API
   ============================================================ */
'use strict';

const Router = (() => {

  // Daftar app — cukup tambah 1 baris di sini untuk app baru
  const ROUTES = {
    home:       { file: 'apps/home.js',       title: '🏪 Toko App' },
    catatan:    { file: 'apps/catatan.js',    title: '📝 Catatan' },
    kamera:     { file: 'apps/kamera.js',     title: '📷 Kamera' },
    kalkulator: { file: 'apps/kalkulator.js', title: '🧮 Kalkulator' },
    pesan:      { file: 'apps/pesan.js',      title: '💬 Pesan' },
    pengaturan: { file: 'apps/pengaturan.js', title: '⚙️ Pengaturan' }
  };

  const loadedModules = {};
  let currentApp = null;

  async function loadModule(name) {
    if (loadedModules[name]) return loadedModules[name];
    const route = ROUTES[name];
    if (!route) throw new Error('Unknown route: ' + name);
    
    const mod = await import('./' + route.file.replace('apps/', '../apps/'));
    loadedModules[name] = mod;
    return mod;
  }

  function getPath() {
    const hash = location.hash.replace(/^#\/?/, '');
    return hash || 'home';
  }

  function getTitle(app) {
    return ROUTES[app]?.title || 'App';
  }

  async function render() {
    const app = getPath();
    if (app === currentApp) return;
    currentApp = app;

    const root = document.getElementById('app-root');
    if (!root) return;

    // Kalau belum login (PIN belum di-setup / belum unlock), biarkan lock-screen yang handle
    if (Auth.isLocked() && app !== 'home') {
      // Tetap render halaman, lock-screen overlay akan menutup
    }

    // Update title
    document.title = getTitle(app);

    // Fade out
    root.style.opacity = '0';
    root.style.transition = 'opacity .15s';

    setTimeout(async () => {
      try {
        const mod = await loadModule(app);
        root.innerHTML = '';
        
        if (typeof mod.render === 'function') {
          const el = await mod.render();
          if (el) root.appendChild(el);
        }
      } catch (err) {
        console.error('Router render error:', err);
        root.innerHTML = `<div style="padding:40px; text-align:center; color:#f87171;">
          Terjadi kesalahan memuat <b>${app}</b><br>
          <small>${err.message}</small>
        </div>`;
      }
      
      // Fade in
      requestAnimationFrame(() => {
        root.style.opacity = '1';
      });
    }, 150);
  }

  function navigate(app, { replace = false } = {}) {
    const hash = '#/' + app;
    if (location.hash === hash) {
      render();
      return;
    }
    if (replace) {
      history.replaceState({ app }, '', hash);
      render();
    } else {
      history.pushState({ app }, '', hash);
      render();
    }
  }

  function back() {
    if (history.length > 1 && currentApp !== 'home') {
      history.back();
    } else {
      navigate('home');
    }
  }

  async function init() {
    // Set default hash
    if (!location.hash) {
      history.replaceState({ app: 'home' }, '', '#/home');
    }

    // Handle back/forward
    window.addEventListener('popstate', () => {
      currentApp = null;
      render();
    });

    // Init Auth dulu
    await Auth.init();

    // Auth akan panggil ready callback setelah unlock
    Auth.setOnReady(() => {
      // Ready! Render halaman
      render();
    });

    // Kalau sudah login (tidak locked), render langsung
    if (!Auth.isLocked()) {
      render();
    }
  }

  return { init, navigate, back };
})();

window.Router = Router;

// Auto init
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => Router.init());
} else {
  Router.init();
}