// Array columns are stored as JSON text (see README); decode defensively so one
// malformed row can't take down a whole list response.
export function parseJsonArray(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}
