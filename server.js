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
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        twilio: twilioClient ? 'configured' : 'not configured',
        twilioPhone: twilioClient ? TWILIO_PHONE_NUMBER : null
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
app.listen(PORT, () => {
    console.log(`\nMediAssist AI Server running on http://localhost:${PORT}`);
    console.log(`Static files served from: ${__dirname}`);
    console.log(`Twilio SMS: ${twilioClient ? 'ACTIVE - real SMS will be sent' : 'NOT CONFIGURED - edit .env file'}\n`);
});
