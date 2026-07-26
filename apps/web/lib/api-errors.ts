import { NextResponse } from 'next/server';
import { LimitError } from './billing';

/** Map a plan-limit error to HTTP 402 (+ upgrade flag); return null otherwise. */
export function limitErrorResponse(e: unknown): NextResponse | null {
  if (e instanceof LimitError) {
    return NextResponse.json({ error: e.message, code: e.code, upgrade: true }, { status: 402 });
  }
  return null;
}
