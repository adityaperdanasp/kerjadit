import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { clearSheetRow } from '@/lib/googleSheets';
import { PENDING_JOB_SHEET_ID, PENDING_JOB_SHEET_NAME } from '@/lib/sheets';

export async function DELETE(request: Request, ctx: { params: Promise<{ sheetRow: string }> }) {
  const { sheetRow } = await ctx.params;
  const row = Number(sheetRow);
  if (!Number.isFinite(row)) {
    return NextResponse.json({ ok: false, error: 'invalid row' }, { status: 400 });
  }
  try {
    await clearSheetRow(PENDING_JOB_SHEET_ID, PENDING_JOB_SHEET_NAME, row, 6);
    revalidatePath('/mbg');
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
