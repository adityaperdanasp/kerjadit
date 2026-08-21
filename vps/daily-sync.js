// Daily logic-only sync (no AI). Recomputes cluster/days for everyone (cheap),
// only touches summary/suggestion when there's a new message, classifies brand-new
// contacts with logic rules, and NEVER overwrites existing company_name/industry
// (those may have been set by a one-off AI classification and must not regress).
require('dotenv').config();
const { Client } = require('@notionhq/client');
const fs = require('fs');
const path = require('path');

const STORE_PATH = path.join(__dirname, 'store.json');
const CLUSTERS_PATH = path.join(__dirname, 'clusters.json');
const DB_ID_PATH = path.join(__dirname, 'notion-db-id.txt');
const PAGE_MAP_PATH = path.join(__dirname, 'notion-page-map.json');

const HOT_DAYS = 7;
const WARM_DAYS = 14;

const notion = new Client({ auth: process.env.NOTION_TOKEN });

const CATEGORY_TO_INDUSTRY = {
  'insurance company': 'insurance',
  'insurance broker': 'insurance',
  'medical & health': 'healthcare',
  'health/beauty': 'healthcare',
  doctor: 'healthcare',
  'dentist & dental office': 'healthcare',
  finance: 'banking',
  'public & government service': 'government',
  'government official': 'government',
};

const INDUSTRY_LABELS = {
  oil_gas: 'Oil & Gas', banking: 'Banking', manufacturing: 'Manufacturing',
  insurance: 'Insurance', healthcare: 'Healthcare', government: 'Government',
  other: 'Other', unknown: 'Unknown',
};
const CONFIDENCE_LABELS = { high: 'High', low: 'Low', unknown: 'Unknown' };
const CLIENT_TYPE_LABELS = { broker: 'Broker', end_user: 'End User', unknown: 'Unknown' };
const CLUSTER_LABELS = { hot: 'Hot', warm: 'Warm', cold: 'Cold' };

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function loadJSON(p, fallback) { return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : fallback; }

function mapCategoryToIndustry(category) {
  if (!category) return 'unknown';
  return CATEGORY_TO_INDUSTRY[category.toLowerCase().trim()] || 'other';
}

function clusterFor(daysSince) {
  if (daysSince === null) return 'cold';
  if (daysSince <= HOT_DAYS) return 'hot';
  if (daysSince <= WARM_DAYS) return 'warm';
  return 'cold';
}

function suggestionFor(cluster, days) {
  if (cluster === 'hot') return `Masih aktif chat (${days} hari lalu) — lanjutkan percakapan yang sedang berjalan.`;
  if (cluster === 'warm') return `Sudah ${days} hari sejak chat terakhir — pertimbangkan follow up sebelum dingin.`;
  return `Sudah ${days} hari sejak chat terakhir — evaluasi apakah masih relevan untuk di-follow up ulang.`;
}

function lastMessageText(raw) {
  const msgs = (raw.messages || []).filter((m) => m.text);
  return msgs.length ? '(pesan terakhir) ' + msgs[msgs.length - 1].text.slice(0, 300) : '';
}

function classifyNewLogic(raw, days, cluster) {
  const bp = raw.businessProfile;
  const category = bp && bp.category;
  const industry = mapCategoryToIndustry(category);
  const industry_confidence = category ? 'high' : 'unknown';
  const isBroker = category && /broker/i.test(category);
  return {
    company_name: null,
    company_confidence: 'unknown',
    industry,
    industry_confidence,
    client_type: isBroker ? 'broker' : 'unknown',
    summary: lastMessageText(raw),
    suggestion: suggestionFor(cluster, days),
  };
}

function sortResults(results) {
  return results.slice().sort((a, b) => (b.days_since_last_chat ?? 999999) - (a.days_since_last_chat ?? 999999));
}

function displayName(entry) {
  if (entry.name) return entry.name;
  if (entry.company_name) return entry.company_name;
  if (entry.jid && entry.jid.endsWith('@s.whatsapp.net')) return '+' + entry.jid.split('@')[0];
  return 'Kontak ' + (entry.jid || 'unknown').split('@')[0].slice(-6);
}

// Full property set — used ONLY when creating a brand-new Notion page.
function buildProperties(entry) {
  return {
    Nama: { title: [{ text: { content: displayName(entry) } }] },
    Perusahaan: { rich_text: [{ text: { content: entry.company_name || '' } }] },
    Industri: { select: { name: INDUSTRY_LABELS[entry.industry] || 'Unknown' } },
    'Confidence Industri': { select: { name: CONFIDENCE_LABELS[entry.industry_confidence] || 'Unknown' } },
    'Tipe Client': { select: { name: CLIENT_TYPE_LABELS[entry.client_type] || 'Unknown' } },
    Cluster: { status: { name: CLUSTER_LABELS[entry.cluster] || 'Cold' } },
    'Hari Sejak Chat Terakhir': { number: entry.days_since_last_chat },
    'Ringkasan Terakhir': { rich_text: [{ text: { content: (entry.summary || '').slice(0, 1900) } }] },
    Saran: { rich_text: [{ text: { content: (entry.suggestion || '').slice(0, 1900) } }] },
    'Update Terakhir': { date: { start: new Date().toISOString() } },
  };
}

