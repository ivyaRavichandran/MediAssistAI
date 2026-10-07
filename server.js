const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const pushModule = require('./push');
const driveModule = require('./drive');

const app = express();
app.use(cors());
app.use(express.json());

// ===== Twilio Config =====
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

// ===== Python OCR Service Config =====
const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL || 'http://127.0.0.1:5001';
const OCR_TIMEOUT_MS = parseInt(process.env.OCR_TIMEOUT_MS || '60000', 10);
const MAX_OCR_UPLOAD_BYTES = 10 * 1024 * 1024;

let multer = null;
try {
    multer = require('multer');
} catch (e) {
    console.error('multer not installed. Install it with: npm install multer');
}

const upload = multer
    ? multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: MAX_OCR_UPLOAD_BYTES }
    })
    : null;

let twilioClient = null;
try {
    const twilio = require('twilio');
    if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN &&
        TWILIO_ACCOUNT_SID !== 'YOUR_TWILIO_ACCOUNT_SID' &&
        TWILIO_AUTH_TOKEN !== 'YOUR_TWILIO_AUTH_TOKEN') {
        twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
        console.log('Twilio client initialized');
    } else {
        console.error('Twilio credentials not configured in .env');
    }
} catch (e) {
    console.error('Twilio package error:', e.message);
}

// ===== Serve static files =====
app.use(express.static(path.join(__dirname)));

// ===== Health check =====
let ocrServiceStatus = { reachable: false, version: null, languages: [] };

async function probeOcrService() {
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3000);
        const resp = await fetch(`${OCR_SERVICE_URL}/api/ocr/health`, { signal: controller.signal });
        clearTimeout(timer);
        if (!resp.ok) throw new Error(`status ${resp.status}`);
        const data = await resp.json();
        ocrServiceStatus = {
            reachable: true,
            version: data.version || null,
            languages: data.languages || [],
            path: data.tesseract_path || null
        };
    } catch (e) {
        ocrServiceStatus = { reachable: false, version: null, languages: [], error: e.message };
    }
    return ocrServiceStatus;
}

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        twilio: twilioClient ? 'configured' : 'not configured',
        twilioPhone: twilioClient ? TWILIO_PHONE_NUMBER : null,
        ocrService: ocrServiceStatus,
        ocrServiceUrl: OCR_SERVICE_URL,
        ocrFallback: 'tesseract.js (client-side)'
    });
});

// ===== Python OCR Service proxy =====

// Status of the Python OCR microservice
app.get('/api/py-ocr/health', async (req, res) => {
    const status = await probeOcrService();
    if (status.reachable) {
        return res.json({
            success: true,
            available: true,
            method: 'python-tesseract',
            version: status.version,
            languages: status.languages,
            serviceUrl: OCR_SERVICE_URL
        });
    }
    res.json({
        success: true,
        available: false,
        method: 'tesseract.js',
        fallback: true,
        message: 'Python OCR service is not running. The client will use the browser OCR engine.',
        serviceUrl: OCR_SERVICE_URL
    });
});

