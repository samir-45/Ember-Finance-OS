import { z } from 'zod';

// Configuring a Gemini key on the server is the opt-in; the owner also switches
// quick entry on in Settings before any text leaves the app.
export const aiAvailable = () => Boolean(process.env.GEMINI_API_KEY);

export class AiError extends Error {
  constructor(
    readonly kind: 'unavailable' | 'provider' | 'unreadable',
    message: string,
  ) {
    super(message);
  }
}

export async function generateJson<T>(prompt: string, schema: z.ZodType<T>): Promise<T> {
  if (!aiAvailable()) throw new AiError('unavailable', 'AI is not set up on this server');
  let res: Response;
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(process.env.GEMINI_MODEL || 'gemini-3.8-flash')}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': process.env.GEMINI_API_KEY!,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 2000 },
        }),
        signal: AbortSignal.timeout(20000),
      },
    );
  } catch {
    throw new AiError('provider', 'AI provider unreachable');
  }
  if (!res.ok) throw new AiError('provider', 'AI provider unavailable');
  const raw = (await res.json())?.candidates?.[0]?.content?.parts?.[0]?.text;
  try {
    return schema.parse(JSON.parse(String(raw)));
  } catch {
    throw new AiError('unreadable', 'AI response did not match the expected format');
  }
}

const requests = new Map<string, number[]>();
export function allowAiRequest(): boolean {
  const now = Date.now();
  const recent = (requests.get('owner') ?? []).filter((t) => now - t < 60000);
  if (recent.length >= 10) return false;
  requests.set('owner', [...recent, now]);
  return true;
}
