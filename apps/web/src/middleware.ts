import { NextRequest, NextResponse } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAuthPage = pathname === '/sign-in' || pathname === '/sign-up';
  const hasCookie = Boolean(getSessionCookie(request));

  if (!hasCookie && !isAuthPage) {
    const nextUrl = new URL('/sign-in', request.url);
    nextUrl.searchParams.set('next', pathname + request.nextUrl.search);
    return NextResponse.redirect(nextUrl);
  }

  if (hasCookie && isAuthPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/conversations/:path*', '/pair', '/settings', '/sign-in', '/sign-up'],
};
