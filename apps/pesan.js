/* ============================================================
   Apps/Pesan — Chat, Emoji, Suara, Panggilan (SPA Module)
   ============================================================ */
'use strict';

// ---------- PeerJS loader ----------
let peerReady = null;
function loadPeerJS() {
  if (window.Peer) return Promise.resolve();
  if (peerReady) return peerReady;
  peerReady = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('PeerJS load failed'));
    document.head.appendChild(script);
  });
  return peerReady;
}

// ---------- Emoji data ----------
const EMOJI_DATA = {
  smileys: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶','🥴','😵','🤯','🤠','🥳','😎','🤓','🧐','😕','😟','🙁','☹️','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖'],
  gestures: ['👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦾','🦿','🦵','🦶','👂','🦻','👃','🧠','🫀','🫁','🦷','🦴','👀','👁️','👅','👄','💋','🩸'],
  hearts: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','♥️','💌','💋','😻','💐','🌹','🥀','🌺','🌷','🌼','🌸'],
  animals: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐒','🐔','🐧','🐦','🐤','🐣','🐥','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🐛','🦋','🐌','🐞','🐜','🦟','🦗','🕷️','🦂','🐢','🐍','🦎','🦖','🦕','🐙','🦑','🦐','🦞','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈','🐊','🐅','🐆','🦓','🦍','🦧','🐘','🦛','🦏','🐪','🐫','🦒','🦘','🐃','🐂','🐄','🐎','🐖','🐏','🐑','🦙','🐐','🦌','🐕','🐩','🦮','🐕‍🦺','🐈','🐈‍⬛','🪶','🐓','🦃','🦚','🦜','🦢','🦩','🕊️','🐇','🦝','🦨','🦡','🦦','🦥','🐁','🐀','🐿️','🦔'],
  food: ['🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑','🥦','🥬','🥒','🌶️','🫑','🌽','🥕','🫒','🧄','🧅','🥔','🍠','🥐','🥯','🍞','🥖','🥨','🧀','🥚','🍳','🧈','🥞','🧇','🥓','🥩','🍗','🍖','🦴','🌭','🍔','🍟','🍕','🫓','🥪','🥙','🧆','🌮','🌯','🫔','🥗','🥘','🫕','🥫','🍝','🍜','🍲','🍛','🍣','🍱','🥟','🦪','🍤','🍙','🍚','🍘','🍥','🥠','🥮','🍢','🍡','🍧','🍨','🍦','🥧','🧁','🍰','🎂','🍮','🍭','🍬','🍫','🍿','🍩','🍪','🌰','🥜','🍯','🥛','🍼','🫖','☕','🍵','🧃','🥤','🧋','🍶','🍺','🍻','🥂','🍷','🥃','🍸','🍹','🧉','🍾'],
  activities: ['⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🪀','🏓','🏸','🏒','🏑','🥍','🏏','🪃','🥅','⛳','🪁','🏹','🎣','🤿','🥊','🥋','🎽','🛹','🛼','🛷','⛸️','🥌','🎿','⛷️','🏂','🪂','🏋️','🤼','🤸','⛹️','🤺','🤾','🏌️','🏇','🧘','🏄','🏊','🤽','🚣','🧗','🚵','🚴','🏆','🥇','🥈','🥉','🏅','🎖️','🏵️','🎗️','🎫','🎟️','🎪','🤹','🎭','🩰','🎨','🎬','🎤','🎧','🎼','🎹','🥁','🪘','🎷','🎺','🪗','🎸','🪕','🎻','🎲','♟️','🎯','🎳','🎮','🎰','🧩'],
  objects: ['⌚','📱','📲','💻','⌨️','🖥️','🖨️','🖱️','🖲️','🕹️','🗜️','💽','💾','💿','📀','📼','📷','📸','📹','🎥','📽️','🎞️','📞','☎️','📟','📠','📺','📻','🎙️','🎚️','🎛️','🧭','⏱️','⏲️','⏰','🕰️','⌛','⏳','📡','🔋','🔌','💡','🔦','🕯️','🪔','🧯','🛢️','💸','💵','💴','💶','💷','🪙','💰','💳','💎','⚖️','🪜','🧰','🪛','🔧','🔨','⚒️','🛠️','⛏️','🪚','🔩','⚙️','🪤','🧱','⛓️','🧲','🔫','💣','🧨','🪓','🔪','🗡️','⚔️','🛡️','🚬','⚰️','🪦','⚱️','🏺','🔮','📿','🧿','💈','⚗️','🔭','🔬','🕳️','🩹','🩺','💊','💉','🩸','🧬','🦠','🧫','🧪','🌡️','🧹','🧺','🧻','🚽','🚰','🚿','🛁','🛀','🧼','🪥','🪒','🧽','🪣','🧴','🛎️','🔑','🗝️','🚪','🪑','🛋️','🛏️','🛌','🧸','🪆','🖼️','🪞','🪟','🛍️','🛒','🎁','🎈','🎏','🎀','🪄','🪅','🎊','🎉','🎎','🏮','🎐','🧧','✉️','📩','📨','📧','💌','📥','📤','📦','🏷️','📪','📫','📬','📭','📮','📯','📜','📃','📄','📑','🧾','📊','📈','📉','🗒️','🗓️','📆','📅','🗑️','📇','🗃️','🗳️','🗄️','📋','📁','📂','🗂️','🗞️','📰','📓','📔','📒','📕','📗','📘','📙','📚','📖','🔖','🧷','🔗','📎','🖇️','📐','📏','🧮','📌','📍','✂️','🖊️','🖋️','✒️','🖌️','🖍️','📝','✏️','🔍','🔎','🔏','🔐','🔒','🔓'],
  symbols: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','☮️','✝️','☪️','🕉️','☸️','✡️','🔯','🕎','☯️','☦️','🛐','⛎','♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓','🆔','⚛️','🉑','☢️','☣️','📴','📳','🈶','🈚','🈸','🈺','🈷️','✴️','🆚','💮','🉐','㊙️','㊗️','🈴','🈵','🈹','🈲','🅰️','🅱️','🆎','🆑','🅾️','🆘','❌','⭕','🛑','⛔','📛','🚫','💯','💢','♨️','🚷','🚯','🚳','🚱','🔞','📵','🚭','❗','❕','❓','❔','‼️','⁉️','🔅','🔆','〽️','⚠️','🚸','🔱','⚜️','🔰','♻️','✅','🈯','💹','❇️','✳️','❎','🌐','💠','Ⓜ️','🌀','💤','🏧','🚾','♿','🅿️','🈳','🈂️','🛂','🛃','🛄','🛅','🚹','🚺','🚼','🚻','🚮','🎦','📶','🈁','🔣','ℹ️','🔤','🔡','🔠','🆖','🆗','🆙','🆒','🆕','🆓','0️⃣','1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟','🔢','#️⃣','*️⃣','⏏️','▶️','⏸️','⏯️','⏹️','⏺️','⏭️','⏮️','⏩','⏪','⏫','⏬','◀️','🔼','🔽','➡️','⬅️','⬆️','⬇️','↗️','↘️','↙️','↖️','↕️','↔️','↪️','↩️','⤴️','⤵️','🔀','🔁','🔂','🔄','🔃','🎵','🎶','➕','➖','➗','✖️','♾️','💲','💱','™️','©️','®️','〰️','➰','➿','🔚','🔙','🔛','🔝','🔜','✔️','☑️','🔘','🔴','🟠','🟡','🟢','🔵','🟣','⚫','⚪','🟤','🔺','🔻','🔸','🔹','🔶','🔷','🔳','🔲','▪️','▫️','◾','◽','◼️','◻️','🟥','🟧','🟨','🟩','🟦','🟪','⬛','⬜','🟫','🔈','🔇','🔉','🔊','🔔','🔕','📣','📢','💬','💭','🗯️','♠️','♣️','♥️','♦️','🃏','🎴','🀄','🕐','🕑','🕒','🕓','🕔','🕕','🕖','🕗','🕘','🕙','🕚','🕛'],
  flags: ['🏁','🚩','🎌','🏴','🏳️','🏳️‍🌈','🏳️‍⚧️','🏴‍☠️','🇮🇩','🇲🇾','🇸🇬','🇹🇭','🇻🇳','🇵🇭','🇺🇸','🇬🇧','🇯🇵','🇰🇷','🇨🇳','🇮🇳','🇦🇺','🇨🇦','🇩🇪','🇫🇷','🇮🇹','🇪🇸','🇧🇷','🇲🇽','🇳🇱','🇸🇦','🇦🇪','🇪🇬','🇹🇷','🇷🇺','🇿🇦','🇳🇬','🇰🇪','🇦🇷','🇨🇱','🇵🇪']
};

