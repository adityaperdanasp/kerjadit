import { JWT } from 'google-auth-library';

let client: JWT | null = null;

function getClient(): JWT {
  if (!client) {
    client = new JWT({
      email: process.env.GOOGLE_SA_EMAIL,
      key: (process.env.GOOGLE_SA_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
  }
  return client;
}

function colToLetter(col: number): string {
  let n = col + 1;
  let letter = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}

export function cellA1(sheetName: string, row: number, col: number): string {
  return `'${sheetName}'!${colToLetter(col)}${row + 1}`;
}

export async function updateSheetCell(
  spreadsheetId: string,
  sheetName: string,
  row: number,
  col: number,
  value: string
) {
  const auth = getClient();
  const range = cellA1(sheetName, row, col);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
    range
  )}?valueInputOption=USER_ENTERED`;

  const res = await auth.request({
    url,
    method: 'PUT',
    data: { range, majorDimension: 'ROWS', values: [[value]] },
  });
  return res.data;
}

// Appends a row after the sheet's last used row and reports which row it landed on
// (needed since concurrent edits mean we can't predict the row ahead of time).
export async function appendSheetRow(
  spreadsheetId: string,
  sheetName: string,
  values: string[]
): Promise<{ sheetRow: number }> {
  const auth = getClient();
  const range = `'${sheetName}'!A:${colToLetter(values.length - 1)}`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
    range
  )}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const res = await auth.request<{ updates: { updatedRange: string } }>({
    url,
    method: 'POST',
    data: { range, majorDimension: 'ROWS', values: [values] },
  });
  const updatedRange: string = res.data.updates.updatedRange;
  const match = updatedRange.match(/![A-Z]+(\d+)/);
  const sheetRow = match ? Number(match[1]) - 1 : -1;
  return { sheetRow };
}

// Blanks a row's cells rather than deleting the sheet row, so other rows' already-known
// sheetRow numbers stay valid for the rest of the current page load.
export async function clearSheetRow(
  spreadsheetId: string,
  sheetName: string,
  row: number,
  colCount: number
) {
  const auth = getClient();
  const range = `'${sheetName}'!A${row + 1}:${colToLetter(colCount - 1)}${row + 1}`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
    range
  )}:clear`;

  const res = await auth.request({ url, method: 'POST' });
  return res.data;
}
