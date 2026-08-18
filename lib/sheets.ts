const SHEET_ID = '1bnUc0yTl3rAH5EWEjf_HBH4zVLZZXKJEBhdG0bFbQ2M';

const SPM_TABS = [
  { label: 'Juni', gid: '639702659' },
  { label: 'Juli', gid: '785194236' },
  { label: 'Agustus', gid: '0' },
];
const PETTY_CASH_GID = '1531376938';

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

async function fetchTabCsv(gid: string): Promise<string[][]> {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`;
  try {
    const res = await fetch(url, { next: { revalidate: 30 } });
    if (!res.ok) return [];
    const text = await res.text();
    return parseCsv(text);
  } catch {
    return [];
  }
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