const STICKERS = ['❤️','😍','😂','🤣','👍','🙏','🎉','🔥','💯','✨','😎','🥳','😭','🤔','👏','💪','🌟','🎁','🍕','☕','🐶','🐱','🌈','⚡','💎','🎵','🍀','🌺','🦋','👑'];

const EMOJI_TABS = [
  { id: 'smileys', label: '😀' },
  { id: 'gestures', label: '👋' },
  { id: 'hearts', label: '❤️' },
  { id: 'animals', label: '🐶' },
  { id: 'food', label: '🍕' },
  { id: 'activities', label: '⚽' },
  { id: 'objects', label: '📱' },
  { id: 'symbols', label: '💯' },
  { id: 'flags', label: '🏁' },
  { id: 'stickers', label: '🎨' }
];

// ---------- State (per render) ----------
let currentStream = null;      // call stream
let peer = null;
let activeCall = null;
let remoteAudio = null;
let isMuted = false;

let mediaRecorder = null;
let recordedChunks = [];
let recording = false;
let recInterval = null;
let recSeconds = 0;

let keydownHandler = null;
let outsideClickHandler = null;
let visibilityHandler = null;

// ---------- Helper: format ----------
function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function stopCurrentStream() {
  if (currentStream) {
    currentStream.getTracks().forEach(t => t.stop());
    currentStream = null;
  }
}

