/* ============================================================
  Kriptografi
   ============================================================ */
'use strict';

const CRYPTO = (() => {
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  const PBKDF2_ITER = 200_000;
  const SALT_LEN = 16;
  const IV_LEN = 12;
  const VERIFY_TOKEN = 'VERIFY_OK_v1';

  // ---- Base64 <-> ArrayBuffer ----
  function bufToB64(buf) {
    const bytes = new Uint8Array(buf);
    let bin = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(bin);
  }

  function b64ToBuf(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }

  // ---- Derive Key ----
  async function deriveKey(password, salt) {
    const baseKey = await crypto.subtle.importKey(
      'raw', enc.encode(password),
      { name: 'PBKDF2' }, false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: PBKDF2_ITER, hash: 'SHA-256' },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async function createSalt() {
    return crypto.getRandomValues(new Uint8Array(SALT_LEN));
  }

  // ---- Encrypt / Decrypt String ----
  async function encrypt(key, plaintext) {
    const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
    const data = typeof plaintext === 'string' ? enc.encode(plaintext) : plaintext;
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
    const combined = new Uint8Array(iv.byteLength + cipher.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(cipher), iv.byteLength);
    return bufToB64(combined);
  }

  async function decrypt(key, payload) {
    const raw = new Uint8Array(b64ToBuf(payload));
    const iv = raw.subarray(0, IV_LEN);
    const data = raw.subarray(IV_LEN);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
    return dec.decode(plain);
  }

  // ---- PIN Verifier ----
  async function makeVerifier(key) {
    return encrypt(key, VERIFY_TOKEN);
  }

  async function checkVerifier(key, verifier) {
    try {
      const v = await decrypt(key, verifier);
      return v === VERIFY_TOKEN;
    } catch {
      return false;
    }
  }

  // ---- Encrypt / Decrypt Blob (Foto) ----
  async function encryptBlob(key, blob) {
    const buf = await blob.arrayBuffer();
    const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, buf);
    const combined = new Uint8Array(iv.byteLength + cipher.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(cipher), iv.byteLength);
    return new Blob([combined], { type: 'application/octet-stream' });
  }

  async function decryptBlob(key, blob) {
    const buf = await blob.arrayBuffer();
    const raw = new Uint8Array(buf);
    const iv = raw.subarray(0, IV_LEN);
    const data = raw.subarray(IV_LEN);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
    return new Blob([plain], { type: 'image/jpeg' });
  }

  return {
    deriveKey, createSalt,
    encrypt, decrypt,
    encryptBlob, decryptBlob,
    makeVerifier, checkVerifier,
    bufToB64, b64ToBuf
  };
})();

window.CRYPTO = CRYPTO;