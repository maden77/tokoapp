/* ============================================================
   Home page logic
   ============================================================ */
(() => {
  'use strict';

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(err => {
        console.warn('SW registration failed:', err);
      });
    });
  }

  // ---- Install prompt ----
  let deferredPrompt;
  const btnInstall = document.getElementById('btnInstall');

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    btnInstall.classList.add('show');
  });

  btnInstall.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    btnInstall.classList.remove('show');
  });

  // ---- Search ----
  const search = document.getElementById('searchInput');
  if (search) {
    search.addEventListener('input', (e) => {
      const q = UI.sanitizeText(e.target.value, 100).toLowerCase();
      document.querySelectorAll('.app-card').forEach(card => {
        card.style.display = card.dataset.name.includes(q) ? 'flex' : 'none';
      });
    });
  }

  // ---- Anti clickjacking ----
  if (window.top !== window.self) {
    document.documentElement.innerHTML = 'Akses ditolak.';
    throw new Error('Framed');
  }
})();