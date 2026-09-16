'use strict';

export async function render() {
  const shell = document.createElement('app-shell');
  shell.setAttribute('title', '⚙️ Pengaturan');

  const container = document.createElement('div');
  container.className = 'page-container';
  container.innerHTML = `
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
  `;
  shell.appendChild(container);

  const db = Auth.db;
  const $ = (s) => container.querySelector(s);

  $('#btnLockNow').addEventListener('click', () => Auth.lock());

  // ---- Ganti PIN ----
  $('#btnChangePIN').addEventListener('click', async () => {
    const oldPin = await UI.promptDialog('Masukkan PIN lama:', { type: 'password', minLen: 6, placeholder: '••••••' });
    if (!oldPin) return;

    const rec = await db.meta.get('pin');
    if (!rec) return;
    const salt = new Uint8Array(CRYPTO.b64ToBuf(rec.salt));
    const oldKey = await CRYPTO.deriveKey(oldPin, salt);
    const ok = await CRYPTO.checkVerifier(oldKey, rec.verifier);
    if (!ok) { UI.toast('PIN lama salah', 'error'); return; }

    const newPin = await UI.promptDialog('Masukkan PIN baru (min 6 digit):', { type: 'password', minLen: 6, placeholder: '••••••' });
    if (!newPin) return;

    const confirmPin = await UI.promptDialog('Konfirmasi PIN baru:', { type: 'password', minLen: 6, placeholder: '••••••' });
    if (newPin !== confirmPin) { UI.toast('PIN tidak cocok', 'error'); return; }

    try {
      const newSalt = await CRYPTO.createSalt();
      const newKey = await CRYPTO.deriveKey(newPin, newSalt);
      const verifier = await CRYPTO.makeVerifier(newKey);

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
      const messages = await db.messages.toArray();
      for (const m of messages) {
        const text = await CRYPTO.decrypt(oldKey, m.cipher);
        m.cipher = await CRYPTO.encrypt(newKey, text);
        if (m.blob) {
          const blob = await CRYPTO.decryptBlob(oldKey, m.blob);
          m.blob = await CRYPTO.encryptBlob(newKey, blob);
        }
        await db.messages.put(m);
      }

      await db.meta.put({ key: 'pin', salt: CRYPTO.bufToB64(newSalt), verifier });
      UI.toast('PIN berhasil diubah', 'success');
    } catch (err) {
      console.error(err);
      UI.toast('Gagal mengubah PIN', 'error');
    }
  });

  // ---- Backup ----
  $('#btnBackup').addEventListener('click', async () => {
    try {
      const notes = await db.notes.toArray();
      const rawPhotos = await db.photos.toArray();
      const photos = await Promise.all(rawPhotos.map(async p => ({
        date: p.date, data: CRYPTO.bufToB64(await p.blob.arrayBuffer())
      })));

      const rawMsgs = await db.messages.toArray();
      const messages = await Promise.all(rawMsgs.map(async m => {
        const obj = { date: m.date, type: m.type, cipher: m.cipher, from: m.from };
        if (m.blob) obj.blobData = CRYPTO.bufToB64(await m.blob.arrayBuffer());
        return obj;
      }));

      const meta = await db.meta.toArray();
      const payload = { v: 1, exportedAt: new Date().toISOString(), meta, notes, photos, messages };

      const cipher = await CRYPTO.encrypt(Auth.getKey(), JSON.stringify(payload));
      const blob = new Blob([cipher], { type: 'application/octet-stream' });
      UI.downloadFile(`tokoapp-backup-${Date.now()}.tokobak`, blob);
      UI.toast('Backup terunduh', 'success');
    } catch (err) {
      console.error(err);
      UI.toast('Gagal membuat backup', 'error');
    }
  });

  // ---- Restore ----
  $('#fileImport').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const cipher = await file.text();
      const json = await CRYPTO.decrypt(Auth.getKey(), cipher);
      const payload = JSON.parse(json);

      const ok = await UI.confirmDialog('Import akan MENGGANTI semua data saat ini. Lanjut?');
      if (!ok) { e.target.value = ''; return; }

      await db.transaction('rw', db.notes, db.photos, db.meta, db.messages, async () => {
        await db.notes.clear();
        await db.photos.clear();
        await db.meta.clear();
        await db.messages.clear();

        for (const n of payload.notes) await db.notes.add(n);
        for (const p of payload.photos) {
          const bin = CRYPTO.b64ToBuf(p.data);
          await db.photos.add({ blob: new Blob([bin]), date: p.date });
        }
        if (payload.messages) {
          for (const m of payload.messages) {
            const rec = { date: m.date, type: m.type, cipher: m.cipher, from: m.from };
            if (m.blobData) {
              const bin = CRYPTO.b64ToBuf(m.blobData);
              rec.blob = new Blob([bin], { type: 'application/octet-stream' });
            }
            await db.messages.add(rec);
          }
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

  // ---- Wipe ----
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

  return shell;
}