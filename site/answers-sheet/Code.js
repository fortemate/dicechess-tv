// Dice Chess TV: the answers of the site's tester pages, the colour-vision
// check (/check/) and the feedback form (/feedback/), appended to the Google
// Sheet this script is bound to, one row per submission. Setup: README.md next
// to this file.
//
// Only what the pages send is stored: no name, email or IP address reaches this
// script. Every value is checked against its allowed set or length, and a
// submission with anything else is refused, so the sheet can hold nothing the
// pages could not have sent.

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

const HEADERS = {
  check: [
    'Received',
    'Colour vision',
    'Screen',
    ...VARIANTS.flatMap((variant) =>
      COUNTS.map((count) => `${variant} ${count}`),
    ),
    'Details',
  ],
  feedback: [
    'Received',
    'Played on',
    'Confusing or hard',
    'Liked',
    'Went wrong',
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
  let row = null;
  if (data.kind === 'check') row = checkRow(data);
  else if (data.kind === 'feedback') row = feedbackRow(data);
  if (!row) return reply(false);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = sheetFor(data.kind);
    if (sheet.getLastRow() > MAX_ROWS) return reply(false);
    sheet.appendRow([new Date(), ...row.map(asText)]);
  } finally {
    lock.releaseLock();
  }
  return reply(true);
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
  const counts = [];
  for (const variant of VARIANTS) {
    const score = data.score && data.score[variant];
    for (const count of COUNTS) {
      const value = score && score[count];
      if (!Number.isInteger(value) || value < 0 || value > 64) return null;
      counts.push(value);
    }
  }
  if (!validDetails(data.order, data.taps)) return null;
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
