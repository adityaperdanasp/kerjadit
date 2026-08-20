const SHEET_ID = '1bnUc0yTl3rAH5EWEjf_HBH4zVLZZXKJEBhdG0bFbQ2M';
const MBG_SHEET_ID = '1ogYGnj4HP5CthXg4nVZzh9l4CXpOcGEHn0jzJnJHcS8';

const SPM_TABS = [
  { label: 'Juni', gid: '639702659' },
  { label: 'Juli', gid: '785194236' },
  { label: 'Agustus', gid: '0' },
];
const PETTY_CASH_GID = '1531376938';
const FINANCIAL_STATEMENT_GID = '74504632';
const PENDING_JOB_GID = '956241155';

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c === '\r') {
      // skip
    } else {
      field += c;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

async function fetchCsv(sheetId: string, gid: string): Promise<string[][]> {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
  try {
    const res = await fetch(url, { next: { revalidate: 30 } });
    if (!res.ok) return [];
    const text = await res.text();
    return parseCsv(text);
  } catch {
    return [];
  }
}

function fetchTabCsv(gid: string): Promise<string[][]> {
  return fetchCsv(SHEET_ID, gid);
}

export type SpmRow = {
  kode: string;
  keterangan: string;
  maker: string;
  approved: string;
  linkNota: string;
};
export type SpmGroup = { label: string; rows: SpmRow[]; error: boolean };

export async function fetchSpmData(): Promise<SpmGroup[]> {
  const groups = await Promise.all(
    SPM_TABS.map(async (tab) => {
      const rows = await fetchTabCsv(tab.gid);
      const dataRows = rows.slice(1).filter((r) => r.some((c) => c.trim()));
      return {
        label: tab.label,
        error: rows.length === 0,
        rows: dataRows.map((r) => ({
          kode: r[0] || '',
          keterangan: r[1] || '',
          maker: r[2] || '',
          approved: r[3] || '',
          linkNota: r[4] || '',
        })),
      };
    })
  );
  return groups;
}

export type PettyCashRow = {
  tanggal: string;
  keterangan: string;
  debit: string;
  kredit: string;
  saldo: string;
  linkNota: string;
};

export async function fetchPettyCash(): Promise<{
  title: string;
  rows: PettyCashRow[];
  error: boolean;
}> {
  const rows = await fetchTabCsv(PETTY_CASH_GID);
  if (rows.length === 0) return { title: 'Petty Cash', rows: [], error: true };
  const headerIdx = rows.findIndex((r) => r[0]?.trim() === 'Tanggal');
  const title = rows
    .slice(0, headerIdx >= 0 ? headerIdx : 0)
    .map((r) => r[0])
    .filter(Boolean)
    .join(' — ');
  const dataRows = headerIdx >= 0 ? rows.slice(headerIdx + 1) : [];
  return {
    title: title || 'Petty Cash',
    error: false,
    rows: dataRows
      .filter((r) => r.some((c) => c.trim()))
      .map((r) => ({
        tanggal: r[0] || '',
        keterangan: r[1] || '',
        debit: r[2] || '',
        kredit: r[3] || '',
        saldo: r[4] || '',
        linkNota: r[5] || '',
      })),
  };
}

export const FINANCIAL_STATEMENT_SHEET_ID = MBG_SHEET_ID;
export const FINANCIAL_STATEMENT_SHEET_NAME = 'Financial Statement';

// header/rows are the display strings; sheetRow/sheetCol give each cell's real
// (0-indexed) position in the Google Sheet, for writing edits back precisely.
export type FinTable = {
  title: string;
  header: string[];
  rows: string[][];
  rowSheetRows: number[]; // sheet row for each entry in `rows`
  colSheetCols: number[]; // sheet column for each entry in `header`/each row's cells
  editableRows: boolean[]; // false for total/balance rows — never write those back
};

function isBlankRow(row: string[]): boolean {
  return !row.some((c) => c.trim());
}

function isSectionTitleRow(row: string[]): boolean {
  const title = row[1]?.trim() || '';
  return (
    !row[0]?.trim() &&
    !!title &&
    !/^\d+$/.test(title) &&
    row.slice(2).every((c) => !c.trim())
  );
}

function isHeaderRow(row: string[]): boolean {
  const first = row[1]?.trim().toLowerCase();
  return first === 'no' || first === 'no.';
}

function isTotalRow(row: string[]): boolean {
  return /total|grand total|saldo|balance/i.test(row[0] || row[1] || '');
}

function trimEmptyColumns(
  header: string[],
  rows: string[][]
): { header: string[]; rows: string[][]; colSheetCols: number[] } {
  const width = Math.max(header.length, ...rows.map((r) => r.length), 0);
  const keep: number[] = [];
  for (let i = 0; i < width; i++) {
    const hasHeader = (header[i] || '').trim();
    const hasData = rows.some((r) => (r[i] || '').trim());
    if (hasHeader || hasData) keep.push(i);
  }
  return {
    header: keep.map((i) => header[i] || ''),
    rows: rows.map((r) => keep.map((i) => r[i] || '')),
    colSheetCols: keep,
  };
}

function fixHeaderGaps(header: string[]): string[] {
  const out = [...header];
  for (let i = 1; i < out.length; i++) {
    if (!out[i]?.trim() && out[i - 1]?.trim()) {
      out[i] = `${out[i - 1]} Tgl`;
    }
  }
  return out;
}

function toTitleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bMbg\b/g, 'MBG')
    .replace(/\bDs\b/g, 'DS')
    .replace(/\bCgk\b/g, 'CGK');
}

