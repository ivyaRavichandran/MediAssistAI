const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

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

// ===== Start server =====
const PORT = process.env.PORT || 4000;
app.listen(PORT, async () => {
    console.log(`\nMediAssist AI Server running on http://localhost:${PORT}`);
    console.log(`Static files served from: ${__dirname}`);
    console.log(`Twilio SMS: ${twilioClient ? 'ACTIVE - real SMS will be sent' : 'NOT CONFIGURED - edit .env file'}`);

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