// Process a prescription image with the Python OCR service.
// The client falls back to Tesseract.js when this returns a non-2xx response.
app.post('/api/py-ocr', async (req, res) => {
    if (!upload) {
        return res.status(503).json({
            success: false,
            error: 'multer is not installed on the server',
            code: 'MULTER_MISSING'
        });
    }

    upload.single('file')(req, res, async (uploadErr) => {
        if (uploadErr) {
            const tooLarge = uploadErr.code === 'LIMIT_FILE_SIZE';
            return res.status(tooLarge ? 413 : 400).json({
                success: false,
                error: tooLarge ? 'File exceeds the 10MB limit' : uploadErr.message,
                code: tooLarge ? 'FILE_TOO_LARGE' : 'UPLOAD_ERROR'
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No "file" field was uploaded',
                code: 'NO_FILE'
            });
        }

        try {
            const form = new FormData();
            const blob = new Blob([req.file.buffer], { type: req.file.mimetype || 'image/png' });
            form.append('file', blob, req.file.originalname);
            form.append('lang', (req.body && req.body.lang) || 'eng');

            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), OCR_TIMEOUT_MS);

            const upstream = await fetch(`${OCR_SERVICE_URL}/api/ocr/process`, {
                method: 'POST',
                body: form,
                signal: controller.signal
            });
            clearTimeout(timer);

            const contentType = upstream.headers.get('content-type') || '';
            let payload;
            if (contentType.includes('application/json')) {
                payload = await upstream.json();
            } else {
                payload = { success: false, error: (await upstream.text()).slice(0, 300) };
            }

            if (!upstream.ok) {
                console.error(`Python OCR service error ${upstream.status}:`, payload.error || payload);
                return res.status(upstream.status >= 500 ? 502 : upstream.status).json({
                    success: false,
                    error: payload.error || 'Python OCR service failed',
                    code: payload.code || 'OCR_UPSTREAM_ERROR'
                });
            }

            res.json(payload);
        } catch (err) {
            const aborted = err.name === 'AbortError';
            console.error('Python OCR proxy failure:', err.message);
            res.status(503).json({
                success: false,
                error: aborted
                    ? 'OCR service timed out. Falling back to browser OCR.'
                    : 'Python OCR service is unavailable. Falling back to browser OCR.',
                code: aborted ? 'OCR_TIMEOUT' : 'OCR_UNREACHABLE'
            });
        }
    });
});

// ===== Send SMS endpoint =====
app.post('/api/send-sms', async (req, res) => {
    const { to, message, userName } = req.body;

    if (!to || !message) {
        return res.status(400).json({ error: 'Missing "to" and "message" fields' });
    }

    const formattedPhone = to.replace(/[^\d+]/g, '');

    if (twilioClient) {
        try {
            const result = await twilioClient.messages.create({
                body: message,
                from: TWILIO_PHONE_NUMBER,
                to: formattedPhone
            });

            console.log(`SMS sent to ${formattedPhone} | SID: ${result.sid}`);
            res.json({
                success: true,
                method: 'twilio',
                sid: result.sid,
                status: result.status,
                to: formattedPhone
            });
        } catch (err) {
            console.error('Twilio SMS failed:', err.message);
            res.status(500).json({
                success: false,
                error: err.message,
                code: err.code
            });
        }
    } else {
        res.status(503).json({
            success: false,
            error: 'Twilio not configured. Please set credentials in .env file.'
        });
    }
});

// ===== Send Emergency Alert endpoint =====
app.post('/api/emergency-alert', async (req, res) => {
    const { contacts, userName, alerts } = req.body;

    if (!contacts || !contacts.length) {
        return res.status(400).json({ error: 'No emergency contacts provided' });
    }

    if (!twilioClient) {
        return res.status(503).json({
            success: false,
            error: 'Twilio not configured. Please set credentials in .env file.'
        });
    }

    const results = [];
    const alertText = alerts.map(a => `${a.metric}: ${a.value} - ${a.message}`).join('\n');

    for (const contact of contacts) {
        const message = [
            `EMERGENCY HEALTH ALERT`,
            ``,
            `User: ${userName || 'MediAssist AI User'}`,
            `Time: ${new Date().toLocaleString()}`,
            ``,
            `Detected Issues:`,
            alertText,
            ``,
            `Please check on them immediately!`,
            ``,
            `- MediAssist AI`
        ].join('\n');

        try {
            const result = await twilioClient.messages.create({
                body: message,
                from: TWILIO_PHONE_NUMBER,
                to: contact.phone.replace(/[^\d+]/g, '')
            });
            results.push({
                contact: contact.name,
                phone: contact.phone,
                success: true,
                sid: result.sid
            });
            console.log(`Emergency SMS sent to ${contact.name} (${contact.phone}) | SID: ${result.sid}`);
        } catch (err) {
            results.push({
                contact: contact.name,
                phone: contact.phone,
                success: false,
                error: err.message
            });
            console.error(`Failed to SMS ${contact.name}: ${err.message}`);
        }
    }

    res.json({
        success: true,
        results
    });
});

