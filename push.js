// ===== Web Push (medication reminders) =====
// Sends a real push notification at the scheduled dose time even when the
// browser tab is closed. The client registers its push subscription plus the
// current reminder list; this module schedules and dispatches the sends.

const fs = require('fs');
const path = require('path');

// Load .env here too so this module works regardless of entry point.
// dotenv is idempotent, and quiet avoids a second "injected env" banner when
// server.js has already loaded it.
try {
    require('dotenv').config({ quiet: true });
} catch (e) {
    console.warn('Web Push: dotenv unavailable:', e.message);
}

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:dev@mediassist.local';

const pushEnabled = !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
let webpush = null;
if (pushEnabled) {
    try {
        webpush = require('web-push');
        webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    } catch (e) {
        console.error('Web Push init error:', e.message);
    }
}

const STORE_FILE = path.join(__dirname, 'push-subscriptions.json');
const pushSubscriptions = new Map(); // endpoint -> { endpoint, keys, reminders, lastSent }

function loadSubscriptions() {
    try {
        if (!fs.existsSync(STORE_FILE)) return;
        const raw = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
        for (const rec of raw) {
            // Older records stored endpoint/keys flat; rebuild the full
            // subscription object web-push requires.
            if (!rec.subscription && rec.endpoint) {
                rec.subscription = { endpoint: rec.endpoint, keys: rec.keys };
            }
            pushSubscriptions.set(rec.endpoint, rec);
        }
        console.log(`Web Push: loaded ${pushSubscriptions.size} subscription(s)`);
    } catch (e) {
        console.error('Web Push: could not read subscriptions file:', e.message);
    }
}

function saveSubscriptions() {
    try {
        fs.writeFileSync(STORE_FILE, JSON.stringify([...pushSubscriptions.values()], null, 2));
    } catch (e) {
        console.error('Web Push: could not persist subscriptions:', e.message);
    }
}

function localDateKey(d) {
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
}

function timeToMinutes(hhmm) {
    const [h, m] = String(hhmm || '').split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
}

// Mirrors the client-side dose window so server and UI agree on what counts
// as "on time".
const WINDOW_BEFORE_MIN = 15;
const WINDOW_AFTER_MIN = 60;

async function sendPush(subscription, payload) {
    if (!webpush) return { ok: false, reason: 'disabled' };

    // Accept either a full subscription object or a stored record carrying a
    // nested one, so a malformed record fails loudly instead of silently.
    let toSend = subscription;
    if (toSend && !toSend.endpoint && toSend.subscription) toSend = toSend.subscription;
    if (!toSend || !toSend.endpoint) return { ok: false, reason: 'missing subscription endpoint' };

    try {
        await webpush.sendNotification(toSend, JSON.stringify(payload), { TTL: 300 });
        return { ok: true };
    } catch (e) {
        // 404/410 mean the browser dropped the subscription; stop tracking it.
        if (e.statusCode === 404 || e.statusCode === 410) return { ok: false, gone: true, reason: e.message };
        return { ok: false, reason: e.message };
    }
}

// Runs every 30s: for each registered reminder inside its dose window, push once.
async function runPushScheduler() {
    if (!webpush) return;

    const now = new Date();
    const nowM = now.getHours() * 60 + now.getMinutes();
    const today = localDateKey(now);
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const todayName = dayNames[now.getDay()];

    let dirty = false;

    for (const rec of pushSubscriptions.values()) {
        rec.lastSent = rec.lastSent || {};

        for (const r of rec.reminders || []) {
            if (r.active === false) continue;

            if (r.repeat === 'weekdays' && (now.getDay() === 0 || now.getDay() === 6)) continue;
            if (r.repeat === 'specific' && Array.isArray(r.days) && !r.days.includes(todayName)) continue;

            const due = timeToMinutes(r.time);
            if (due === null) continue;
            if (nowM < due - WINDOW_BEFORE_MIN || nowM > due + WINDOW_AFTER_MIN) continue;

            const key = `${r.id}:${today}`;
            if (rec.lastSent[key]) continue;   // already pushed today

            const sent = await sendPush(rec.subscription, {
                title: 'MediAssist AI - Time for your medicine',
                body: r.body || 'Time to take your medication',
                reminderId: r.id,
                time: r.time,
                url: '/',
                tag: `dose-${r.id}`
            });

            if (sent.ok) {
                rec.lastSent[key] = Date.now();
                console.log(`Web Push: sent reminder ${r.id} (${r.time})`);
            } else if (sent.gone) {
                console.log('Web Push: subscription expired, removing');
                pushSubscriptions.delete(rec.endpoint);
                dirty = true;
                break;
            }
        }

        // Keep only today's send markers so the file cannot grow forever.
        for (const k of Object.keys(rec.lastSent)) {
            if (!k.endsWith(today)) delete rec.lastSent[k];
        }
    }

    if (dirty) saveSubscriptions();
}

let pushSchedulerTimer = null;
function startPushScheduler() {
    if (!webpush) return;
    loadSubscriptions();
    if (pushSchedulerTimer) clearInterval(pushSchedulerTimer);
    pushSchedulerTimer = setInterval(() => {
        runPushScheduler().catch(e => console.error('Web Push scheduler error:', e.message));
    }, 30000);
}

module.exports = {
    VAPID_PUBLIC_KEY,
    pushEnabled,
    pushSubscriptions,
    saveSubscriptions,
    sendPush,
    startPushScheduler,
    runPushScheduler
};