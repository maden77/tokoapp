/* ============================================================
   Home — daftar app
   ============================================================ */
'use strict';

export async function render() {
  const page = document.createElement('div');
  page.className = 'page';

  page.innerHTML = `
    <div class="home-header">
      <h1>🏪 Toko App</h1>
      <p>Aplikasi lokal-first, aman & offline</p>
    </div>

    <input class="search" type="search" placeholder="🔍 Cari aplikasi..." id="searchInput"
           aria-label="Cari aplikasi" autocomplete="off">

    <div class="section-title">Semua Aplikasi</div>

    <main class="app-list" id="appList" role="list">
      <a class="app-card" data-app="catatan" data-name="catatan" role="listitem">
        <div class="app-icon icon-catatan">📝</div>
        <div class="app-info">
          <h3>Catatan</h3>
          <p>Terenkripsi AES-256 • PIN lock</p>
          <div class="app-rating">⭐ 4.9 • Gratis</div>
        </div>
      </a>

      <a class="app-card" data-app="kalkulator" data-name="kalkulator" role="listitem">
        <div class="app-icon icon-kalkulator">🧮</div>
        <div class="app-info">
          <h3>Kalkulator</h3>
          <p>Hitung & simpan riwayat</p>
          <div class="app-rating">⭐ 4.9 • Gratis</div>
        </div>
      </a>

      <a class="app-card" data-app="pesan" data-name="pesan" role="listitem">
        <div class="app-icon icon-pesan">💬</div>
        <div class="app-info">
          <h3>Pesan</h3>
          <p>Chat, emoji, suara & panggilan</p>
          <div class="app-rating">⭐ 4.9 • Gratis</div>
        </div>
      </a>

      <a class="app-card" data-app="kamera" data-name="kamera" role="listitem">
        <div class="app-icon icon-kamera">📷</div>
        <div class="app-info">
          <h3>Kamera</h3>
          <p>Terenkripsi • Simpan lokal</p>
          <div class="app-rating">⭐ 4.8 • Gratis</div>
        </div>
      </a>

      <a class="app-card" data-app="pengaturan" data-name="pengaturan" role="listitem">
        <div class="app-icon icon-setting">⚙️</div>
        <div class="app-info">
          <h3>Pengaturan</h3>
          <p>Backup, restore & keamanan</p>
          <div class="app-rating">🔒 Lokal</div>
        </div>
      </a>
    </main>

    <button class="btn-install" id="btnInstall" aria-label="Install aplikasi">📥 Install Toko App</button>
  `;

  // Register SW
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // Install prompt
  let deferredPrompt;
  const btnInstall = page.querySelector('#btnInstall');
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

  // Navigate to app
  page.querySelectorAll('.app-card').forEach(card => {
    card.addEventListener('click', () => {
      Router.navigate(card.dataset.app);
    });
  });

  // Search
  page.querySelector('#searchInput').addEventListener('input', (e) => {
    const q = UI.sanitizeText(e.target.value, 100).toLowerCase();
    page.querySelectorAll('.app-card').forEach(card => {
      card.style.display = card.dataset.name.includes(q) ? 'flex' : 'none';
    });
  });

  return page;
}