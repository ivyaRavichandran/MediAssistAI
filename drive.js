// ===== Google Drive automatic sync (Fire-Boltt / Da Fit health data) =====
// OAuth flow + Drive file export + CSV parsing + health store + auto-sync.
// Uses Node's built-in fetch - no extra npm packages required.

const fs = require('fs');
const path = require('path');

try {
    require('dotenv').config({ quiet: true });
} catch (e) {
    console.warn('drive: dotenv unavailable:', e.message);
}

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:4000';
const SYNC_INTERVAL_MIN = Number(process.env.DRIVE_SYNC_INTERVAL_MIN || 10);

const SCOPES = [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/spreadsheets.readonly'
];
const REDIRECT_URI = `${APP_BASE_URL}/api/oauth2callback`;

const TOKEN_FILE = path.join(__dirname, 'drive-tokens.json');
const DATA_FILE = path.join(__dirname, 'drive-health-data.json');

const enabled = Boolean(CLIENT_ID && CLIENT_SECRET);

let tokens = null;
let healthStore = { byDate: {}, files: [], lastSync: null };

// ===== network helper =====

async function gfetch(url, options = {}, timeoutMs = 20000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

// ===== token persistence =====

function loadTokens() {
    try {
        if (fs.existsSync(TOKEN_FILE)) {
            tokens = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('drive: failed to load tokens:', e.message);
    }
}

function saveTokens() {
    try {
        fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2));
    } catch (e) {
        console.error('drive: failed to persist tokens:', e.message);
    }
}

function isConnected() {
    return Boolean(tokens && tokens.access_token);
}

// ===== OAuth =====

function authUrl() {
    const params = new URLSearchParams({
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
        scope: SCOPES.join(' '),
        access_type: 'offline',
        prompt: 'consent',
        include_granted_scopes: 'true'
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function exchangeCode(code) {
    const resp = await gfetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            code,
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            redirect_uri: REDIRECT_URI,
            grant_type: 'authorization_code'
        })
    });
    const body = await resp.json();
    if (!resp.ok) {
        const err = new Error(body.error_description || body.error || 'token exchange failed');
        err.code = body.error;
        throw err;
    }
    tokens = {
        access_token: body.access_token,
        refresh_token: body.refresh_token || (tokens && tokens.refresh_token),
        expiry: Date.now() + (body.expires_in || 3600) * 1000
    };
    saveTokens();
    return tokens;
}

async function getAccessToken() {
    if (!tokens || !tokens.access_token) return null;
    if (tokens.expiry && tokens.expiry > Date.now() + 60000) return tokens.access_token;

    if (!tokens.refresh_token) return null;

    const resp = await gfetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            refresh_token: tokens.refresh_token,
            grant_type: 'refresh_token'
        })
    });
    const body = await resp.json();
    if (!resp.ok) {
        // Refresh token invalid -> user must re-connect.
        tokens = null;
        saveTokens();
        return null;
    }
    tokens.access_token = body.access_token;
    tokens.expiry = Date.now() + body.expires_in * 1000;
    saveTokens();
    return tokens.access_token;
}

// ===== Drive API =====

async function driveRequest(url, token) {
    const resp = await gfetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (resp.status === 401 || resp.status === 403) {
        const fresh = await getAccessToken();
        if (!fresh) return null;
        return gfetch(url, { headers: { Authorization: `Bearer ${fresh}` } });
    }
    return resp;
}

// Latest exported health files (Health Sync puts Google Sheets in Drive).
async function listHealthFiles(token, count = 12) {
    const q = encodeURIComponent(
        "trashed = false and not name contains '.exe'"
    );
    const resp = await driveRequest(
        `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType,modifiedTime)&orderBy=modifiedTime%20desc&pageSize=50`,
        token
    );
    if (!resp) return [];
    const data = await resp.json();
    let files = data.files || [];

    // Only exportable data files: CSV/TSV/spreadsheets. Skip binary .fit and
    // other workout exports that carry no readable rows.
    files = files.filter(f => {
        const name = (f.name || '').toLowerCase();
        if (name.endsWith('.fit') || name.endsWith('.gpx') || name.endsWith('.tcx')) return false;
        if (name.endsWith('.csv') || name.endsWith('.tsv')) return true;
        const mt = f.mimeType || '';
        return mt.includes('spreadsheet') || mt.includes('csv') || mt.includes('text/plain');
    });

    // Prefer sheets/spreadsheets (Health Sync's Drive export) and any file
    // whose name looks like a health export.
    const score = (f) => {
        const name = (f.name || '').toLowerCase();
        let s = 0;
        if (f.mimeType.includes('spreadsheet') || f.mimeType.includes('csv')) s += 100;
        if (name.includes('health') || name.includes('fit') || name.includes('sync') ||
            name.includes('steps') || name.includes('sleep') || name.includes('heart') ||
            name.includes('weight') || name.includes('blood') || name.includes('pressure')) s += 50;
        return s;
    };
    files.sort((a, b) => score(b) - score(a) || new Date(b.modifiedTime) - new Date(a.modifiedTime));
    return files.slice(0, count);
}

