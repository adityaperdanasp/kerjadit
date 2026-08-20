import { NextResponse } from 'next/server';
import { appendSheetRow } from '@/lib/googleSheets';
import { PENDING_JOB_SHEET_ID, PENDING_JOB_SHEET_NAME } from '@/lib/sheets';

export async function POST(request: Request) {
  const { group, text } = await request.json();
  if (!group || !group.trim() || !text || !text.trim()) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  try {
    const id = crypto.randomUUID();
    const { sheetRow } = await appendSheetRow(PENDING_JOB_SHEET_ID, PENDING_JOB_SHEET_NAME, [
      group.trim(),
      text.trim(),
      '',
      '',
      'FALSE',
      id,
    ]);
    return NextResponse.json({
      ok: true,
      job: { id, group: group.trim(), text: text.trim(), pic: '', dueDate: null, done: false, sheetRow },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
