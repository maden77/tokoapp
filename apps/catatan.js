'use strict';

let currentPage = null;

export async function render() {
  const shell = document.createElement('app-shell');
  shell.setAttribute('title', '📝 Catatan');
  shell.setAttribute('no-back', ''); // no-back = tampil, biarkan default

  const container = document.createElement('div');
  container.className = 'page-container';
  container.innerHTML = `
    <textarea class="note-input" id="noteInput"
      placeholder="Tulis catatan (akan dienkripsi)..."
      maxlength="5000" aria-label="Isi catatan"></textarea>
    <button class="btn" id="btnSimpan">💾 Simpan (Terenkripsi)</button>
    <div class="notes-list" id="notesList" aria-live="polite"></div>
  `;
  shell.appendChild(container);

  const db = Auth.db;
  const input = container.querySelector('#noteInput');
  const list = container.querySelector('#notesList');

  async function renderList() {
    const notes = await db.notes.orderBy('date').reverse().toArray();
    if (!notes.length) {
      list.innerHTML = '<div class="empty">Belum ada catatan</div>';
      return;
    }
    const decrypted = await Promise.all(notes.map(async n => {
      try {
        const text = await CRYPTO.decrypt(Auth.getKey(), n.cipher);
        return { ...n, text };
      } catch {
        return { ...n, text: '⚠️ Gagal dekripsi' };
      }
    }));

    list.innerHTML = decrypted.map(n => `
      <div class="note-item">
        <p>${UI.escapeHtml(n.text)}</p>
        <small>${UI.escapeHtml(new Date(n.date).toLocaleString('id-ID'))}</small>
        <button class="note-delete" data-id="${n.id}" aria-label="Hapus">✕</button>
      </div>
    `).join('');

    list.querySelectorAll('.note-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ok = await UI.confirmDialog('Hapus catatan ini?');
        if (!ok) return;
        await db.notes.delete(Number(btn.dataset.id));
        UI.toast('Catatan dihapus', 'success');
        renderList();
      });
    });
  }

  container.querySelector('#btnSimpan').addEventListener('click', async () => {
    const text = UI.sanitizeText(input.value, 5000);
    if (!text) { UI.toast('Catatan kosong', 'warn'); return; }

    try {
      const cipher = await CRYPTO.encrypt(Auth.getKey(), text);
      await db.notes.add({ cipher, date: new Date().toISOString() });
      input.value = '';
      UI.toast('Catatan disimpan & terenkripsi', 'success');
      renderList();
    } catch (err) {
      console.error(err);
      UI.toast('Gagal menyimpan catatan', 'error');
    }
  });

  renderList();
  currentPage = shell;
  return shell;
}

export function destroy() {
  currentPage = null;
}