// ===== Web Push endpoints =====
app.get('/api/push/vapid-key', (req, res) => {
    if (!pushModule.pushEnabled) {
        return res.status(503).json({
            success: false,
            error: 'Web Push not configured. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in .env'
        });
    }
    res.json({ success: true, publicKey: pushModule.VAPID_PUBLIC_KEY });
});

// The client posts its push subscription together with its current reminders so
// the server can dispatch on time even when no tab is open.
app.post('/api/push/subscribe', (req, res) => {
    const { subscription, reminders } = req.body || {};

    if (!pushModule.pushEnabled) {
        return res.status(503).json({ success: false, error: 'Web Push not configured' });
    }
    if (!subscription || !subscription.endpoint || !subscription.keys) {
        return res.status(400).json({ success: false, error: 'Invalid push subscription' });
    }

    const endpoint = subscription.endpoint;
    pushModule.pushSubscriptions.set(endpoint, {
        // Full subscription object is what web-push actually sends to.
        subscription,
        endpoint,
        keys: subscription.keys,
        reminders: Array.isArray(reminders) ? reminders : [],
        lastSent: (pushModule.pushSubscriptions.get(endpoint) || {}).lastSent || {}
    });
    pushModule.saveSubscriptions();

    console.log(`Web Push: subscription registered (${pushModule.pushSubscriptions.size} total)`);
    res.json({ success: true, count: pushModule.pushSubscriptions.size });
});

// Re-sync the schedule without re-registering the subscription (cheap to call
// whenever reminders change).
app.post('/api/push/schedule', (req, res) => {
    const { reminders } = req.body || {};
    if (!pushModule.pushEnabled) {
        return res.status(503).json({ success: false, error: 'Web Push not configured' });
    }

    const endpoint = req.body && req.body.endpoint;
    if (endpoint && pushModule.pushSubscriptions.has(endpoint)) {
        pushModule.pushSubscriptions.get(endpoint).reminders = Array.isArray(reminders) ? reminders : [];
        pushModule.saveSubscriptions();
        return res.json({ success: true });
    }

    // Fall back to updating every registration for this browser-less session.
    let n = 0;
    for (const rec of pushModule.pushSubscriptions.values()) {
        rec.reminders = Array.isArray(reminders) ? reminders : [];
        n++;
    }
    pushModule.saveSubscriptions();
    res.json({ success: true, updated: n });
});

app.post('/api/push/test', async (req, res) => {
    if (!pushModule.pushEnabled) {
        return res.status(503).json({ success: false, error: 'Web Push not configured' });
    }
    const { endpoint } = req.body || {};
    const rec = endpoint ? pushModule.pushSubscriptions.get(endpoint) : null;
    if (!rec) return res.status(404).json({ success: false, error: 'No subscription found' });

    const result = await pushModule.sendPush(rec.subscription, {
        title: 'MediAssist AI',
        body: 'Push notifications are working.',
        url: '/',
        tag: 'test'
    });
    res.json(result);
});

app.get('/api/push/status', (req, res) => {
    res.json({
        success: true,
        enabled: pushModule.pushEnabled,
        subscriptions: pushModule.pushSubscriptions.size
    });
});

// ===== Google Drive sync endpoints =====
app.get('/api/drive/status', (req, res) => {
    res.json(driveModule.status());
});

// Start the Google OAuth consent flow.
app.get('/api/drive/connect', (req, res) => {
    if (!driveModule.enabled) {
        return res.status(503).json({
            success: false,
            error: 'Google Drive sync not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env'
        });
    }
    res.redirect(driveModule.authUrl());
});

