// Dice Chess TV: the answers of the site's tester pages, the colour-vision
// check (/check/) and the feedback form (/feedback/), appended to the Google
// Sheet this script is bound to, one row per submission. Setup: README.md next
// to this file.
//
// Only what the pages send is stored. They ask for no name or email, and no IP
// address reaches this script; the feedback form's free text holds whatever a
// visitor types, and the page asks them to leave personal details out. Every
// value is checked against its allowed set or length, and a submission with
// anything else is refused, so the sheet can hold nothing the pages could not
// have sent.

const MAX_ROWS = 5000;
const MAX_TEXT = 1000;
// The lists the pages offer (site/src/check/items.ts and
// site/src/pages/feedback.astro).
const VISION = ['none', 'red-green', 'blue-yellow', 'yes-unknown', 'not-sure'];
const SCREEN = ['phone', 'tablet', 'computer', 'tv'];
const PLAYED_ON = ['', 'stick', 'vvd', 'other'];
const VARIANTS = ['A', 'B', 'C'];
const COUNTS = ['found', 'missed', 'lastMove', 'other'];
const PICTURE = /^[abc]-(many|few)$/;
// A random id the page draws once per visit (site/src/check/send.ts), so that a
// submission sent twice, a retry after a lost reply, is stored once. It says
// nothing about who sent it.
const SUBMISSION =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
// How far back, in rows, a repeated submission is looked for.
const RECENT = 500;

const HEADERS = {
  check: [
    'Received',
    'Colour vision',
    'Screen',
    ...VARIANTS.flatMap((variant) =>
      COUNTS.map((count) => `${variant} ${count}`),
    ),
    'Details',
    'Submission',
  ],
  feedback: [
    'Received',
    'Played on',
    'Confusing or hard',
    'Liked',
    'Went wrong',
    'Submission',
  ],
};

function doPost(e) {
  let data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch {
    return reply(false);
  }
  if (!data || typeof data !== 'object') return reply(false);
  // A field the pages hide from people. Bots that fill in every field fill in
  // this one too, and are told they succeeded.
  if (data.website) return reply(true);
  if (typeof data.id !== 'string' || !SUBMISSION.test(data.id)) {
    return reply(false);
  }
  let row = null;
  if (data.kind === 'check') row = checkRow(data);
  else if (data.kind === 'feedback') row = feedbackRow(data);
  if (!row) return reply(false);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = sheetFor(data.kind);
    if (storedBefore(sheet, data.kind, data.id)) return reply(true);
    if (sheet.getLastRow() > MAX_ROWS) return reply(false);
    sheet.appendRow([new Date(), ...row.map(asText), data.id]);
  } finally {
    lock.releaseLock();
  }
  return reply(true);
}

// Whether a submission with this id is among the recent rows of the tab.
function storedBefore(sheet, kind, id) {
  const last = sheet.getLastRow();
  if (last < 2) return false;
  const first = Math.max(2, last - RECENT + 1);
  return sheet
    .getRange(first, HEADERS[kind].length, last - first + 1, 1)
    .getValues()
    .some(([value]) => value === id);
}

// Opening the web app's address in a browser shows that it is deployed.
function doGet() {
  return ContentService.createTextOutput(
    'Dice Chess TV answers: this address accepts the answers of the site.',
  );
}

function checkRow(data) {
  if (data.v !== 1) return null;
  if (!VISION.includes(data.vision) || !SCREEN.includes(data.screen)) {
    return null;
  }
  if (!validDetails(data.order, data.taps)) return null;
  // A count adds up over the pictures of one variant, at most 64 squares each,
  // and a variant has no more pictures than were shown.
  const most = 64 * data.order.length;
  const counts = [];
  for (const variant of VARIANTS) {
    const score = data.score && data.score[variant];
    for (const count of COUNTS) {
      const value = score && score[count];
      if (!Number.isInteger(value) || value < 0 || value > most) return null;
      counts.push(value);
    }
  }
  const details = JSON.stringify({ order: data.order, taps: data.taps });
  return [data.vision, data.screen, ...counts, details];
}

function validDetails(order, taps) {
  if (!Array.isArray(order) || order.length === 0 || order.length > 12) {
    return false;
  }
  if (order.some((id) => typeof id !== 'string' || !PICTURE.test(id))) {
    return false;
  }
  if (new Set(order).size !== order.length) return false;
  if (!taps || typeof taps !== 'object' || Array.isArray(taps)) return false;
  return Object.entries(taps).every(
    ([id, cells]) =>
      order.includes(id) &&
      Array.isArray(cells) &&
      cells.length <= 64 &&
      cells.every((cell) => Number.isInteger(cell) && cell >= 0 && cell < 64),
  );
}

function feedbackRow(data) {
  if (data.v !== 1) return null;
  const playedOn = data.playedOn ?? '';
  if (!PLAYED_ON.includes(playedOn)) return null;
  const texts = [data.confusing, data.liked, data.broke].map(
    (text) => text ?? '',
  );
  if (
    texts.some((text) => typeof text !== 'string' || text.length > MAX_TEXT)
  ) {
    return null;
  }
  if (texts.every((text) => text.trim() === '')) return null;
  return [playedOn, ...texts.map((text) => text.trim())];
}

function sheetFor(kind) {
  const book = SpreadsheetApp.getActive();
  let sheet = book.getSheetByName(kind);
  if (!sheet) {
    sheet = book.insertSheet(kind);
    sheet.appendRow(HEADERS[kind]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// A sheet runs a cell that starts with one of these characters as a formula,
// and a formula can fetch from the web when the sheet is opened. A leading
// apostrophe keeps the text as text.
function asText(value) {
  return typeof value === 'string' && /^[=+\-@\t\r]/.test(value)
    ? `'${value}`
    : value;
}

function reply(ok) {
  return ContentService.createTextOutput(JSON.stringify({ ok })).setMimeType(
    ContentService.MimeType.JSON,
  );
}
