import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === '/login' || pathname === '/api/login') {
    return NextResponse.next();
  }

  const session = request.cookies.get('session')?.value;
  if (session !== process.env.SESSION_TOKEN) {
    const url = new URL('/login', request.url);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
