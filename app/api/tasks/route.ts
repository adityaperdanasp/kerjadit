import { NextResponse } from 'next/server';
import { createTask } from '@/lib/notion';

export async function POST(request: Request) {
  const { text, group } = await request.json();
  if (!text || !text.trim() || !group || !group.trim()) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  try {
    const task = await createTask(text.trim(), group.trim());
    return NextResponse.json({ ok: true, task });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
