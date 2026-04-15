import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const API_KEY = process.env.NEXT_PUBLIC_API_KEY || '';

// Inject the API key header on requests that get proxied to the backend.
// This covers fetch('/api/...') calls and /tmp/ asset loads that go through
// the Next.js rewrite rules in next.config.js.
export function middleware(request: NextRequest) {
  if (!API_KEY) return NextResponse.next();

  const response = NextResponse.next();
  // NextResponse.next() with `request.headers` forwards them; we add our key
  const headers = new Headers(request.headers);
  headers.set('X-API-Key', API_KEY);

  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ['/api/:path*', '/tmp/:path*'],
};
