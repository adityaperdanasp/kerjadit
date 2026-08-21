@AGENTS.md

# Sirka / kerjadit.fun

WhatsApp business CRM dashboard, UI-titled "Pekerjaan 2026". Two sections behind one password gate:

- **Sirka** (`/sirka`) — CRM pipeline board (drag contacts through Hot/Warm/Cold/Win/Lost) + a client task list, backed by **Notion**.
- **MBG** (`/mbg`) — SPPG Cengkareng Timur 2 nutrition-program financials, backed by a **Google Sheet**, editable inline from the web app. Tabs (`components/MbgTabs.tsx`): month SPM tables, Petty Cash, **FS** (Financial Statement — label shortened so the pill row stays one line), and **Pending Job** — a free-text job/task tracker (`PendingJobTable` in `components/MbgTables.tsx`) modeled on Sirka's `TaskList.tsx`: editable group titles (`GroupTitle`), items with PIC/due-date/done/remove, and two add flows (new-group form, per-group `QuickAddJob`). Backed by the **same MBG spreadsheet**, tab literally named "Pending Job" (`PENDING_JOB_GID` in `lib/sheets.ts`) — 6 columns (Judul Pekerjaan, Task, PIC, Due Date, Done, ID), header row 1 written once by hand since the tab started empty. Reads via the same public-CSV `fetchCsv` pattern as the other MBG tabs (30s revalidate); every write route calls `revalidatePath('/mbg')` and the client debounces a `router.refresh()` — without *both*, a just-saved edit survives in the sheet but the stale RSC payload in the client Router Cache gets re-served when you navigate away and back, so the table re-mounts from a pre-write snapshot and the work looks lost (`useState(initialGroups)` deliberately ignores the refreshed props, so a refresh never clobbers on-screen optimistic state). Writes go through `app/api/mbg/pending-job/*` routes using `appendSheetRow`/`updateSheetCell`/`clearSheetRow` in `lib/googleSheets.ts` — new rows are appended (real sheet row resolved from the API's `updatedRange` response, since concurrent edits mean it can't be predicted ahead of time), edits target one cell by `sheetRow`/col (tracked per item like `FinTable`'s cells), deletes blank the row rather than shifting the sheet's dimensions so other loaded rows' `sheetRow` numbers stay valid. Renaming a group title fans out one cell-update call per row sharing that group name (no separate "group" entity exists — it's just a repeated string in column A).

Deployed on Vercel as project `kerjadit` (org `ellilo`), domain `kerjadit.fun`. Root `/` redirects to `/sirka`.

## Stack

Next.js 16 (App Router, Turbopack) + React 19 + Tailwind v4. **Read `node_modules/next/dist/docs/` before touching Next.js APIs** — this version has breaking changes vs. training data (see AGENTS.md above).

No database of its own — all state lives in Notion (Sirka) or Google Sheets (MBG). No ORM, no ISR ramp-up beyond simple `revalidate` on the two dashboard pages.

## Data sources

- **Notion** (`lib/notion.ts`) — `@notionhq/client`, two data sources: contacts (`NOTION_DATA_SOURCE_ID`) and tasks (`NOTION_TASKS_DATA_SOURCE_ID`). Also holds a single-row "System Status" page (`LISTENER_HEARTBEAT_PAGE_ID` hardcoded in `lib/notion.ts`) used both as a cross-process heartbeat (see below) and to persist the AI Briefing (`AI Briefing` rich_text property, chunked at ~1900 chars since a single rich_text block caps at 2000; `Briefing At` date property) — added via the `dataSources.update` API (this workspace's databases are on the newer multi-data-source Notion API, so schema changes go through `notion.dataSources`, not `notion.databases`).
- **Google Sheets** (`lib/googleSheets.ts`, `lib/sheets.ts`) — service-account JWT (`GOOGLE_SA_EMAIL` / `GOOGLE_SA_PRIVATE_KEY`) calling the Sheets API v4 REST directly (not the `googleapis` package). `lib/sheets.ts` parses the "Financial Statement" sheet into tables while tracking each cell's original row/col so edits from the web app write back to the exact right cell; `editableRows` protects Total/Saldo rows from being edited.
- **Sumopod** (`lib/sumopod.ts`) — OpenAI-compatible proxy (`https://ai.sumopod.com/v1`, `SUMOPOD_API_KEY`) used only for the AI Briefing card (model: `claude-haiku-4-5`, hardcoded — change it there if you want a different model, see the table of available models from a session in this project's history). Fed a deterministic digest computed server-side in `app/api/ai-briefing/route.ts` (stale Hot/Warm deals, pending/overdue tasks, cold prospects, lost-deal context) — the model reasons over real data, it does not invent facts, and is explicitly told not to fabricate news/events since it has no web access. The result is saved to Notion (`saveAiBriefing`) after each generate, and `app/(dash)/sirka/page.tsx` fetches it server-side (`fetchAiBriefing`) so the last-generated briefing shows on every device/session instead of resetting to "Belum pernah digenerate" per browser. Each of the 5 items carries a per-card `status` (`todo`/`in_progress`/`done`, cycled by clicking the pill on the card in `components/Board.tsx`'s `AiBriefing`) persisted via `PATCH /api/ai-briefing` → `updateBriefingItems` — this only touches the `AI Briefing` property, not `Briefing At`, so toggling a card's status doesn't bump the "Terakhir digenerate" timestamp. The whole list (items + statuses) only changes on a fresh "Generate ulang" — there's no auto daily refresh, so yesterday's briefing and whatever you'd checked off just sits there until you regenerate by hand. Older saved briefings without `id`/`status` get backfilled (`normalizeBriefingItems`, `legacy-{index}` ids) so this stayed compatible with what was already in Notion before this existed.

## WhatsApp listener (separate system, not in this repo)

A Baileys-based listener runs on a VPS (`/home/ubuntu/wa-crm/listener.js`), writes enrichment data into the same Notion contacts database, and posts a heartbeat to the Notion "System Status" page every 3 minutes — plus, as of the 2026-08-21 incident below, a `Last Message Captured` timestamp on every real message it actually decrypts (seeded on boot from the newest `lastMessageTimestamp` in `store.json`, so a restart doesn't reset the clock to null and flag a healthy listener as broken until its first inbound message). `app/api/listener-status/route.ts` reads both; `components/ListenerStatusBadge.tsx` polls every 60s and shows a 3-state badge: green "WA aktif" (heartbeat fresh AND a message captured within 24h), orange "WA bermasalah" (heartbeat fresh but no message in 24h+ — socket connected but not actually receiving), red "WA mati" (heartbeat itself stale). This repo has no direct connection to the VPS.

**2026-08-21 incident** (context for why the two-signal check above exists): the listener's WhatsApp session hit a Signal Protocol ratchet desync ("Over 2000 messages into the future"), which made it silently fail to decrypt every incoming message for about a week while the process itself — and its heartbeat — stayed alive and green. Root cause traced to `listener.js`'s reconnect loop: on every `connection.update` close event it called `useMultiFileAuthState(AUTH_DIR)` fresh and built a brand-new socket without ever closing the previous one, risking two sockets racing against the same on-disk session mid-write. Fixed by loading auth state once in `main()` and reusing it across reconnects, explicitly ending the old socket before creating a new one, and guarding against overlapping reconnect timers. Recovery used `fetch-history.js` (a separate one-shot Baileys history-sync script already in the VPS toolkit, not `listener.js` itself) to re-pair via a fresh QR scan and backfill the missed week into `store.json` before restarting the live listener.

Reference copies of the VPS scripts live in `vps/` (see `vps/README.md` for their roles, the JSON shapes they read/write, and how to deploy a change back up). They are copies — editing them here changes nothing until they're `scp`'d to the box.

## Sync cadence (why hourly, and why `flock`)

Two different clocks, and confusing them is what makes the dashboard look broken:

- **`listener.js` is real-time** — always-on socket, captures messages the moment they arrive into `store.json` on the VPS.
- **`daily-sync.js` is the bridge to Notion**, and only what it writes ever reaches the dashboard.

So the number a user sees is only as fresh as the last sync, no matter how live the listener is.

It runs **hourly under `flock -n`** (the filename is historical — it was daily until 2026-08-21). Hourly is not 24× the work: because the `daysChanged` push condition fires when a contact crosses its own day boundary, and those boundaries are spread across the clock, each contact flips exactly once per 24h either way. Measured on 833 contacts: ~34 writes per hourly run (peak hour 92, ~30s) versus ~833 in one daily batch (~5 min). Same daily total, lighter per run, and at most 1h stale instead of 24h.

`flock -n` is the important half. `daily-sync.js` has no internal locking: it reads `notion-page-map.json` at startup and writes it at the end, so two overlapping runs can each create a Notion page for the same new contact, leaving permanent duplicates. Use the same lock for manual runs — cron protection does nothing if you invoke `node daily-sync.js` directly.

Changing the schedule: `crontab -l` / `crontab -e` on the VPS. A backup of the pre-change entry is at `/home/ubuntu/crontab.bak-*`.

## Runbook: "the days-since-chat number looks wrong"

This has bitten twice for different reasons, and the two look identical from the dashboard. Always find out **which layer** is stale before changing anything. The chain is:

```
WhatsApp → listener.js → store.json → daily-sync.js → clusters.json + Notion → dashboard
```

Work backwards from the truth. `store.json` is the source of truth for "when did we last hear from this person":

```bash
ssh ubuntu@43.173.12.98
cd /home/ubuntu/wa-crm
# newest message we captured across ALL contacts — if this is days old, the listener is deaf
node -e "const s=require('./store.json');const w=s.filter(e=>e.lastMessageTimestamp).sort((a,b)=>b.lastMessageTimestamp-a.lastMessageTimestamp);console.log(w.slice(0,5).map(e=>[e.jid,e.name,new Date(e.lastMessageTimestamp*1000).toISOString()]))"
```

**Case A — `store.json` is current, Notion is behind.** The listener is fine; the sync just hasn't run since the data arrived. Run it by hand; it's idempotent:

```bash
# use the lock — a manual run can otherwise collide with the hourly cron
ssh ubuntu@43.173.12.98 "/usr/bin/flock -n /tmp/wa-daily-sync.lock -c 'cd /home/ubuntu/wa-crm && node daily-sync.js'"
```

**Case B — `store.json` itself is stale (no messages for days).** The listener is connected but not decrypting. Confirm before re-pairing, because re-pairing is disruptive:

```bash
sudo systemctl is-active wa-listener          # will say "active" even when broken — not proof of health
sudo grep -c 'Over 2000 messages into the future' /home/ubuntu/wa-crm/listener.log
sudo tail -20 /home/ubuntu/wa-crm/listener.log   # repeated "Failed to decrypt message" = dead session
```

A non-zero, still-growing count of that Signal error means the session is unrecoverable and needs a fresh QR pair. **Recovery (needs the phone in hand):**

```bash
sudo systemctl stop wa-listener
cd /home/ubuntu/wa-crm
mv auth_info auth_info.corrupt-$(date +%Y%m%d-%H%M%S)   # quarantine, don't delete — it's the only rollback
mkdir auth_info
cp store.json store.json.bak-$(date +%Y%m%d-%H%M%S)
rm -f qr.png
setsid nohup node fetch-history.js > fetch-history-run.log 2>&1 < /dev/null &
```

Then `scp` `qr.png` down and scan it (WhatsApp → Settings → Linked Devices → Link a Device; log the stale "Adit WA Agent" entry out first). `fetch-history.js` backfills the gap and exits by itself — watch for `STORE_WRITTEN` in `fetch-history-run.log`, then:

```bash
sudo systemctl start wa-listener
node daily-sync.js        # push the backfilled history to Notion; without this the dashboard stays stale
```

That last step is easy to forget: after a backfill, `store.json` is current but Notion still holds pre-backfill numbers until a sync runs. (`qr.png` is generated at `{ width: 1000 }` — the original 400px was too small to scan off a laptop screen.)

**Case C — everything is current but one contact's number never moves.** That was the original bug: `daily-sync.js` recomputed days for everyone locally but only *pushed* to Notion when a message arrived, the cluster changed, or the name changed. A contact sitting mid-tier (day 3 of "Hot") could go a week with a frozen number. Fixed by adding `daysChanged` to the push condition — if the recomputed day count differs from the stored one, it now gets written. If numbers ever freeze again, check that condition first.

## Runbook: reading VPS state safely

`pkill -f fetch-history.js` over SSH **kills the SSH command itself** (the pattern matches the remote shell's own command line) and returns 255. Match on a bracketed pattern and kill by pid instead:

```bash
ssh ubuntu@43.173.12.98 "ps aux | grep '[f]etch-history.js' | awk '{print \$2}' | xargs -r kill"
```

Ad-hoc `node -e "…"` over SSH mangles quotes badly. For anything non-trivial, write the script locally, `scp` it up, run it, delete it. Password auth via `sshpass` works but is flaky under load; this machine also has a working SSH key for `ubuntu@43.173.12.98`, which is more reliable.

## Runbook: dashboard-side gotchas

**"I saved it but it disappeared when I came back."** Almost always the Next.js Router Cache, not data loss. Check the source of truth before touching code — for Pending Job that's the sheet, for the AI Briefing it's the Notion page:

```bash
# what the app actually reads for Pending Job (public CSV export, not the API)
curl -s "https://docs.google.com/spreadsheets/d/1ogYGnj4HP5CthXg4nVZzh9l4CXpOcGEHn0jzJnJHcS8/export?format=csv&gid=956241155"
```

If the data is there but the UI is empty, it's caching. A hard reload proves it. Both halves are needed and each fixes a different cache: `revalidatePath()` in the write route (server data cache) and a debounced `router.refresh()` on the client (Router Cache). Adding only one leaves the bug half-alive.

**Schema changes in Notion** go through `notion.dataSources.update({ data_source_id, properties })`. `notion.databases.update` silently ignores a `properties` payload on this workspace — it logs `unknown parameters were ignored` and returns a response with no `properties`, which looks like a crash but is really the wrong API. Data-source id lives in `NOTION_DATA_SOURCE_ID`; the "System Status" page's is `f9fc4fad-2672-4150-8c33-4f639618f180`.

**A Notion `rich_text` property caps at 2000 characters per block.** The AI Briefing JSON is chunked at ~1900 (`chunkText`) and re-joined on read. Anything else stored as JSON in Notion needs the same treatment.

## Credentials hygiene

`.gitignore` blocks `*-sheets-*.json`, `gcp-*.json`, `service-account*.json`. This is not theoretical: a **live** Google service-account private key (`kerjadit-sheets-7d7d7211e7c3.json`, the same credential the app reads from `GOOGLE_SA_*`) has been sitting untracked in this folder, along with a built APK and its zip. They were one `git add -A` away from being published. Stage files by name; never `git add -A` in this repo.

VPS access is password-based SSH (`ubuntu@43.173.12.98`) with the credential kept outside this repo. Nothing in `vps/` contains a secret — those scripts read everything from `process.env` via the VPS's own `.env`, which is deliberately not copied here.

## Auth

Single shared password, not per-user accounts. `proxy.ts` gates every route except a hardcoded `PUBLIC_PATHS` allowlist (`/login`, `/api/login`, icon/manifest routes — these must stay public so iOS/browsers can fetch favicons/manifest before login) via a `session` cookie checked against `SESSION_TOKEN`. `DASHBOARD_PASSWORD` is the login form password; `SESSION_TOKEN` is the resulting cookie value — both live only in env vars, no hashing/db.

## PWA

`app/manifest.ts`, `app/icon.tsx` (transparent, matches other browser-tab favicons — intentionally *not* card-styled per explicit design feedback), `app/apple-icon.tsx` + `app/pwa-icon-192/512` (solid teal gradient background — iOS renders transparent PNG areas as black on the home screen, so these must stay opaque, unlike the browser favicon). `app/layout.tsx` sets `viewport.viewportFit = "cover"` and a manual `<meta name="apple-mobile-web-app-capable">` tag — Next's built-in `appleWebApp` metadata only emits the unprefixed `mobile-web-app-capable`, which iOS Safari doesn't yet honor for standalone (no-URL-bar) launch; without the legacy tag, "Add to Home Screen" silently falls back to a plain bookmark. `app/globals.css` pads `body` with `env(safe-area-inset-*)` for the notch/status bar in standalone mode.

An Android TWA APK was generated once via PWABuilder.com + self-signed locally with `apksigner`/`keytool` (Homebrew `openjdk`, not the stock macOS Java stub) — not committed anywhere, one-off deliverable, no auto-update (unlike the PWA/web version, a sideloaded APK shell doesn't refresh unless manually reinstalled).

## Deploy

**Two separate steps, neither triggers the other** — always do both:

```bash
git push                 # GitHub, for history — does NOT auto-deploy
vercel --prod             # actually ships it
```

Env vars are set directly in Vercel (`vercel env add <NAME> production`), not synced from `.env.local`.

## Conventions seen in this codebase

- Client components fetch their own data client-side and call small `app/api/*` route handlers that wrap the Notion/Sheets/Sumopod calls — no server actions.
- Inline `style={{}}` objects everywhere instead of Tailwind classes for one-off styling; Tailwind is only pulled in for a handful of shared CSS-variable-driven classes in `globals.css` (`.stats-grid`, `.status-grid`, `.task-groups`, `.task-item-scroll`). Match this pattern rather than introducing a new styling approach.
- Theming via CSS custom properties on `:root` / `:root[data-theme="dark"]` (see `globals.css`), toggled by `components/ThemeToggle.tsx` writing to `localStorage`.
- Optimistic local state updates (`setState` immediately, fire the API call, don't roll back on failure) throughout `TaskList.tsx` / `Board.tsx` / `MbgTables.tsx`.
