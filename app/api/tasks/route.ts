import { NextResponse } from 'next/server';
import { createTask } from '@/lib/notion';

export async function POST(request: Request) {
  const { text } = await request.json();
  if (!text || !text.trim()) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  try {
    const task = await createTask(text.trim());
    return NextResponse.json({ ok: true, task });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
