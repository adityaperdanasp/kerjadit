import { NextResponse } from 'next/server';
import { updateSheetCell } from '@/lib/googleSheets';
import { FINANCIAL_STATEMENT_SHEET_ID, FINANCIAL_STATEMENT_SHEET_NAME } from '@/lib/sheets';

export async function POST(request: Request) {
  const { sheetRow, sheetCol, value } = await request.json();
  if (typeof sheetRow !== 'number' || typeof sheetCol !== 'number') {
    return NextResponse.json({ ok: false, error: 'invalid cell position' }, { status: 400 });
  }
  try {
    await updateSheetCell(
      FINANCIAL_STATEMENT_SHEET_ID,
      FINANCIAL_STATEMENT_SHEET_NAME,
      sheetRow,
      sheetCol,
      String(value ?? '')
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
