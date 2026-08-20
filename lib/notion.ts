import { Client } from '@notionhq/client';

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DATA_SOURCE_ID = process.env.NOTION_DATA_SOURCE_ID!;
const TASKS_DATA_SOURCE_ID = process.env.NOTION_TASKS_DATA_SOURCE_ID!;

export type Contact = {
  id: string;
  nama: string;
  perusahaan: string;
  industri: string;
  confidenceIndustri: string;
  tipeClient: string;
  cluster: string;
  hariSejakChat: number | null;
  ringkasan: string;
  saran: string;
  statusDeal: string | null;
  quotationNominal: number | null;
  onboardPlan: string;
};

function text(prop: unknown): string {
  const arr = (prop as { rich_text?: { plain_text: string }[] })?.rich_text;
  return arr && arr.length ? arr.map((t) => t.plain_text).join('') : '';
}
function title(prop: unknown): string {
  const arr = (prop as { title?: { plain_text: string }[] })?.title;
  return arr && arr.length ? arr.map((t) => t.plain_text).join('') : '';
}
function selectName(prop: unknown): string {
  return (prop as { select?: { name: string } })?.select?.name || '';
}
function statusName(prop: unknown): string {
  return (prop as { status?: { name: string } })?.status?.name || '';
}
function numberVal(prop: unknown): number | null {
  const n = (prop as { number?: number | null })?.number;
  return n ?? null;
}

function pageToContact(page: any): Contact {
  const p = page.properties;
  return {
    id: page.id,
    nama: title(p['Nama']),
    perusahaan: text(p['Perusahaan']),
    industri: selectName(p['Industri']),
    confidenceIndustri: selectName(p['Confidence Industri']),
    tipeClient: selectName(p['Tipe Client']),
    cluster: statusName(p['Cluster']),
    hariSejakChat: numberVal(p['Hari Sejak Chat Terakhir']),
    ringkasan: text(p['Ringkasan Terakhir']),
    saran: text(p['Saran']),
    statusDeal: selectName(p['Status Deal']) || null,
    quotationNominal: numberVal(p['Quotation Nominal']),
    onboardPlan: text(p['Onboard Plan']),
  };
}

export async function fetchAllContacts(): Promise<Contact[]> {
  const results: Contact[] = [];
  let cursor: string | undefined = undefined;
  do {
    const res: any = await notion.dataSources.query({
      data_source_id: DATA_SOURCE_ID,
      start_cursor: cursor,
      page_size: 100,
      sorts: [{ property: 'Hari Sejak Chat Terakhir', direction: 'descending' }],
    });
    for (const page of res.results) results.push(pageToContact(page));
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return results;
}

export async function updateContact(
  pageId: string,
  fields: Partial<{
    statusDeal: string;
    quotationNominal: number | null;
    onboardPlan: string;
    nama: string;
    perusahaan: string;
    industri: string;
  }>
) {
  const properties: Record<string, unknown> = {};
  if (fields.statusDeal !== undefined) {
    properties['Status Deal'] = { select: { name: fields.statusDeal } };
  }
  if (fields.quotationNominal !== undefined) {
    properties['Quotation Nominal'] = { number: fields.quotationNominal };
  }
  if (fields.onboardPlan !== undefined) {
    properties['Onboard Plan'] = { rich_text: [{ text: { content: fields.onboardPlan.slice(0, 1900) } }] };
  }
  if (fields.nama !== undefined) {
    properties['Nama'] = { title: [{ text: { content: fields.nama.slice(0, 1900) } }] };
  }
  if (fields.perusahaan !== undefined) {
    properties['Perusahaan'] = { rich_text: [{ text: { content: fields.perusahaan.slice(0, 1900) } }] };
  }
  if (fields.industri !== undefined) {
    properties['Industri'] = { select: { name: fields.industri } };
  }
  await notion.pages.update({ page_id: pageId, properties: properties as any });
}

export type Task = {
  id: string;
  text: string;
  done: boolean;
  group: string;
  dueDate: string | null;
  contactId: string | null;
};

function checkboxVal(prop: unknown): boolean {
  return (prop as { checkbox?: boolean })?.checkbox || false;
}

function dateVal(prop: unknown): string | null {
  return (prop as { date?: { start: string } | null })?.date?.start || null;
}

function relationId(prop: unknown): string | null {
  const arr = (prop as { relation?: { id: string }[] })?.relation;
  return arr && arr.length ? arr[0].id : null;
}

function pageToTask(page: any): Task {
  const p = page.properties;
  return {
    id: page.id,
    text: title(p['Task']),
    done: checkboxVal(p['Done']),
    group: selectName(p['Group']) || 'Lainnya',
    dueDate: dateVal(p['Due Date']),
    contactId: relationId(p['Kontak']),
  };
}

export async function fetchAllTasks(): Promise<Task[]> {
  const results: Task[] = [];
  let cursor: string | undefined = undefined;
  do {
    const res: any = await notion.dataSources.query({
      data_source_id: TASKS_DATA_SOURCE_ID,
      start_cursor: cursor,
      page_size: 100,
      sorts: [{ timestamp: 'created_time', direction: 'ascending' }],
    });
    for (const page of res.results) results.push(pageToTask(page));
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return results;
}

export async function createTask(text: string, group: string): Promise<Task> {
  const page: any = await notion.pages.create({
    parent: { data_source_id: TASKS_DATA_SOURCE_ID } as any,
    properties: {
      Task: { title: [{ text: { content: text.slice(0, 1900) } }] },
      Done: { checkbox: false },
      Group: { select: { name: group.slice(0, 100) } },
    },
  });
  return pageToTask(page);
}

export async function updateTask(
  pageId: string,
  fields: Partial<{
    text: string;
    done: boolean;
    group: string;
    dueDate: string | null;
    contactId: string | null;
  }>
) {
  const properties: Record<string, unknown> = {};
  if (fields.text !== undefined) {
    properties['Task'] = { title: [{ text: { content: fields.text.slice(0, 1900) } }] };
  }
  if (fields.done !== undefined) {
    properties['Done'] = { checkbox: fields.done };
  }
  if (fields.group !== undefined) {
    properties['Group'] = { select: { name: fields.group.slice(0, 100) } };
  }
  if (fields.dueDate !== undefined) {
    properties['Due Date'] = { date: fields.dueDate ? { start: fields.dueDate } : null };
  }
  if (fields.contactId !== undefined) {
    properties['Kontak'] = { relation: fields.contactId ? [{ id: fields.contactId }] : [] };
  }
  await notion.pages.update({ page_id: pageId, properties: properties as any });
}

export async function deleteTask(pageId: string) {
  await notion.pages.update({ page_id: pageId, archived: true });
}

export const INDUSTRY_OPTIONS = [
  'Oil & Gas',
  'Banking',
  'Manufacturing',
  'Insurance',
  'Healthcare',
  'Government',
  'Other',
  'Unknown',
];

const LISTENER_HEARTBEAT_PAGE_ID = '3c044c46-bc10-8165-b205-d97cd128d5ac';

export async function fetchListenerStatus(): Promise<{ lastHeartbeat: string | null }> {
  try {
    const page: any = await notion.pages.retrieve({ page_id: LISTENER_HEARTBEAT_PAGE_ID });
    const start = page.properties?.['Last Heartbeat']?.date?.start || null;
    return { lastHeartbeat: start };
  } catch {
    return { lastHeartbeat: null };
  }
}

// Shares the same "System Status" page as the heartbeat above, so the AI Briefing
// generated on one device shows up on every other device instead of resetting per session.
function chunkText(s: string, size = 1900): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < s.length; i += size) chunks.push(s.slice(i, i + size));
  return chunks.length ? chunks : [''];
}

