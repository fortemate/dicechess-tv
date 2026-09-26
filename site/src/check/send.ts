// Sends the answers of a tester page to the answers sheet
// (site/answers-sheet/). The address is the repository variable FEEDBACK_URL,
// read when the site is built; without it, nothing is sent.
export const ENDPOINT: string = import.meta.env.PUBLIC_FEEDBACK_URL ?? '';

// A random id for one visit. The sheet stores a submission once even if it
// arrives twice, as it may when a reply is lost and the visitor sends again.
// It identifies nobody and is not kept in the browser.
export function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // An older browser, or an address that is not https: the same format.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0'));
  return [0, 4, 6, 8, 10]
    .map((start, i, starts) => hex.slice(start, starts[i + 1]).join(''))
    .join('-');
}

export async function send(payload: object): Promise<boolean> {
  if (!ENDPOINT) return false;
  try {
    // As text/plain the request stays a "simple" one, which the browser sends
    // without a CORS preflight: Apps Script does not answer preflights.
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });
    const result = (await response.json()) as { ok?: unknown };
    return result.ok === true;
  } catch {
    return false;
  }
}
