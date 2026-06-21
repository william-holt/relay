import Anthropic from "@anthropic-ai/sdk";

/**
 * Server-only Anthropic client. Created lazily so a missing key fails loudly at
 * request time (with a clear error) rather than at build time.
 */
let client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("[anthropic] Missing ANTHROPIC_API_KEY");
  client = new Anthropic({ apiKey });
  return client;
}

// Default to the latest Opus; override via env if needed.
export const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8";

/**
 * Pull the first JSON object/array out of a model's text response. Models wrap
 * JSON in prose or ```json fences often enough that lenient extraction is safer
 * than assuming a clean body.
 */
export function extractJson<T = unknown>(text: string): T | null {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [fenced?.[1], text];
  for (const c of candidates) {
    if (!c) continue;
    const start = c.search(/[[{]/);
    if (start === -1) continue;
    // Walk to the matching closing bracket.
    const open = c[start];
    const close = open === "{" ? "}" : "]";
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = start; i < c.length; i++) {
      const ch = c[i];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === "\\") esc = true;
        else if (ch === '"') inStr = false;
      } else if (ch === '"') inStr = true;
      else if (ch === open) depth++;
      else if (ch === close) {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(c.slice(start, i + 1)) as T;
          } catch {
            break;
          }
        }
      }
    }
  }
  return null;
}
