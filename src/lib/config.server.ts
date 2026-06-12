export function getGeminiApiKey(): string {
  const key =
    (globalThis as any).GEMINI_API_KEY ??
    (globalThis as any).ENV?.GEMINI_API_KEY ??
    (globalThis as any).__env__?.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY belum dikonfigurasi di server.");
  return key;
}