/** Fields nulled out of every MCP tool result when the calling key has
 * `redactSensitive` set (the default) — real third-party PII and AI-derived
 * character judgments that shouldn't leave the app unless explicitly opted
 * into via a non-redacted key. See the ApiKey model doc-comment. */
const REDACTED_CONTACT_FIELDS = {
  phone: null,
  linkedin: null,
  telegram: null,
  instagram: null,
  whatsapp: null,
  city: null,
  country: null,
  temperament: null,
  needs: null,
  valuePotential: null,
  fullSummary: null,
} as const;

export function sanitizeContact<T extends Record<string, unknown>>(contact: T, redact: boolean): T {
  if (!redact) return contact;
  return { ...contact, ...REDACTED_CONTACT_FIELDS };
}

/** `followUp` (the actionable reminder itself) is deliberately NOT redacted —
 * only the fuller freeform note is, since hiding `followUp` would defeat the
 * point of a follow-up-listing tool. */
export function sanitizeRawText<T extends { rawText: string }>(item: T, redact: boolean): T {
  if (!redact) return item;
  return { ...item, rawText: "[redacted]" };
}
