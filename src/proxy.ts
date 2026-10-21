import { NextRequest, NextResponse } from 'next/server';
import { authenticated } from '@/lib/server/auth';
import { safeReturnPath } from '@/lib/auth-navigation';

export function proxy(request: NextRequest) {
  const signedIn = authenticated(request);
  const login = request.nextUrl.pathname === '/login';
  let response: NextResponse;
  if (!signedIn && !login) {
    const destination = new URL('/login', request.url);
    destination.searchParams.set(
      'next',
      safeReturnPath(request.nextUrl.pathname + request.nextUrl.search),
    );
    response = NextResponse.redirect(destination);
  } else if (signedIn && login) {
    response = NextResponse.redirect(
      new URL(safeReturnPath(request.nextUrl.searchParams.get('next')), request.url),
    );
  } else {
    response = NextResponse.next();
  }
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  return response;
}

// API handlers retain their own authorization; only framework assets and the
// public background image bypass the page gate.
export const config = {
  matcher: ['/((?!api(?:/|$)|_next(?:/|$)|TudSa\\.webp$|favicon\\.ico$).*)'],
};