function buildSubTables(
  blockTitle: string,
  blockRows: string[][],
  blockRowNums: number[]
): FinTable[] {
  const headerIdxs: number[] = [];
  blockRows.forEach((r, i) => {
    if (isHeaderRow(r)) headerIdxs.push(i);
  });
  if (headerIdxs.length === 0) return [];

  const niceBlockTitle = toTitleCase(blockTitle);
  const tables: FinTable[] = [];
  for (let h = 0; h < headerIdxs.length; h++) {
    const start = headerIdxs[h];
    const end = h + 1 < headerIdxs.length ? headerIdxs[h + 1] : blockRows.length;
    const rawHeader = blockRows[start];

    const dataRowsRaw: string[][] = [];
    const dataRowNums: number[] = [];
    for (let i = start + 1; i < end; i++) {
      if (!isBlankRow(blockRows[i])) {
        dataRowsRaw.push(blockRows[i]);
        dataRowNums.push(blockRowNums[i]);
      }
    }

    const trimmed = trimEmptyColumns(rawHeader, dataRowsRaw);
    const header = fixHeaderGaps(trimmed.header);
    const rows = trimmed.rows;

    let title = niceBlockTitle;
    if (headerIdxs.length > 1) {
      // Multiple header rows in one block (e.g. INCOME + EXPENSES) — name each
      // sub-table after its own category column instead of the shared block title.
      const category = rawHeader[2]?.trim();
      if (category) title = toTitleCase(category);
    } else if (blockRows.some((r) => r.includes('Harian')) && blockTitle.includes('PROFIT INVESTOR')) {
      title = `${niceBlockTitle} (Sewa & Supply Chain)`;
    } else if (blockRows.some((r) => r.includes('BEP (Month)')) && blockTitle.includes('PROFIT INVESTOR')) {
      title = `${niceBlockTitle} (BEP)`;
    }
    tables.push({
      title,
      header,
      rows,
      rowSheetRows: dataRowNums,
      colSheetCols: trimmed.colSheetCols,
      editableRows: dataRowsRaw.map((r) => !isTotalRow(r)),
    });
  }
  return tables;
}

export async function fetchFinancialStatement(): Promise<{ tables: FinTable[]; error: boolean }> {
  const rows = await fetchCsv(MBG_SHEET_ID, FINANCIAL_STATEMENT_GID);
  if (rows.length === 0) return { tables: [], error: true };

  const blocks: { title: string; rows: string[][]; rowNums: number[] }[] = [];
  let current: { title: string; rows: string[][]; rowNums: number[] } | null = null;
  rows.forEach((row, idx) => {
    if (isSectionTitleRow(row)) {
      if (current) blocks.push(current);
      current = { title: row[1].trim(), rows: [], rowNums: [] };
    } else if (current) {
      current.rows.push(row);
      current.rowNums.push(idx);
    }
  });
  if (current) blocks.push(current);

  const tables = blocks.flatMap((b) => buildSubTables(b.title, b.rows, b.rowNums));
  const pengembalianIdx = tables.findIndex((t) => /pengembalian modal/i.test(t.title));
  if (pengembalianIdx > 0) {
    const [pengembalian] = tables.splice(pengembalianIdx, 1);
    tables.unshift(pengembalian);
  }
  return { tables, error: false };
}

export const PENDING_JOB_SHEET_ID = MBG_SHEET_ID;
export const PENDING_JOB_SHEET_NAME = 'Pending Job';
// 0-indexed column positions, shared with the API routes that write cells back.
export const PENDING_JOB_COLS = { group: 0, text: 1, pic: 2, dueDate: 3, done: 4, id: 5 } as const;

export type PendingJobItem = {
  id: string;
  text: string;
  pic: string;
  dueDate: string | null;
  done: boolean;
  sheetRow: number;
};
export type PendingJobGroup = { group: string; items: PendingJobItem[] };

export async function fetchPendingJobs(): Promise<{ groups: PendingJobGroup[]; error: boolean }> {
  const rows = await fetchCsv(MBG_SHEET_ID, PENDING_JOB_GID);
  if (rows.length === 0) return { groups: [], error: true };
  const order: string[] = [];
  const map = new Map<string, PendingJobItem[]>();
  rows.forEach((r, i) => {
    if (i === 0) return; // header row
    const group = (r[PENDING_JOB_COLS.group] || '').trim();
    const id = (r[PENDING_JOB_COLS.id] || '').trim();
    if (!group || !id) return;
    const item: PendingJobItem = {
      id,
      text: r[PENDING_JOB_COLS.text] || '',
      pic: r[PENDING_JOB_COLS.pic] || '',
      dueDate: r[PENDING_JOB_COLS.dueDate]?.trim() || null,
      done: /^(true|yes|1)$/i.test((r[PENDING_JOB_COLS.done] || '').trim()),
      sheetRow: i,
    };
    if (!map.has(group)) {
      map.set(group, []);
      order.push(group);
    }
    map.get(group)!.push(item);
  });
  return { groups: order.map((g) => ({ group: g, items: map.get(g)! })), error: false };
}
