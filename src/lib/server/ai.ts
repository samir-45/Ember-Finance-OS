import { z } from 'zod';
// Server-side allow switch is separate from each request's explicit user consent.
export async function generateJson<T>(prompt: string, schema: z.ZodType<T>): Promise<T> {
  if (process.env.EMBER_ENABLE_EXTERNAL_AI !== 'true' || !process.env.GEMINI_API_KEY)
    throw new Error('External AI is disabled on this server');
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(process.env.GEMINI_MODEL || 'gemini-3.8-flash')}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 2000 },
      }),
      signal: AbortSignal.timeout(20000),
    },
  );
  if (!res.ok) throw new Error('AI provider unavailable');
  const body = await res.json();
  const raw = body?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof raw !== 'string') throw new Error('Invalid AI response');
  return schema.parse(JSON.parse(raw));
}
const requests = new Map<string, number[]>();
export function allowAiRequest(): boolean {
  const now = Date.now();
  const recent = (requests.get('owner') ?? []).filter((t) => now - t < 60000);
  if (recent.length >= 10) return false;
  requests.set('owner', [...recent, now]);
  return true;
}
