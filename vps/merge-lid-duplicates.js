// One-off: connect briefly, listen for contacts.upsert/update and the initial
// history-sync payload (which carry WhatsApp's authoritative @lid <-> phone-number
// JID mapping), and fold any already-split store.json entries together.
//
// Unlike fetch-history.js this does NOT rebuild store.json from a fresh history
// sync — it loads the EXISTING store and only merges duplicates into it, so
// nothing already captured (potentially months of history the current sync
// window wouldn't re-deliver) is at risk of being dropped.
//
// Must not run while wa-listener.service is active — both would open a socket
// on the same auth_info at once, which is the exact race that caused the
// 2026-08-21 ratchet-desync incident. Stop the service first:
//   sudo systemctl stop wa-listener
//   node merge-lid-duplicates.js
//   sudo systemctl start wa-listener
const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');

const AUTH_DIR = path.join(__dirname, 'auth_info');
const STORE_PATH = path.join(__dirname, 'store.json');
const MAX_MESSAGES_PER_CONTACT = 20;
const IDLE_TIMEOUT_MS = 30000;
const MIN_RUNTIME_AFTER_OPEN_MS = 20000;
const MAX_RUNTIME_MS = 5 * 60 * 1000;

function isGroupOrBroadcast(jid) {
  return !jid || jid.endsWith('@g.us') || jid.endsWith('@broadcast') || jid === 'status@broadcast';
}

const store = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
const storeByJid = new Map(store.map((e) => [e.jid, e]));
let mergeCount = 0;

function mergeJids(jidA, jidB) {
  if (!jidA || !jidB || jidA === jidB) return false;
  if (isGroupOrBroadcast(jidA) || isGroupOrBroadcast(jidB)) return false;

  const entryA = storeByJid.get(jidA);
  const entryB = storeByJid.get(jidB);

  if (entryA && entryB && entryA !== entryB) {
    const survivor = entryA.jid.endsWith('@s.whatsapp.net')
      ? entryA
      : entryB.jid.endsWith('@s.whatsapp.net')
      ? entryB
      : entryA;
    const loser = survivor === entryA ? entryB : entryA;

    survivor.name = survivor.name || loser.name;
    survivor.allJids = [...new Set([...(survivor.allJids || [survivor.jid]), ...(loser.allJids || [loser.jid])])];
    survivor.messages = survivor.messages
      .concat(loser.messages)
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-MAX_MESSAGES_PER_CONTACT);
    survivor.lastMessageTimestamp =
      Math.max(survivor.lastMessageTimestamp || 0, loser.lastMessageTimestamp || 0) || null;
    if (!survivor.businessProfile && loser.businessProfile) survivor.businessProfile = loser.businessProfile;

    for (const j of loser.allJids || [loser.jid]) storeByJid.set(j, survivor);
    const idx = store.indexOf(loser);
    if (idx !== -1) store.splice(idx, 1);
    mergeCount++;
    console.log('MERGED', (loser.allJids || [loser.jid]).join(','), '->', survivor.jid, survivor.name);
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

let finalized = false;

function finalizeAndExit() {
  if (finalized) return;
  finalized = true;
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
  console.log('STORE_WRITTEN', STORE_PATH, 'contacts=', store.length, 'merges=', mergeCount);
  process.exit(0);
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    markOnlineOnConnect: false,
    browser: ['Adit WA Agent', 'Chrome', '1.0'],
  });

  sock.ev.on('creds.update', saveCreds);

  const hardTimer = setTimeout(() => {
    console.error('TIMED_OUT waiting for connection');
    process.exit(1);
  }, MAX_RUNTIME_MS);

  sock.ev.on('connection.update', async (update) => {
    const { connection, qr } = update;
    if (qr) {
      console.error('QR_REQUESTED - session invalid, this script should never need to pair. Aborting.');
      process.exit(1);
    }
    if (connection === 'open') {
      console.log('CONNECTION_OPEN');
      clearTimeout(hardTimer);

      // Actively ask WhatsApp for the @lid of every phone-JID contact we know
      // about, rather than passively waiting for a contacts event that may
      // never fire in a short-lived connection (Baileys only pushes
      // contacts.upsert/update for what changed since last connect, and a
      // fresh messaging-history.set often doesn't re-arrive on an
      // already-synced session).
      const phoneJids = store.filter((e) => e.jid.endsWith('@s.whatsapp.net')).map((e) => e.jid);
      console.log('QUERYING onWhatsApp for', phoneJids.length, 'phone-jid contacts');

      for (const batch of chunk(phoneJids, 50)) {
        try {
          const results = await sock.onWhatsApp(...batch);
          for (const r of results || []) {
            if (r && r.lid) mergeJids(r.jid, r.lid);
          }
        } catch (e) {
          console.error('ONWHATSAPP_BATCH_FAILED', e.message);
        }
      }

      finalizeAndExit();
    }
  });
}

start().catch((err) => {
  console.error('FATAL', err);
  process.exit(1);
});
