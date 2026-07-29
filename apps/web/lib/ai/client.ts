// Server-only Anthropic client (lazy singleton). Never import from client
// components — it reads ANTHROPIC_API_KEY. The key is required to make any call;
// aiConfigured() lets the UI degrade gracefully when it's absent.
import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

let client: Anthropic | null = null;

export const aiConfigured = (): boolean => !!process.env.ANTHROPIC_API_KEY;

export function anthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('AI is not configured on this server (missing ANTHROPIC_API_KEY).');
  }
  return (client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }));
}