export type BriefingStatus = 'todo' | 'in_progress' | 'done';
export type BriefingItem = {
  id: string;
  icon: string;
  tag: string;
  title: string;
  detail: string;
  status: BriefingStatus;
};

// Older saved briefings (before per-item status existed) won't have `id`/`status` —
// backfill them so the UI always has something stable to key/toggle off of.
function normalizeBriefingItems(raw: unknown): BriefingItem[] {
  const arr = Array.isArray(raw) ? raw : [];
  return arr.map((it, i) => ({
    icon: it?.icon || '',
    tag: it?.tag || '',
    title: it?.title || '',
    detail: it?.detail || '',
    id: it?.id || `legacy-${i}`,
    status: it?.status === 'in_progress' || it?.status === 'done' ? it.status : 'todo',
  }));
}

export async function fetchAiBriefing(): Promise<{ items: BriefingItem[] | null; generatedAt: string | null }> {
  try {
    const page: any = await notion.pages.retrieve({ page_id: LISTENER_HEARTBEAT_PAGE_ID });
    const raw = text(page.properties?.['AI Briefing']);
    const generatedAt = page.properties?.['Briefing At']?.date?.start || null;
    if (!raw) return { items: null, generatedAt: null };
    return { items: normalizeBriefingItems(JSON.parse(raw)), generatedAt };
  } catch {
    return { items: null, generatedAt: null };
  }
}

export async function saveAiBriefing(items: BriefingItem[], generatedAt: string) {
  const json = JSON.stringify(items);
  await notion.pages.update({
    page_id: LISTENER_HEARTBEAT_PAGE_ID,
    properties: {
      'AI Briefing': { rich_text: chunkText(json).map((content) => ({ type: 'text', text: { content } })) },
      'Briefing At': { date: { start: generatedAt } },
    },
  });
}

// Only touches the items list, not the generated-at timestamp — checking a card's
// status off shouldn't make the briefing look freshly regenerated.
export async function updateBriefingItems(items: BriefingItem[]) {
  const json = JSON.stringify(items);
  await notion.pages.update({
    page_id: LISTENER_HEARTBEAT_PAGE_ID,
    properties: {
      'AI Briefing': { rich_text: chunkText(json).map((content) => ({ type: 'text', text: { content } })) },
    },
  });
}