// Google redirects here after the user approves access.
app.get('/api/oauth2callback', async (req, res) => {
    const code = req.query.code;
    if (!code) {
        return res.redirect('/?drive=error');
    }
    try {
        await driveModule.exchangeCode(code);
        res.redirect('/?drive=connected');
    } catch (err) {
        console.error('OAuth callback failed:', err.message);
        res.redirect('/?drive=error');
    }
});

// Run a sync immediately.
app.post('/api/drive/sync', async (req, res) => {
    try {
        const result = await driveModule.syncNow();
        if (result.ok) {
            res.json({ success: true, ...result });
        } else if (result.reason === 'configured') {
            res.status(503).json({ success: false, error: 'Drive sync not configured in .env' });
        } else if (result.reason === 'not-connected') {
            res.status(401).json({ success: false, error: 'Google Drive not connected yet' });
        } else if (result.reason === 'network') {
            res.status(502).json({ success: false, error: 'Could not reach Google: ' + (result.error || 'network error') });
        } else {
            res.status(500).json({ success: false, error: 'Sync failed' });
        }
    } catch (err) {
        console.error('Drive sync route error:', err.message);
        res.status(500).json({ success: false, error: 'Sync failed: ' + err.message });
    }
});

// Parsed health data for the wearable page.
app.get('/api/drive/data', (req, res) => {
    res.json(driveModule.healthData());
});

// ===== Start server =====

// SPA fallback: unknown GET paths (e.g. /wearable from the OAuth redirect)
// serve the single-page app instead of a 404.
app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    if (req.path.startsWith('/api')) return next();
    if (path.extname(req.path)) return next();
    res.sendFile(path.join(__dirname, 'index.html'));
});
const PORT = process.env.PORT || 4000;
// Keep serving if a single background task (e.g. Drive/push) hits a
// transient network error - log it instead of crashing the process.
process.on('unhandledRejection', (reason) => {
    console.error('Unhandled rejection (kept serving):', reason && reason.message ? reason.message : reason);
});
process.on('uncaughtException', (err) => {
    console.error('Uncaught exception (kept serving):', err.message);
});

app.listen(PORT, async () => {
    console.log(`\nMediAssist AI Server running on http://localhost:${PORT}`);
    console.log(`Static files served from: ${__dirname}`);
    console.log(`Twilio SMS: ${twilioClient ? 'ACTIVE - real SMS will be sent' : 'NOT CONFIGURED - edit .env file'}`);
    console.log(`Web Push: ${pushModule.pushEnabled ? 'ENABLED - medication reminders will be delivered' : 'NOT CONFIGURED - add VAPID keys to .env'}`);
    if (pushModule.pushEnabled) {
        pushModule.startPushScheduler();
        console.log('  Scheduler checks every 30s and pushes inside each dose window.');
    }

    console.log(`Google Drive sync: ${driveModule.enabled ? 'ENABLED - set up .env connexion' : 'NOT CONFIGURED - add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env'}`);
    if (driveModule.enabled) {
        driveModule.startSyncScheduler();
        console.log(`  Auto-syncs every ${process.env.DRIVE_SYNC_INTERVAL_MIN || 20} minutes once connected.`);
        console.log(`  Open ${process.env.APP_BASE_URL || 'http://localhost:4000'}/api/drive/connect to link your Google account.`);
    }

    const ocr = await probeOcrService();
    if (ocr.reachable) {
        console.log(`Python OCR service: ONLINE at ${OCR_SERVICE_URL} (Tesseract ${ocr.version})`);
    } else {
        console.log(`Python OCR service: OFFLINE at ${OCR_SERVICE_URL}`);
        console.log('  Start it with:  python ocr-service/app.py   (or: npm run ocr)');
        console.log('  Prescription OCR will fall back to the in-browser Tesseract.js engine.');
    }
    console.log('');
});
