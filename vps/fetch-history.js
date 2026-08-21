// Tahap 1: read-only WhatsApp history fetcher.
// Never sends messages, never marks read, never updates presence.
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');

const AUTH_DIR = path.join(__dirname, 'auth_info');
const STORE_PATH = path.join(__dirname, 'store.json');
const QR_PATH = path.join(__dirname, 'qr.png');
const MAX_MESSAGES_PER_CONTACT = 20;
const IDLE_TIMEOUT_MS = 45000; // finalize after 45s with no new history events
const MIN_RUNTIME_AFTER_OPEN_MS = 40000; // don't finalize sooner than this after connection opens
const MAX_RUNTIME_MS = 10 * 60 * 1000; // hard safety cap

// WhatsApp exposes two ID formats for the same person: a privacy "@lid" and
// the real "@s.whatsapp.net" phone-number JID. Names arrive attached to one,
// messages to the other. Union-find merges any JIDs known to be the same
// contact (via Contact.lid/jid or Chat.oldJid/newJid) before output.
const rawNames = new Map(); // jid -> name
const rawMessages = new Map(); // jid -> message[]
const parent = new Map();
let idleTimer = null;
let hardTimer = null;
let finalized = false;
let connectionOpenedAt = null;

function isGroupOrBroadcast(jid) {
  return !jid || jid.endsWith('@g.us') || jid.endsWith('@broadcast') || jid === 'status@broadcast';
}

function find(x) {
  if (!parent.has(x)) parent.set(x, x);
  let root = x;
  while (parent.get(root) !== root) root = parent.get(root);
  let cur = x;
  while (parent.get(cur) !== root) {
    const next = parent.get(cur);
    parent.set(cur, root);
    cur = next;
  }
  return root;
}

function union(a, b) {
  if (!a || !b || a === b) return;
  const ra = find(a);
  const rb = find(b);
  if (ra !== rb) parent.set(ra, rb);
}

function resetIdleTimer() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(finalizeAndExit, IDLE_TIMEOUT_MS);
}

function upsertContactName(jid, name) {
  if (isGroupOrBroadcast(jid)) return;
  find(jid); // register in union-find
  if (name) rawNames.set(jid, name);
}

function addMessage(jid, msg) {
  if (isGroupOrBroadcast(jid)) return;
  find(jid); // register in union-find
  if (!rawMessages.has(jid)) rawMessages.set(jid, []);
  rawMessages.get(jid).push(msg);
}

