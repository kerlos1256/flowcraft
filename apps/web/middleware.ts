import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySession } from '@/lib/jwt';

// Protect the authenticated app pages. API routes enforce auth themselves (so
// they can return 401 JSON + Inngest/webhook routes stay public). The landing,
// login, and signup pages are public.
const PROTECTED = ['/app', '/workflows', '/runs', '/welcome'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const needsAuth = PROTECTED.some((p) => pathname === p || pathname.startsWith(p + '/'));
  if (!needsAuth) return NextResponse.next();

  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (session) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.searchParams.set('next', pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/app/:path*', '/workflows/:path*', '/runs/:path*', '/welcome'],
};
