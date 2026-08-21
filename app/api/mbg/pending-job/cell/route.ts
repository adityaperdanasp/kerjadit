import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { updateSheetCell } from '@/lib/googleSheets';
import { PENDING_JOB_SHEET_ID, PENDING_JOB_SHEET_NAME } from '@/lib/sheets';

export async function POST(request: Request) {
  const { sheetRow, col, value } = await request.json();
  if (typeof sheetRow !== 'number' || typeof col !== 'number') {
    return NextResponse.json({ ok: false, error: 'invalid cell position' }, { status: 400 });
  }
  try {
    await updateSheetCell(PENDING_JOB_SHEET_ID, PENDING_JOB_SHEET_NAME, sheetRow, col, String(value ?? ''));
    revalidatePath('/mbg');
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
