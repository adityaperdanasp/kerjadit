import { Client } from '@notionhq/client';

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DATA_SOURCE_ID = process.env.NOTION_DATA_SOURCE_ID!;

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
  fields: Partial<{ statusDeal: string; quotationNominal: number | null; onboardPlan: string }>
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
  await notion.pages.update({ page_id: pageId, properties: properties as any });
}
