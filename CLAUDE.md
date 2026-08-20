@AGENTS.md

# Sirka / kerjadit.fun

WhatsApp business CRM dashboard, UI-titled "Pekerjaan 2026". Two sections behind one password gate:

- **Sirka** (`/sirka`) — CRM pipeline board (drag contacts through Hot/Warm/Cold/Win/Lost) + a client task list, backed by **Notion**.
- **MBG** (`/mbg`) — SPPG Cengkareng Timur 2 nutrition-program financials, backed by a **Google Sheet**, editable inline from the web app. Tabs (`components/MbgTabs.tsx`): month SPM tables, Petty Cash, **FS** (Financial Statement — label shortened so the pill row stays one line), and **Pending Job** — a free-text job/task tracker (`PendingJobTable` in `components/MbgTables.tsx`) modeled on Sirka's `TaskList.tsx`: editable group titles (`GroupTitle`), items with PIC/due-date/done/remove, and two add flows (new-group form, per-group `QuickAddJob`). Backed by the **same MBG spreadsheet**, tab literally named "Pending Job" (`PENDING_JOB_GID` in `lib/sheets.ts`) — 6 columns (Judul Pekerjaan, Task, PIC, Due Date, Done, ID), header row 1 written once by hand since the tab started empty. Reads via the same public-CSV `fetchCsv` pattern as the other MBG tabs (30s revalidate); writes go through `app/api/mbg/pending-job/*` routes using `appendSheetRow`/`updateSheetCell`/`clearSheetRow` in `lib/googleSheets.ts` — new rows are appended (real sheet row resolved from the API's `updatedRange` response, since concurrent edits mean it can't be predicted ahead of time), edits target one cell by `sheetRow`/col (tracked per item like `FinTable`'s cells), deletes blank the row rather than shifting the sheet's dimensions so other loaded rows' `sheetRow` numbers stay valid. Renaming a group title fans out one cell-update call per row sharing that group name (no separate "group" entity exists — it's just a repeated string in column A).

Deployed on Vercel as project `kerjadit` (org `ellilo`), domain `kerjadit.fun`. Root `/` redirects to `/sirka`.

## Stack

Next.js 16 (App Router, Turbopack) + React 19 + Tailwind v4. **Read `node_modules/next/dist/docs/` before touching Next.js APIs** — this version has breaking changes vs. training data (see AGENTS.md above).

No database of its own — all state lives in Notion (Sirka) or Google Sheets (MBG). No ORM, no ISR ramp-up beyond simple `revalidate` on the two dashboard pages.

## Data sources

- **Notion** (`lib/notion.ts`) — `@notionhq/client`, two data sources: contacts (`NOTION_DATA_SOURCE_ID`) and tasks (`NOTION_TASKS_DATA_SOURCE_ID`). Also holds a single-row "System Status" page (`LISTENER_HEARTBEAT_PAGE_ID` hardcoded in `lib/notion.ts`) used both as a cross-process heartbeat (see below) and to persist the AI Briefing (`AI Briefing` rich_text property, chunked at ~1900 chars since a single rich_text block caps at 2000; `Briefing At` date property) — added via the `dataSources.update` API (this workspace's databases are on the newer multi-data-source Notion API, so schema changes go through `notion.dataSources`, not `notion.databases`).
- **Google Sheets** (`lib/googleSheets.ts`, `lib/sheets.ts`) — service-account JWT (`GOOGLE_SA_EMAIL` / `GOOGLE_SA_PRIVATE_KEY`) calling the Sheets API v4 REST directly (not the `googleapis` package). `lib/sheets.ts` parses the "Financial Statement" sheet into tables while tracking each cell's original row/col so edits from the web app write back to the exact right cell; `editableRows` protects Total/Saldo rows from being edited.
- **Sumopod** (`lib/sumopod.ts`) — OpenAI-compatible proxy (`https://ai.sumopod.com/v1`, `SUMOPOD_API_KEY`) used only for the AI Briefing card (model: `claude-haiku-4-5`, hardcoded — change it there if you want a different model, see the table of available models from a session in this project's history). Fed a deterministic digest computed server-side in `app/api/ai-briefing/route.ts` (stale Hot/Warm deals, pending/overdue tasks, cold prospects, lost-deal context) — the model reasons over real data, it does not invent facts, and is explicitly told not to fabricate news/events since it has no web access. The result is saved to Notion (`saveAiBriefing`) after each generate, and `app/(dash)/sirka/page.tsx` fetches it server-side (`fetchAiBriefing`) so the last-generated briefing shows on every device/session instead of resetting to "Belum pernah digenerate" per browser. Each of the 5 items carries a per-card `status` (`todo`/`in_progress`/`done`, cycled by clicking the pill on the card in `components/Board.tsx`'s `AiBriefing`) persisted via `PATCH /api/ai-briefing` → `updateBriefingItems` — this only touches the `AI Briefing` property, not `Briefing At`, so toggling a card's status doesn't bump the "Terakhir digenerate" timestamp. The whole list (items + statuses) only changes on a fresh "Generate ulang" — there's no auto daily refresh, so yesterday's briefing and whatever you'd checked off just sits there until you regenerate by hand. Older saved briefings without `id`/`status` get backfilled (`normalizeBriefingItems`, `legacy-{index}` ids) so this stayed compatible with what was already in Notion before this existed.

## WhatsApp listener (separate system, not in this repo)

A Baileys-based listener runs on a VPS (`/home/ubuntu/wa-crm/listener.js`), writes enrichment data into the same Notion contacts database, and posts a heartbeat to the Notion "System Status" page every 3 minutes. `app/api/listener-status/route.ts` reads that heartbeat; `components/ListenerStatusBadge.tsx` polls it every 60s and shows green/red "WA aktif"/"WA mati" — a contact-and-alive check, not a live connection. This repo has no direct connection to the VPS.

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