// Time-sensitive-only property set — used when updating an EXISTING page, so
// manual edits to Nama/Perusahaan/Industri/Tipe Client in Notion are never overwritten.
function buildUpdateProperties(entry) {
  return {
    Cluster: { status: { name: CLUSTER_LABELS[entry.cluster] || 'Cold' } },
    'Hari Sejak Chat Terakhir': { number: entry.days_since_last_chat },
    'Ringkasan Terakhir': { rich_text: [{ text: { content: (entry.summary || '').slice(0, 1900) } }] },
    Saran: { rich_text: [{ text: { content: (entry.suggestion || '').slice(0, 1900) } }] },
    'Update Terakhir': { date: { start: new Date().toISOString() } },
  };
}

async function withRetry(fn, label, attempt = 1) {
  try {
    return await fn();
  } catch (err) {
    if (attempt < 3) {
      await sleep(500 * attempt);
      return withRetry(fn, label, attempt + 1);
    }
    console.error('FAILED', label, err.message || err);
    return null;
  }
}

async function main() {
  const store = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  const oldClusters = loadJSON(CLUSTERS_PATH, []);
  const pageMap = loadJSON(PAGE_MAP_PATH, {});
  const dbId = fs.readFileSync(DB_ID_PATH, 'utf8').trim();
  const oldByJid = new Map(oldClusters.map((c) => [c.jid, c]));

  const finalEntries = [];
  const toPush = [];
  const nowSec = Math.floor(Date.now() / 1000);

  for (const raw of store) {
    const days = raw.lastMessageTimestamp ? Math.floor((nowSec - raw.lastMessageTimestamp) / 86400) : null;
    const cluster = clusterFor(days);
    const old = oldByJid.get(raw.jid);

    let entry;
    if (!old) {
      const classification = classifyNewLogic(raw, days, cluster);
      entry = {
        jid: raw.jid, name: raw.name, last_message_timestamp: raw.lastMessageTimestamp,
        days_since_last_chat: days, cluster, ...classification,
      };
      toPush.push(entry.jid);
    } else {
      const hasNewMessage = old.last_message_timestamp !== raw.lastMessageTimestamp;
      const clusterChanged = old.cluster !== cluster;
      const nameChanged = !!(raw.name && raw.name !== old.name);
      // Days-since-chat is recomputed every run, but used to only get pushed to
      // Notion when a message/cluster/name event also fired — so a contact sitting
      // mid-tier (e.g. day 3 of "Hot") could go a week+ with a frozen, stale number
      // in Notion even though this local recompute already knew better. Push it too.
      const daysChanged = old.days_since_last_chat !== days;

      entry = {
        ...old,
        name: raw.name || old.name,
        last_message_timestamp: raw.lastMessageTimestamp,
        days_since_last_chat: days,
        cluster,
      };

      if (hasNewMessage) {
        entry.summary = lastMessageText(raw) || entry.summary;
        entry.suggestion = suggestionFor(cluster, days);
      } else if (clusterChanged || daysChanged) {
        entry.suggestion = suggestionFor(cluster, days);
      }

      if (hasNewMessage || clusterChanged || nameChanged || daysChanged) toPush.push(entry.jid);
    }
    finalEntries.push(entry);
  }

  const finalSorted = sortResults(finalEntries);
  fs.writeFileSync(CLUSTERS_PATH, JSON.stringify(finalSorted, null, 2));

  const finalByJid = new Map(finalSorted.map((e) => [e.jid, e]));
  let created = 0, updated = 0, failed = 0;

  for (const jid of toPush) {
    const entry = finalByJid.get(jid);
    if (pageMap[jid]) {
      const properties = buildUpdateProperties(entry); // never touches Nama/Perusahaan/Industri/Tipe Client
      const r = await withRetry(() => notion.pages.update({ page_id: pageMap[jid], properties }), jid);
      if (r) updated++; else failed++;
    } else {
      const properties = buildProperties(entry); // full set, only for brand-new pages
      const r = await withRetry(() => notion.pages.create({ parent: { database_id: dbId }, properties }), jid);
      if (r) { pageMap[jid] = r.id; created++; } else failed++;
    }
    await sleep(340);
  }

  fs.writeFileSync(PAGE_MAP_PATH, JSON.stringify(pageMap, null, 2));
  console.log('DAILY_SYNC_DONE', new Date().toISOString(), 'total_contacts=', store.length, 'touched=', toPush.length, 'created=', created, 'updated=', updated, 'failed=', failed);
}

main().catch((err) => {
  console.error('FATAL', err);
  process.exit(1);
});
