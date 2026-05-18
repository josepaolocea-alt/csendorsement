// RR Posting Reminder — runs hourly via GitHub Actions.
// Emails customersupport@cynsolutions.ph when an RR entry's 3-day timer
// has hit 00:00:00 and the entry is still not posted.

import nodemailer from 'nodemailer';

// --- Config (the API key is public — it is already in index.html) ---
const FIREBASE_API_KEY = 'AIzaSyDNeq1-e3Yx_7AhViQwQXpwpwHddNQzLXo';
const PROJECT_ID = 'cs-endorsement';
const COLLECTION = 'endorsements';

const THREE_DAYS_SECONDS = 259200;       // only this timer duration triggers email
const POSTED_VALUES = ['Posted MRC', 'Removed MRC']; // these mean "already posted" -> skip

const FIREBASE_EMAIL = process.env.FIREBASE_EMAIL;
const FIREBASE_PASSWORD = process.env.FIREBASE_PASSWORD;
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const MAIL_TO = process.env.MAIL_TO;

// Only timers whose expiry moment is on/after GO_LIVE may trigger an email.
// Falls back to "now" if unset/invalid, so an old backlog is never blasted out.
const goLiveParsed = Date.parse(process.env.GO_LIVE || '');
const GO_LIVE_MS = Number.isNaN(goLiveParsed) ? Date.now() : goLiveParsed;

function fail(msg) { console.error('ERROR: ' + msg); process.exit(1); }

if (!FIREBASE_PASSWORD) fail('FIREBASE_PASSWORD secret is missing.');
if (!GMAIL_APP_PASSWORD) fail('GMAIL_APP_PASSWORD secret is missing.');

// --- Decode a Firestore REST "typed value" into a plain JS value ---
function decode(field) {
  if (field == null) return undefined;
  if ('stringValue' in field) return field.stringValue;
  if ('integerValue' in field) return Number(field.integerValue);
  if ('doubleValue' in field) return field.doubleValue;
  if ('booleanValue' in field) return field.booleanValue;
  if ('nullValue' in field) return null;
  return undefined;
}

async function signIn() {
  const res = await fetch(
    'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + FIREBASE_API_KEY,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: FIREBASE_EMAIL, password: FIREBASE_PASSWORD, returnSecureToken: true }),
    }
  );
  if (!res.ok) fail('Firebase sign-in failed: ' + res.status + ' ' + (await res.text()));
  return (await res.json()).idToken;
}

async function fetchAllRecords(idToken) {
  const base = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${COLLECTION}`;
  const docs = [];
  let pageToken = '';
  do {
    const url = base + '?pageSize=300' + (pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : '');
    const res = await fetch(url, { headers: { Authorization: 'Bearer ' + idToken } });
    if (!res.ok) fail('Firestore read failed: ' + res.status + ' ' + (await res.text()));
    const data = await res.json();
    (data.documents || []).forEach((d) => docs.push(d));
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return docs;
}

// Write the "already emailed" marker without touching any other field.
async function markEmailed(idToken, docId, timerStart) {
  const url =
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${COLLECTION}/${docId}` +
    '?updateMask.fieldPaths=rrEmailSentForTimer';
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + idToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { rrEmailSentForTimer: { integerValue: String(timerStart) } } }),
  });
  if (!res.ok) fail('Failed to mark entry ' + docId + ': ' + res.status + ' ' + (await res.text()));
}

function buildEmail(subject) {
  return {
    from: 'CS Endorsement <' + GMAIL_USER + '>',
    to: MAIL_TO,
    subject: 'Reminder to post ' + subject,
    text:
      'Hi CS,\n\n' +
      'This is to remind you for the pending posting of RR ' + subject + '.\n\n\n' +
      'Regards,\n\n' +
      'CS Endorsement\n',
  };
}

async function main() {
  const now = Date.now();
  console.log('Run at ' + new Date(now).toISOString() + ' | GO_LIVE = ' + new Date(GO_LIVE_MS).toISOString());

  const idToken = await signIn();
  const rawDocs = await fetchAllRecords(idToken);
  console.log('Fetched ' + rawDocs.length + ' total records.');

  const due = [];
  for (const d of rawDocs) {
    const f = d.fields || {};
    const r = {
      docId: d.name.split('/').pop(),
      type: decode(f._type),
      subject: decode(f.rrSubject),
      posted: decode(f.rrPosted),
      completed: decode(f.rrCompleted),
      disregard: decode(f.rrDisregard),
      timerStart: decode(f.timerStart),
      timerOverride: decode(f.timerOverride),
      emailedFor: decode(f.rrEmailSentForTimer),
    };

    if (r.type !== 'rr') continue;
    if (r.timerOverride !== THREE_DAYS_SECONDS) continue;   // only the 3-day timer
    if (!r.timerStart) continue;                            // timer not running
    if (r.completed || r.disregard) continue;               // skip completed/disregarded
    if (POSTED_VALUES.includes(r.posted)) continue;         // skip already-posted

    const expiry = r.timerStart + r.timerOverride * 1000;
    if (now < expiry) continue;                             // timer not finished yet
    if (expiry < GO_LIVE_MS) continue;                      // expired before go-live -> ignore
    if (r.emailedFor === r.timerStart) continue;            // already emailed this timer run

    due.push(r);
  }

  console.log(due.length + ' entr' + (due.length === 1 ? 'y' : 'ies') + ' due for a reminder.');
  if (due.length === 0) return;

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
  });

  for (const r of due) {
    const subject = r.subject || '(no subject)';
    await transporter.sendMail(buildEmail(subject));
    console.log('Emailed reminder for: ' + subject);
    // Only mark as emailed AFTER a successful send, so failures retry next hour.
    await markEmailed(idToken, r.docId, r.timerStart);
  }

  console.log('Done. Sent ' + due.length + ' reminder email(s).');
}

main().catch((e) => fail(e && e.stack ? e.stack : String(e)));