function extractText(m) {
  const msg = m.message;
  if (!msg) return null;
  if (msg.conversation) return msg.conversation;
  if (msg.extendedTextMessage && msg.extendedTextMessage.text) return msg.extendedTextMessage.text;
  if (msg.imageMessage) return '[image] ' + (msg.imageMessage.caption || '');
  if (msg.videoMessage) return '[video] ' + (msg.videoMessage.caption || '');
  if (msg.stickerMessage) return '[sticker]';
  if (msg.audioMessage) return '[audio]';
  if (msg.documentMessage) return '[document] ' + (msg.documentMessage.fileName || '');
  if (msg.reactionMessage) return '[reaction] ' + (msg.reactionMessage.text || '');
  if (msg.buttonsResponseMessage) return msg.buttonsResponseMessage.selectedDisplayText || null;
  if (msg.listResponseMessage) return msg.listResponseMessage.title || null;
  if (msg.templateButtonReplyMessage) return msg.templateButtonReplyMessage.selectedDisplayText || null;
  return null;
}

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    syncFullHistory: true,
    markOnlineOnConnect: false,
    browser: ['Adit WA Agent', 'Chrome', '1.0'],
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      await qrcode.toFile(QR_PATH, qr, { width: 1000, margin: 2 });
      console.log('QR_SAVED', QR_PATH);
    }
    if (connection === 'open') {
      console.log('CONNECTION_OPEN');
      connectionOpenedAt = Date.now();
      if (!hardTimer) hardTimer = setTimeout(finalizeAndExit, MAX_RUNTIME_MS);
      resetIdleTimer();
    }
    if (connection === 'close') {
      const statusCode = lastDisconnect && lastDisconnect.error && lastDisconnect.error.output
        ? lastDisconnect.error.output.statusCode
        : null;
      const loggedOut = statusCode === DisconnectReason.loggedOut;
      console.log('CONNECTION_CLOSED', statusCode, 'loggedOut=', loggedOut);
      if (!loggedOut && !finalized) {
        start();
      } else if (loggedOut) {
        console.log('LOGGED_OUT_DELETE_AUTH_TO_RETRY');
        process.exit(1);
      }
    }
  });

  sock.ev.on('messaging-history.set', (payload) => {
    const chats = payload.chats || [];
    const contactsSync = payload.contacts || [];
    const messages = payload.messages || [];
    console.log('HISTORY_SET', 'chats=', chats.length, 'contacts=', contactsSync.length, 'messages=', messages.length, 'isLatest=', payload.isLatest);

    for (const c of contactsSync) {
      const name = c.name || c.notify || c.verifiedName;
      upsertContactName(c.id, name);
      if (c.lid) upsertContactName(c.lid, name);
      if (c.jid) upsertContactName(c.jid, name);
      union(c.id, c.lid);
      union(c.id, c.jid);
    }
    for (const chat of chats) {
      if (chat.name) upsertContactName(chat.id, chat.name);
      union(chat.id, chat.oldJid);
      union(chat.id, chat.newJid);
    }
    for (const m of messages) {
      const jid = m.key && m.key.remoteJid;
      if (!jid) continue;
      if (!m.key.fromMe && m.pushName) upsertContactName(jid, m.pushName);
      addMessage(jid, {
        fromMe: !!m.key.fromMe,
        timestamp: Number(m.messageTimestamp) || 0,
        text: extractText(m),
      });
    }
    resetIdleTimer();
  });

  sock.ev.on('contacts.upsert', (list) => {
    for (const c of list) {
      const name = c.name || c.notify || c.verifiedName;
      upsertContactName(c.id, name);
      if (c.lid) upsertContactName(c.lid, name);
      if (c.jid) upsertContactName(c.jid, name);
      union(c.id, c.lid);
      union(c.id, c.jid);
    }
    resetIdleTimer();
  });

  sock.ev.on('contacts.update', (list) => {
    for (const c of list) {
      const name = c.name || c.notify || c.verifiedName;
      upsertContactName(c.id, name);
      if (c.lid) upsertContactName(c.lid, name);
      if (c.jid) upsertContactName(c.jid, name);
      union(c.id, c.lid);
      union(c.id, c.jid);
    }
  });

  sock.ev.on('messages.upsert', ({ messages }) => {
    for (const m of messages || []) {
      const jid = m.key && m.key.remoteJid;
      if (!jid) continue;
      if (!m.key.fromMe && m.pushName) upsertContactName(jid, m.pushName);
      addMessage(jid, {
        fromMe: !!m.key.fromMe,
        timestamp: Number(m.messageTimestamp) || 0,
        text: extractText(m),
      });
    }
    resetIdleTimer();
  });
}

function finalizeAndExit() {
  if (finalized) return;
  if (connectionOpenedAt) {
    const elapsed = Date.now() - connectionOpenedAt;
    if (elapsed < MIN_RUNTIME_AFTER_OPEN_MS) {
      const remaining = MIN_RUNTIME_AFTER_OPEN_MS - elapsed;
      console.log('DEFER_FINALIZE remaining_ms=', remaining);
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(finalizeAndExit, remaining);
      return;
    }
  }
  finalized = true;
  if (idleTimer) clearTimeout(idleTimer);
  if (hardTimer) clearTimeout(hardTimer);

  const groups = new Map(); // root -> { jids: Set, names: [], messages: [] }
  function getGroup(jid) {
    const root = find(jid);
    if (!groups.has(root)) groups.set(root, { jids: new Set(), names: [], messages: [] });
    return groups.get(root);
  }
  for (const [jid, name] of rawNames) {
    if (isGroupOrBroadcast(jid)) continue;
    const g = getGroup(jid);
    g.jids.add(jid);
    if (name) g.names.push(name);
  }
  for (const [jid, msgs] of rawMessages) {
    if (isGroupOrBroadcast(jid)) continue;
    const g = getGroup(jid);
    g.jids.add(jid);
    g.messages.push(...msgs);
  }

  const output = [];
  for (const g of groups.values()) {
    const sorted = g.messages.slice().sort((a, b) => a.timestamp - b.timestamp);
    const last20 = sorted.slice(-MAX_MESSAGES_PER_CONTACT);
    const lastMessageTimestamp = sorted.length ? sorted[sorted.length - 1].timestamp : null;
    const jidList = [...g.jids];
    const primaryJid = jidList.find((j) => j.endsWith('@s.whatsapp.net')) || jidList[0];
    output.push({
      jid: primaryJid,
      allJids: jidList,
      name: g.names[0] || null,
      lastMessageTimestamp,
      messages: last20,
    });
  }
  output.sort((a, b) => (b.lastMessageTimestamp || 0) - (a.lastMessageTimestamp || 0));
  fs.writeFileSync(STORE_PATH, JSON.stringify(output, null, 2));
  console.log('STORE_WRITTEN', STORE_PATH, 'contacts=', output.length);
  process.exit(0);
}

start().catch((err) => {
  console.error('FATAL', err);
  process.exit(1);
});