// Export a spreadsheet as CSV; fall back to raw download for non-sheets files.
async function exportAsCsv(file, token) {
    if (file.mimeType && file.mimeType.includes('spreadsheet')) {
        const url = `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=text/csv`;
        const resp = await driveRequest(url, token);
        return resp && resp.ok ? resp.text() : null;
    }
    const url = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
    const resp = await driveRequest(url, token);
    return resp && resp.ok ? resp.text() : null;
}

// ===== CSV parsing =====

function parseHealthCsv(csv) {
    const byDate = {};
    const rows = csv.split(/\r?\n/).filter(r => r.trim().length > 0);
    if (rows.length < 2) return byDate;

    // Robust header detection (Health Sync column names vary), handled with
    // plain comma + quoted-cell aware splitting.
    const splitRow = (line) => {
        const out = [];
        let cur = '', inQ = false;
        for (let i = 0; i < line.length; i++) {
            const c = line[i];
            if (c === '"') { inQ = !inQ; continue; }
            if (c === ',' && !inQ) { out.push(cur); cur = ''; continue; }
            cur += c;
        }
        out.push(cur);
        return out.map(s => s.trim());
    };

    const headers = splitRow(rows[0]).map(h => h.toLowerCase());
    const idx = (keywords) => headers.findIndex(h => keywords.some(k => h.includes(k)));

    const dateIdx = idx(['date', 'day', 'time', 'start time']);
    const stepIdx = idx(['step']);
    const hrIdx = idx(['heart']);
    const sleepIdx = idx(['sleep']);
    const distIdx = idx(['distance']);
    const calIdx = idx(['calorie', 'calories']);
    const weightIdx = idx(['weight', 'body mass', 'body weight']);
    const sysIdx = idx(['systolic', 'bp sys', 'blood pressure sys']);
    const diaIdx = idx(['diastolic', 'bp dia', 'blood pressure dia']);
    const combinedBpIdx = idx(['blood pressure']);
    const combinedBpExact = combinedBpIdx >= 0 && sysIdx < 0 && diaIdx < 0;
    const distIsMiles = distIdx >= 0 && headers[distIdx].includes('mile');

    const num = (v) => {
        if (v === null || v === undefined) return null;
        const n = parseFloat(String(v).replace(/[^0-9.]/g, ''));
        return isNaN(n) ? null : n;
    };
    // 0 / empty from the watch means "no reading recorded" (Google Fit fills
    // heart-rate / BP cells with 0 rather than leaving them blank).
    const val = (v) => {
        const n = num(v);
        return n !== null && n > 0 ? n : null;
    };

    for (let i = 1; i < rows.length; i++) {
        const cells = splitRow(rows[i]);
        if (dateIdx < 0 || dateIdx >= cells.length) break;
        const rawDate = String(cells[dateIdx] || '').trim();
        const m = rawDate.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/) ||
                  rawDate.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
        if (!m) continue;
        // Normalise to YYYY-MM-DD regardless of order.
        const date = m[1].length === 4
            ? `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`
            : `${m[3]}-${String(m[1]).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`;

        const row = byDate[date] || { date, steps: 0, heartTotal: 0, heartCount: 0, heartMax: 0, sleepMins: 0, distance: 0, calories: 0, weight: null, sys: null, dia: null };
        if (stepIdx >= 0) {
            const v = val(cells[stepIdx]);
            if (v !== null) row.steps = Math.max(row.steps, v);   // pick largest per date (exports may repeat)
        }
        if (hrIdx >= 0) {
            const v = val(cells[hrIdx]);
            if (v !== null) { row.heartTotal += v; row.heartCount++; if (v > row.heartMax) row.heartMax = v; }
        }
        if (sleepIdx >= 0) {
            const v = val(cells[sleepIdx]);
            if (v !== null) row.sleepMins = Math.max(row.sleepMins, v);
        }
        if (distIdx >= 0) { const v = val(cells[distIdx]); if (v !== null) row.distance = distIsMiles ? v * 1.60934 : v; }
        if (calIdx >= 0)  { const v = val(cells[calIdx]);  if (v !== null) row.calories = Math.max(row.calories, v); }
        if (weightIdx >= 0) { const v = val(cells[weightIdx]); if (v !== null) row.weight = v; }

        let sys = null, dia = null;
        if (sysIdx >= 0) sys = val(cells[sysIdx]);
        if (diaIdx >= 0) dia = val(cells[diaIdx]);
        if (combinedBpExact) {
            const cell = String(cells[combinedBpIdx] || '');
            const bpMatch = cell.match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
            if (bpMatch) { sys = parseFloat(bpMatch[1]); dia = parseFloat(bpMatch[2]); }
        }
        if (sys !== null) row.sys = sys;
        if (dia !== null) row.dia = dia;
        byDate[date] = row;
    }

    // Collapse aggregates into a clean structure.
    const out = {};
    for (const [date, r] of Object.entries(byDate)) {
        out[date] = {
            date,
            steps: Math.round(r.steps),
            heartRateAvg: r.heartCount ? Math.round(r.heartTotal / r.heartCount) : null,
            heartRateMax: r.heartMax || null,
            sleepMins: Math.round(r.sleepMins),
            distanceKm: Math.round(r.distance * 100) / 100,
            calories: Math.round(r.calories),
            weightKg: r.weight || null,
            bloodPressure: (r.sys !== null && r.dia !== null)
                ? { sys: r.sys, dia: r.dia }
                : null
        };
    }
    return out;
}

