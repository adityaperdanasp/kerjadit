// Always-on read-only WhatsApp listener. Captures live messages/names into store.json.
// Never sends messages, never marks read, never updates presence.
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const HEARTBEAT_PAGE_ID = '3c044c46-bc10-8165-b205-d97cd128d5ac';
const HEARTBEAT_INTERVAL_MS = 3 * 60 * 1000;

// Tracks the last time a message was actually decrypted and processed (not just
// "the socket is connected") — a corrupted Signal session can leave the socket
// looking alive (heartbeat keeps firing) while every incoming message silently
// fails to decrypt. The dashboard uses the gap between this and now to tell
// "actually working" apart from "connected but deaf".
let lastMessageCapturedAt = null;

function sendHeartbeat() {
  const properties = { 'Last Heartbeat': { date: { start: new Date().toISOString() } } };
  if (lastMessageCapturedAt) {
    properties['Last Message Captured'] = { date: { start: lastMessageCapturedAt.toISOString() } };
  }
  notion.pages.update({ page_id: HEARTBEAT_PAGE_ID, properties }).catch((e) => console.error('HEARTBEAT_FAILED', e.message));
}

const AUTH_DIR = path.join(__dirname, 'auth_info');
const STORE_PATH = path.join(__dirname, 'store.json');
const MAX_MESSAGES_PER_CONTACT = 20;
const SAVE_DEBOUNCE_MS = 3000;
const RECONNECT_DELAY_MS = 3000;

function isGroupOrBroadcast(jid) {
  return !jid || jid.endsWith('@g.us') || jid.endsWith('@broadcast') || jid === 'status@broadcast';
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
  return null;
}

let store = [];
let storeByJid = new Map();
let saveTimer = null;

function loadStore() {
  store = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  storeByJid = new Map(store.map((e) => [e.jid, e]));
  // Seed the capture clock from what's already on disk. Without this it would
  // restart at null on every deploy/restart, making the dashboard cry
  // "bermasalah" for hours on a perfectly healthy listener that simply hasn't
  // had an inbound message yet. What we care about is "how long since ANY
  // message last landed", which survives restarts.
  const newest = store.reduce((max, e) => Math.max(max, e.lastMessageTimestamp || 0), 0);
  if (newest > 0) lastMessageCapturedAt = new Date(newest * 1000);
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
    console.log('SAVED', new Date().toISOString(), 'contacts=', store.length);
  }, SAVE_DEBOUNCE_MS);
}

function getOrCreateEntry(jid) {
  let entry = storeByJid.get(jid);
  if (!entry) {
    entry = { jid, allJids: [jid], name: null, lastMessageTimestamp: null, messages: [] };
    store.push(entry);
    storeByJid.set(jid, entry);
  }
  return entry;
}

// WhatsApp exposes two ID formats for the same person: a privacy "@lid" and the
// real "@s.whatsapp.net" phone-number JID. A contact can switch to messaging
// under a fresh @lid at any time — without this, that becomes a second,
// permanently disconnected entry (their history stays frozen on the old jid
// forever, which is what daily-sync.js reads, so the dashboard shows a stale
// days-since-chat even though they messaged five minutes ago). contacts.upsert/
// contacts.update carry the authoritative mapping (c.lid / c.jid) whenever
// WhatsApp reveals it; fold the two entries together the moment we learn of it,
// same approach fetch-history.js already uses for its one-shot backfill.
function mergeJids(jidA, jidB) {
  if (!jidA || !jidB || jidA === jidB) return false;
  if (isGroupOrBroadcast(jidA) || isGroupOrBroadcast(jidB)) return false;

  const entryA = storeByJid.get(jidA);
  const entryB = storeByJid.get(jidB);

  if (entryA && entryB && entryA !== entryB) {
    // Keep the @s.whatsapp.net entry as the survivor so notion-page-map.json
    // (keyed by entry.jid on the daily-sync side) still resolves to the
    // existing Notion page instead of creating a duplicate.
    const survivor = entryA.jid.endsWith('@s.whatsapp.net')
      ? entryA
      : entryB.jid.endsWith('@s.whatsapp.net')
      ? entryB
      : entryA;
    const loser = survivor === entryA ? entryB : entryA;

    survivor.name = survivor.name || loser.name;
    survivor.allJids = [...new Set([...survivor.allJids, ...loser.allJids])];
    survivor.messages = survivor.messages
      .concat(loser.messages)
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-MAX_MESSAGES_PER_CONTACT);
    survivor.lastMessageTimestamp =
      Math.max(survivor.lastMessageTimestamp || 0, loser.lastMessageTimestamp || 0) || null;
    if (!survivor.businessProfile && loser.businessProfile) survivor.businessProfile = loser.businessProfile;

    for (const j of loser.allJids) storeByJid.set(j, survivor);
    const idx = store.indexOf(loser);
    if (idx !== -1) store.splice(idx, 1);
    console.log('MERGED_JIDS', loser.allJids.join(','), '->', survivor.jid, survivor.name);
    return true;
  }
  if (entryA && !entryB) {
    storeByJid.set(jidB, entryA);
    if (!entryA.allJids.includes(jidB)) entryA.allJids.push(jidB);
    return true;
  }
  if (!entryA && entryB) {
    storeByJid.set(jidA, entryB);
    if (!entryB.allJids.includes(jidA)) entryB.allJids.push(jidA);
    return true;
  }
  return false;
}

