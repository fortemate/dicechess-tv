// Sends the answers of a tester page to the answers sheet
// (site/answers-sheet/). The address is the repository variable FEEDBACK_URL,
// read when the site is built; without it, nothing is sent.
export const ENDPOINT: string = import.meta.env.PUBLIC_FEEDBACK_URL ?? '';

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