// ===== store + sync =====

function loadHealthStore() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            healthStore = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('drive: failed to load health store:', e.message);
    }
}

function saveHealthStore() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(healthStore, null, 2));
    } catch (e) {
        console.error('drive: failed to persist health store:', e.message);
    }
}

async function syncNow() {
    if (!enabled) return { ok: false, reason: 'configured' };
    let token;
    try {
        token = await getAccessToken();
    } catch (e) {
        console.error('drive: token refresh failed:', e.message);
        return { ok: false, reason: 'network', error: e.message };
    }
    if (!token) return { ok: false, reason: 'not-connected' };

    // The user's ISP/network is intermittently flaky toward Google, so retry a
    // few times before reporting a failure. Auto-sync also keeps trying later.
    let files = null;
    for (let attempt = 1; attempt <= 3 && files === null; attempt++) {
        try {
            files = await listHealthFiles(token);
        } catch (e) {
            const msg = e.message || String(e);
            console.error(`drive: listing files failed (attempt ${attempt}/3): ${msg}`);
            if (attempt < 3) await new Promise(r => setTimeout(r, attempt * 4000));
        }
    }
    if (files === null) return { ok: false, reason: 'network', error: 'could not reach Google after retries' };
    if (files === undefined) return { ok: false, reason: 'network', error: 'token rejected' };

    let synced = 0, merged = {};
    for (const file of files) {
        try {
            const csv = await exportAsCsv(file, token);
            if (!csv) continue;
            merged = { ...merged, ...parseHealthCsv(csv) };
            synced++;
        } catch (e) {
            console.error(`drive: export failed for ${file.name}:`, e.message);
        }
    }

    for (const [date, row] of Object.entries(merged)) {
        healthStore.byDate[date] = { ...healthStore.byDate[date], ...row };
    }
    healthStore.files = files.map(f => ({ id: f.id, name: f.name, modifiedTime: f.modifiedTime }));
    healthStore.lastSync = new Date().toISOString();
    saveHealthStore();

    return { ok: true, files: synced, dates: Object.keys(merged).length };
}

function startSyncScheduler() {
    if (!enabled) return;
    loadTokens();
    loadHealthStore();
    const minutes = Math.max(1, SYNC_INTERVAL_MIN);
    setInterval(() => {
        syncNow().then(res => {
            if (res.ok) console.log(`drive: auto-synced ${res.files} file(s), ${res.dates} date(s)`);
        }).catch(e => console.error('drive: auto-sync failed:', e.message));
    }, minutes * 60 * 1000);
}

function status() {
    return {
        enabled,
        connected: isConnected(),
        appBaseUrl: APP_BASE_URL,
        redirectUri: REDIRECT_URI,
        syncIntervalMin: SYNC_INTERVAL_MIN,
        lastSync: healthStore.lastSync || null,
        dates: Object.keys(healthStore.byDate || {}).length,
        files: (healthStore.files || []).length
    };
}

function healthData() {
    const days = Object.values(healthStore.byDate || {})
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-30);
    const summary = { stepsDays: 0, weightDays: 0, hrDays: 0, bpDays: 0, sleepDays: 0 };
    days.forEach(d => {
        if (d.steps > 0) summary.stepsDays++;
        if (d.weightKg) summary.weightDays++;
        if (d.heartRateAvg != null && d.heartRateAvg > 0) summary.hrDays++;
        if (d.bloodPressure && d.bloodPressure.sys > 0) summary.bpDays++;
        if (d.sleepMins > 0) summary.sleepDays++;
    });
    return { lastSync: healthStore.lastSync || null, days, summary };
}

module.exports = {
    enabled,
    authUrl,
    exchangeCode,
    status,
    syncNow,
    startSyncScheduler,
    healthData,
    parseHealthCsv
};