function stopRecordingInternal() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    try { mediaRecorder.stop(); } catch {}
  }
  recording = false;
  clearInterval(recInterval);
}

function closeCall() {
  if (activeCall) {
    try { activeCall.close(); } catch {}
    activeCall = null;
  }
  stopCurrentStream();
  if (remoteAudio) {
    try { remoteAudio.pause(); remoteAudio.srcObject = null; } catch {}
    remoteAudio = null;
  }
  isMuted = false;
}

function destroyPeer() {
  closeCall();
  if (peer) {
    try { peer.destroy(); } catch {}
    peer = null;
  }
}

// ============================================================
//   MAIN RENDER
// ============================================================
export async function render() {
  const db = Auth.db;

  // ---------- Shell ----------
  const shell = document.createElement('app-shell');
  shell.setAttribute('title', '💬 Pesan');
  shell.setAttribute('no-back', '');  // tampilkan tombol kembali

  // ---------- Page ----------
  const page = document.createElement('div');
  page.className = 'chat-page';
  page.style.flex = '1';
  page.style.display = 'flex';
  page.style.flexDirection = 'column';
  page.style.minHeight = '0';

  page.innerHTML = `
    <div class="chat-header">
      <div class="contact-info">
        <div class="contact-avatar" aria-hidden="true">👤</div>
        <div class="contact-meta">
          <div class="contact-name" id="contactName">Kontak</div>
          <div class="contact-status" id="contactStatus">online</div>
        </div>
      </div>
      <button class="header-btn" id="btnCall" aria-label="Panggilan Suara">📞</button>
    </div>

    <div class="messages" id="messages"></div>

    <div class="recording-bar" id="recordingBar" hidden>
      <div class="rec-dot"></div>
      <span id="recTime">0:00</span>
      <span style="margin-left:auto; font-size:12px;">Rekam suara...</span>
    </div>

    <div class="input-area" style="position:relative;">
      <button class="input-btn" id="btnEmoji" aria-label="Emoji">😊</button>
      <textarea class="chat-input" id="chatInput"
                placeholder="Ketik pesan..." rows="1"
                aria-label="Isi pesan"></textarea>
      <button class="input-btn" id="btnMic" aria-label="Pesan Suara">🎤</button>
      <button class="input-btn send" id="btnSend" aria-label="Kirim">➤</button>

      <div class="emoji-picker" id="emojiPicker">
        <div class="emoji-tabs" id="emojiTabs"></div>
        <div class="emoji-grid" id="emojiGrid"></div>
      </div>
    </div>
  `;
  shell.appendChild(page);

  // ---------- Call modal (di dalam page juga, karena modal fixed) ----------
  const callModal = document.createElement('div');
  callModal.id = 'callModal';
  callModal.className = 'call-modal';
  callModal.hidden = true;
  callModal.innerHTML = `
    <div style="text-align:center;">
      <div class="call-avatar">👤</div>
      <div class="call-name" id="callName">Kontak</div>
      <div class="call-status" id="callStatus">Memanggil...</div>
    </div>
    <div class="call-actions">
      <button class="call-btn mute" id="btnMute" aria-label="Mute">🎤</button>
      <button class="call-btn end" id="btnEndCall" aria-label="Tutup">📵</button>
    </div>
  `;
  page.appendChild(callModal);

  // ---------- Query elements ----------
  const $ = (s) => page.querySelector(s);

  const messages = $('#messages');
  const chatInput = $('#chatInput');
  const btnSend = $('#btnSend');
  const btnEmoji = $('#btnEmoji');
  const btnMic = $('#btnMic');
  const btnCall = $('#btnCall');
  const emojiPicker = $('#emojiPicker');
  const emojiTabs = $('#emojiTabs');
  const emojiGrid = $('#emojiGrid');
  const recordingBar = $('#recordingBar');
  const recTime = $('#recTime');
  const contactName = $('#contactName');
  const contactStatus = $('#contactStatus');
  const callName = $('#callName');
  const callStatus = $('#callStatus');
  const btnMute = $('#btnMute');
  const btnEndCall = $('#btnEndCall');

  // ---------- Room ID ----------
  let roomId = localStorage.getItem('chatRoomId');
  if (!roomId) {
    roomId = 'room_' + Math.random().toString(36).substring(2, 10);
    localStorage.setItem('chatRoomId', roomId);
  }
  const PEER_ID = 'tokoapp_' + roomId;

  contactName.textContent = 'Kontak';
  contactStatus.textContent = 'ID: ' + PEER_ID.slice(-6);

  // ---------- Emoji picker ----------
  let emojiTab = 'smileys';

  function renderEmojiTabs() {
    emojiTabs.innerHTML = EMOJI_TABS.map(t =>
      `<button class="emoji-tab${t.id === emojiTab ? ' active' : ''}" data-tab="${t.id}">${t.label}</button>`
    ).join('');
    emojiTabs.querySelectorAll('.emoji-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        emojiTab = btn.dataset.tab;
        renderEmojiTabs();
        renderEmojiGrid();
      });
    });
  }

  function renderEmojiGrid() {
    if (emojiTab === 'stickers') {
      emojiGrid.innerHTML = STICKERS.map(s =>
        `<button class="emoji-item sticker" data-sticker="${s}">${s}</button>`
      ).join('');
      emojiGrid.querySelectorAll('[data-sticker]').forEach(btn => {
        btn.addEventListener('click', () => {
          sendSticker(btn.dataset.sticker);
          toggleEmojiPicker(false);
        });
      });
    } else {
      const list = EMOJI_DATA[emojiTab] || [];
      emojiGrid.innerHTML = list.map(e =>
        `<button class="emoji-item" data-emoji="${e}">${e}</button>`
      ).join('');
      emojiGrid.querySelectorAll('[data-emoji]').forEach(btn => {
        btn.addEventListener('click', () => {
          chatInput.value += btn.dataset.emoji;
          chatInput.focus();
        });
      });
    }
  }

  function toggleEmojiPicker(show) {
    if (show === undefined) show = !emojiPicker.classList.contains('show');
    emojiPicker.classList.toggle('show', show);
  }

  // ---------- Messages ----------
  async function renderMessages() {
    const list = await db.messages.orderBy('date').toArray();

    if (!list.length) {
      messages.innerHTML = `
        <div class="empty-chat" style="margin:auto; text-align:center; color:#94a3b8; padding:40px 20px;">
          <span style="font-size:64px; display:block; margin-bottom:12px;">💬</span>
          Mulai percakapan<br>
          <small style="font-size:12px; opacity:.7;">Semua pesan disimpan terenkripsi di perangkat</small>
        </div>`;
      return;
    }

    messages.innerHTML = '';
    for (const m of list) {
      const el = await renderMessage(m);
      if (el) messages.appendChild(el);
    }
    messages.scrollTop = messages.scrollHeight;
  }

  async function renderMessage(m) {
    let data;
    try {
      const plain = await CRYPTO.decrypt(Auth.getKey(), m.cipher);
      data = JSON.parse(plain);
    } catch {
      return null;
    }

    const div = document.createElement('div');
    div.className = 'msg ' + (m.from === 'me' ? 'me' : 'them');

    if (data.type === 'text') {
      const text = UI.escapeHtml(data.text);
      div.innerHTML = `${text.replace(/\n/g, '<br>')}<span class="msg-time">${formatTime(m.date)}</span>`;
    }
    else if (data.type === 'emoji') {
      div.classList.add('msg-emoji');
      div.innerHTML = `${data.emoji}<span class="msg-time" style="opacity:.5;">${formatTime(m.date)}</span>`;
    }
    else if (data.type === 'sticker') {
      div.classList.add('msg-sticker');
      div.innerHTML = `${data.sticker}`;
    }
    else if (data.type === 'voice') {
      div.classList.add('msg-voice');
      const audioId = 'audio_' + m.id;
      const duration = data.duration || 0;
      const bars = Array.from({ length: 20 }, () =>
        `<span style="height:${8 + Math.random() * 14}px;"></span>`
      ).join('');
      div.innerHTML = `
        <button class="voice-play" data-audio="${audioId}">▶</button>
        <div class="voice-wave">${bars}</div>
        <span class="voice-duration">${formatDuration(duration)}</span>
        <audio id="${audioId}" preload="metadata"></audio>
        <span class="msg-time" style="display:none;">${formatTime(m.date)}</span>
      `;

      try {
        const blob = await CRYPTO.decryptBlob(Auth.getKey(), m.blob);
        const url = URL.createObjectURL(blob);
        const audio = div.querySelector('#' + audioId);
        audio.src = url;

        const playBtn = div.querySelector('.voice-play');
        playBtn.addEventListener('click', () => {
          if (audio.paused) {
            messages.querySelectorAll('audio').forEach(a => a.pause());
            messages.querySelectorAll('.voice-play').forEach(b => {
              b.textContent = '▶';
              b.classList.remove('playing');
            });
            audio.play();
            playBtn.textContent = '⏸';
            playBtn.classList.add('playing');
          } else {
            audio.pause();
            playBtn.textContent = '▶';
            playBtn.classList.remove('playing');
          }
        });
        audio.addEventListener('ended', () => {
          playBtn.textContent = '▶';
          playBtn.classList.remove('playing');
        });
      } catch (e) {
        console.error('Voice decrypt error', e);
      }
    }

    return div;
  }

  async function saveMessage(type, payload, blob) {
    const data = { type, ...payload };
    const cipher = await CRYPTO.encrypt(Auth.getKey(), JSON.stringify(data));
    const record = { from: 'me', cipher, date: new Date().toISOString(), type };
    if (blob) record.blob = blob;
    await db.messages.add(record);
    await renderMessages();
  }

  async function sendText() {
    const text = UI.sanitizeText(chatInput.value, 5000);
    if (!text) return;

    const isSingleEmoji = /^[\p{Emoji}\s]+$/u.test(text) && text.trim().length <= 8;
    const type = isSingleEmoji ? 'emoji' : 'text';
    const payload = isSingleEmoji ? { emoji: text.trim() } : { text };

    await saveMessage(type, payload);
    chatInput.value = '';
    chatInput.style.height = 'auto';
    chatInput.focus();
  }

  async function sendSticker(sticker) {
    await saveMessage('sticker', { sticker });
  }

  // ---------- Recording ----------
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordedChunks = [];

      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : (MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '');

      mediaRecorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
        if (blob.size > 0) {
          try {
            const encryptedBlob = await CRYPTO.encryptBlob(Auth.getKey(), blob);
            await saveMessage('voice', { duration: recSeconds }, encryptedBlob);
            UI.toast('Pesan suara tersimpan', 'success');
          } catch (err) {
            console.error(err);
            UI.toast('Gagal menyimpan pesan suara', 'error');
          }
        }
      };

      mediaRecorder.start();
      recording = true;
      recSeconds = 0;
      recordingBar.hidden = false;
      btnMic.classList.add('recording');
      btnMic.textContent = '⏹';
      recTime.textContent = '0:00';

      recInterval = setInterval(() => {
        recSeconds++;
        recTime.textContent = formatDuration(recSeconds);
      }, 1000);

    } catch (err) {
      console.error(err);
      UI.toast('Tidak bisa akses mikrofon', 'error');
    }
  }

  function stopRecording() {
    stopRecordingInternal();
    recordingBar.hidden = true;
    btnMic.classList.remove('recording');
    btnMic.textContent = '🎤';
  }

  // ---------- Voice Call ----------
  function initPeer() {
    if (peer || !window.Peer) return;

    peer = new Peer(PEER_ID, { debug: 0 });

    peer.on('open', (id) => {
      console.log('PeerJS ID:', id);
      contactStatus.textContent = 'ID: ' + id.slice(-6);
    });

    peer.on('call', async (call) => {
      const ok = await UI.confirmDialog(`Panggilan masuk dari ${call.peer.slice(-6)}. Terima?`);
      if (ok) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          currentStream = stream;
          call.answer(stream);
          activeCall = call;
          showCallModal(call.peer.slice(-6), 'Terhubung');
          setupCallEvents(call);
        } catch (err) {
          console.error(err);
          UI.toast('Tidak bisa akses mikrofon', 'error');
          call.close();
        }
      } else {
        call.close();
      }
    });

    peer.on('error', (err) => {
      console.warn('Peer error:', err);
      if (err.type === 'peer-unavailable') {
        UI.toast('Kontak tidak tersedia', 'error');
      }
      closeCall();
      callModal.hidden = true;
    });
  }

  function setupCallEvents(call) {
    call.on('stream', (remoteStream) => {
      if (!remoteAudio) {
        remoteAudio = new Audio();
        remoteAudio.autoplay = true;
      }
      remoteAudio.srcObject = remoteStream;
      remoteAudio.play().catch(() => {});
      callStatus.textContent = 'Terhubung';
    });
    call.on('close', () => {
      closeCall();
      callModal.hidden = true;
    });
    call.on('error', () => {
      closeCall();
      callModal.hidden = true;
    });
  }

  function showCallModal(name, status) {
    callName.textContent = name;
    callStatus.textContent = status;
    callModal.hidden = false;
  }

  async function startCall() {
    try {
      await loadPeerJS();
    } catch (e) {
      UI.toast('Gagal memuat PeerJS', 'error');
      return;
    }
    initPeer();

    const target = await UI.promptDialog('Masukkan ID kontak (6 digit terakhir):', {
      placeholder: 'contoh: a3f9b2',
      minLen: 4
    });
    if (!target) return;

    const clean = target.replace(/[^a-z0-9]/gi, '').toLowerCase();
    const fullId = 'tokoapp_room_' + clean;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      currentStream = stream;

      const call = peer.call(fullId, stream);
      if (!call) {
        UI.toast('Gagal memanggil', 'error');
        stopCurrentStream();
        return;
      }

      activeCall = call;
      showCallModal(clean, 'Memanggil...');
      setupCallEvents(call);
    } catch (err) {
      console.error(err);
      UI.toast('Tidak bisa akses mikrofon', 'error');
    }
  }

  // ---------- Event handlers ----------
  btnSend.addEventListener('click', sendText);

  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendText();
    }
  });

  chatInput.addEventListener('input', (e) => {
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  });

  btnEmoji.addEventListener('click', () => toggleEmojiPicker());

  btnMic.addEventListener('click', () => {
    if (recording) stopRecording();
    else startRecording();
  });

  btnCall.addEventListener('click', startCall);
  btnEndCall.addEventListener('click', () => {
    closeCall();
    callModal.hidden = true;
  });
  btnMute.addEventListener('click', () => {
    if (!currentStream) return;
    isMuted = !isMuted;
    currentStream.getAudioTracks().forEach(t => t.enabled = !isMuted);
    btnMute.classList.toggle('active', isMuted);
    btnMute.textContent = isMuted ? '🔇' : '🎤';
  });

  // Outside click untuk close emoji picker
  outsideClickHandler = (e) => {
    if (!emojiPicker.contains(e.target) && e.target !== btnEmoji && !btnEmoji.contains(e.target)) {
      emojiPicker.classList.remove('show');
    }
  };
  document.addEventListener('click', outsideClickHandler);

  // Keyboard global
  keydownHandler = (e) => {
    if (e.key === 'Escape') toggleEmojiPicker(false);
  };
  document.addEventListener('keydown', keydownHandler);

  // Visibility untuk auto-stop camera
  visibilityHandler = () => {
    if (document.hidden) stopCurrentStream();
  };
  document.addEventListener('visibilitychange', visibilityHandler);

  // ---------- Init ----------
  renderEmojiTabs();
  renderEmojiGrid();
  await renderMessages();

  // Lazy load PeerJS setelah UI ready
  loadPeerJS().then(() => initPeer()).catch(() => {});

  return shell;
}

// ============================================================
//   DESTROY
// ============================================================
export function destroy() {
  stopRecordingInternal();
  destroyPeer();
  stopCurrentStream();

  if (outsideClickHandler) {
    document.removeEventListener('click', outsideClickHandler);
    outsideClickHandler = null;
  }
  if (keydownHandler) {
    document.removeEventListener('keydown', keydownHandler);
    keydownHandler = null;
  }
  if (visibilityHandler) {
    document.removeEventListener('visibilitychange', visibilityHandler);
    visibilityHandler = null;
  }
}