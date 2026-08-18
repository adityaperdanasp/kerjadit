import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const PUBLIC_PATHS = [
    '/login',
    '/api/login',
    '/icon',
    '/apple-icon',
    '/pwa-icon-192',
    '/pwa-icon-512',
    '/manifest.webmanifest',
  ];
  if (PUBLIC_PATHS.includes(pathname)) {
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
