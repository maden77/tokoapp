'use strict';

let currentStream = null;

function stopCamera() {
  if (currentStream) {
    currentStream.getTracks().forEach(t => t.stop());
    currentStream = null;
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
      c.toBlob(b => b ? resolve(b) : reject(new Error('compress fail')), 'image/jpeg', quality);
    };
    img.onerror = reject;
    img.src = url;
  });
}

export async function render() {
  const shell = document.createElement('app-shell');
  shell.setAttribute('title', '📷 Kamera');

  const container = document.createElement('div');
  container.className = 'page-container';
  container.innerHTML = `
    <div class="video-wrap">
      <video id="video" autoplay playsinline muted aria-label="Preview kamera"></video>
    </div>
    <button class="cam-btn" id="btnCapture" disabled>⏳ Menyiapkan kamera...</button>
    <div class="gallery-title">Galeri Foto (terenkripsi)</div>
    <div class="gallery" id="gallery"></div>
  `;
  shell.appendChild(container);

  const db = Auth.db;
  const $ = (s) => container.querySelector(s);

  const video = $('#video');
  const gallery = $('#gallery');
  const btnCapture = $('#btnCapture');
  const canvas = document.createElement('canvas');

  async function startCamera() {
    stopCamera();
    try {
      currentStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1920 } },
        audio: false
      });
      video.srcObject = currentStream;
      btnCapture.disabled = false;
      btnCapture.textContent = '📸 Ambil Foto';
    } catch (err) {
      console.error('Camera error', err);
      btnCapture.textContent = '❌ Kamera tidak tersedia';
      UI.toast('Kamera tidak dapat diakses', 'error');
    }
  }

  async function renderGallery() {
    if (gallery._objectUrls) gallery._objectUrls.forEach(u => URL.revokeObjectURL(u));

    const photos = await db.photos.orderBy('date').reverse().limit(50).toArray();
    if (!photos.length) {
      gallery.innerHTML = '<div class="empty" style="grid-column:1/-1;">Belum ada foto</div>';
      gallery._objectUrls = [];
      return;
    }

    const urls = [];
    const items = await Promise.all(photos.map(async p => {
      try {
        const blob = await CRYPTO.decryptBlob(Auth.getKey(), p.blob);
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
        const encryptedBlob = await CRYPTO.encryptBlob(Auth.getKey(), compressed);
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
  return shell;
}

export function destroy() {
  stopCamera();
}