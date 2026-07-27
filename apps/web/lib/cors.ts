import { NextResponse } from 'next/server';

// Public widget endpoints are embedded on any site, so they allow all origins.
// (App-level origin allowlisting for submissions is enforced separately.)
export function cors(res: NextResponse): NextResponse {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'content-type');
  res.headers.set('Access-Control-Max-Age', '86400');
  return res;
}

export const corsPreflight = () => cors(new NextResponse(null, { status: 204 }));
