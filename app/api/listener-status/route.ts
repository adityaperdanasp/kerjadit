import { NextResponse } from 'next/server';
import { fetchListenerStatus } from '@/lib/notion';

export async function GET() {
  const status = await fetchListenerStatus();
  return NextResponse.json(status);
}
