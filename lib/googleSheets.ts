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