async function main() {
  // Loaded ONCE and kept in memory for the life of the process — re-reading auth
  // state from disk on every reconnect (the old behavior) risked loading a session
  // file mid-write from a concurrent saveCreds(), which is exactly the kind of
  // inconsistency that corrupts the Signal Protocol ratchet state.
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  let currentSock = null;
  let reconnectScheduled = false;

  function scheduleReconnect() {
    if (reconnectScheduled) return;
    reconnectScheduled = true;
    setTimeout(() => {
      reconnectScheduled = false;
      start();
    }, RECONNECT_DELAY_MS);
  }

  function start() {
    // Cleanly end the previous socket before opening a new one on the same auth
    // state — leaving the old one dangling let two sockets race against the same
    // on-disk session, which is the likely cause of the ratchet-desync corruption.
    if (currentSock) {
      try {
        currentSock.ev.removeAllListeners();
        currentSock.end(new Error('reconnecting'));
      } catch (e) {
        console.error('SOCKET_CLEANUP_FAILED', e.message);
      }
      currentSock = null;
    }

    const sock = makeWASocket({
      auth: state,
      logger: pino({ level: 'silent' }),
      markOnlineOnConnect: false,
      browser: ['Adit WA Agent', 'Chrome', '1.0'],
    });
    currentSock = sock;

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect } = update;
      if (connection === 'open') console.log('CONNECTED', new Date().toISOString());
      if (connection === 'close') {
        const statusCode =
          lastDisconnect && lastDisconnect.error && lastDisconnect.error.output
            ? lastDisconnect.error.output.statusCode
            : null;
        const loggedOut = statusCode === DisconnectReason.loggedOut;
        console.log('CONNECTION_CLOSED', statusCode, 'loggedOut=', loggedOut);
        if (loggedOut) {
          console.error('LOGGED_OUT - session invalid, needs manual re-login');
          process.exit(1);
        }
        scheduleReconnect();
      }
    });

    sock.ev.on('contacts.upsert', (list) => {
      let changed = false;
      for (const c of list) {
        if (isGroupOrBroadcast(c.id)) continue;
        if (mergeJids(c.id, c.lid)) changed = true;
        if (mergeJids(c.id, c.jid)) changed = true;
        const entry = getOrCreateEntry(c.id);
        const name = c.name || c.notify || c.verifiedName;
        if (name && !entry.name) {
          entry.name = name;
          changed = true;
        }
      }
      if (changed) scheduleSave();
    });

    sock.ev.on('contacts.update', (list) => {
      let changed = false;
      for (const c of list) {
        if (isGroupOrBroadcast(c.id)) continue;
        if (mergeJids(c.id, c.lid)) changed = true;
        if (mergeJids(c.id, c.jid)) changed = true;
        const entry = getOrCreateEntry(c.id);
        const name = c.name || c.notify || c.verifiedName;
        if (name && name !== entry.name) {
          entry.name = name;
          changed = true;
        }
      }
      if (changed) scheduleSave();
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
      let changed = false;
      for (const m of messages || []) {
        const jid = m.key && m.key.remoteJid;
        if (!jid || isGroupOrBroadcast(jid)) continue;

        const entry = getOrCreateEntry(jid);
        const isBrandNewContact = entry.messages.length === 0 && entry.businessProfile === undefined;

        if (!m.key.fromMe && m.pushName && !entry.name) entry.name = m.pushName;

        const ts = Number(m.messageTimestamp) || Math.floor(Date.now() / 1000);
        entry.messages.push({ fromMe: !!m.key.fromMe, timestamp: ts, text: extractText(m) });
        entry.messages.sort((a, b) => a.timestamp - b.timestamp);
        if (entry.messages.length > MAX_MESSAGES_PER_CONTACT) {
          entry.messages = entry.messages.slice(-MAX_MESSAGES_PER_CONTACT);
        }
        entry.lastMessageTimestamp = entry.messages[entry.messages.length - 1].timestamp;
        changed = true;
        lastMessageCapturedAt = new Date();

        if (isBrandNewContact) {
          try {
            const profile = await sock.getBusinessProfile(jid);
            entry.businessProfile = profile
              ? {
                  description: profile.description || null,
                  category: profile.category || null,
                  website: profile.website || [],
                  email: profile.email || null,
                  address: profile.address || null,
                }
              : null;
          } catch (e) {
            entry.businessProfile = null;
          }
        }
      }
      if (changed) scheduleSave();
    });
  }

  start();
}

loadStore();
sendHeartbeat();
setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
main().catch((err) => {
  console.error('FATAL', err);
  process.exit(1);
});
