// ===== Pharmacist Module =====
// Pharmacists are a separate login type. They access a patient by the unique
// code issued at patient registration, can view that patient's profile,
// medications and history, and are the only role allowed to scan, review,
// verify and add medication to a patient's record.

let currentPharmPatient = null;

function initPharmacistUI() {
    currentPharmPatient = null;
    document.getElementById('pharm-patient-area')?.classList.add('hidden');
    const input = document.getElementById('pharm-code-input');
    if (input) input.value = '';
    const results = document.getElementById('pharm-rx-results');
    if (results) results.innerHTML = '';
    const status = document.getElementById('pharm-scan-status');
    if (status) status.textContent = '';
    const file = document.getElementById('pharm-rx-file');
    if (file) file.value = '';
}

const pharmEsc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

async function loadPatientByCode() {
    const input = document.getElementById('pharm-code-input');
    const code = (input?.value || '').trim().toUpperCase();
    if (!code) {
        showToast('Enter a patient code', 'error');
        return;
    }

    try {
        const codeDoc = await db.collection('patientCodes').doc(code).get();
        if (!codeDoc.exists) {
            showToast('No patient found for that code - ask them to sign in once so it is registered', 'error');
            return;
        }

        const uid = codeDoc.data().uid;
        const userDoc = await db.collection('users').doc(uid).get();
        if (!userDoc.exists) {
            showToast('Patient profile not found', 'error');
            return;
        }

        const [medsSnap, rxSnap, remSnap, histSnap] = await Promise.all([
            db.collection('users').doc(uid).collection('medications').get(),
            db.collection('users').doc(uid).collection('prescriptions').get(),
            db.collection('users').doc(uid).collection('reminders').get(),
            db.collection('users').doc(uid).collection('history').get()
        ]);
        const toArr = (s) => s.docs.map(d => ({ id: d.id, ...d.data() }));

        currentPharmPatient = {
            uid,
            code,
            profile: userDoc.data(),
            medications: toArr(medsSnap),
            prescriptions: toArr(rxSnap),
            reminders: toArr(remSnap),
            history: toArr(histSnap)
        };

        renderPharmacistPatient();
        document.getElementById('pharm-patient-area').classList.remove('hidden');
        showToast(`Patient loaded: ${currentPharmPatient.profile.name || code}`);
    } catch (e) {
        console.error('Patient lookup failed:', e);
        const msg = e.code === 'permission-denied'
            ? 'Access blocked by Firestore rules. Publish the patientCodes/pharmacist rules and reload.'
            : 'Could not access patient: ' + (e.code || e.message);
        showToast(msg, 'error');
    }
}

function renderPharmacistPatient() {
    const p = currentPharmPatient;
    if (!p) return;

    document.getElementById('pharm-patient-code').textContent = 'Code: ' + p.code;
    document.getElementById('pharm-patient-profile').innerHTML = `
        <div><strong>Name:</strong> ${pharmEsc(p.profile.name)}</div>
        <div><strong>Email:</strong> ${pharmEsc(p.profile.email)}</div>
        <div><strong>Phone:</strong> ${pharmEsc(p.profile.phone || '—')}</div>
        <div><strong>Date of Birth:</strong> ${pharmEsc(p.profile.dob || '—')}</div>
        <div><strong>Medications:</strong> ${p.medications.length}</div>
        <div><strong>Prescriptions:</strong> ${p.prescriptions.length}</div>
    `;

    const meds = document.getElementById('pharm-medications');
    meds.innerHTML = p.medications.length ? p.medications.map(m => `
        <div style="padding:10px 0;border-bottom:1px solid var(--border-color,#eee);">
            <strong>${pharmEsc(m.name)}</strong> ${pharmEsc(m.dosage || '')}
            <div style="font-size:.85rem;color:var(--text-muted,#666);">
                ${pharmEsc(m.frequency || '')} · ${pharmEsc(m.duration || '')}
                ${m.verified ? ' · <span style="color:#059669;">Verified</span>' : ''}
            </div>
        </div>
    `).join('') : '<p style="color:var(--text-muted,#666);">No medications yet.</p>';

    const history = document.getElementById('pharm-history');
    const items = [...p.history]
        .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
        .slice(0, 25);
    history.innerHTML = items.length ? items.map(h => `
        <div style="padding:10px 0;border-bottom:1px solid var(--border-color,#eee);">
            <strong>${pharmEsc(h.title)}</strong>
            <div style="font-size:.85rem;color:var(--text-muted,#666);">
                ${pharmEsc(h.details || '')} — ${h.date ? new Date(h.date).toLocaleString() : ''}
            </div>
        </div>
    `).join('') : '<p style="color:var(--text-muted,#666);">No history recorded.</p>';
}

async function scanPharmacistPrescription() {
    if (!currentPharmPatient) {
        showToast('Load a patient first', 'error');
        return;
    }
    const file = document.getElementById('pharm-rx-file')?.files?.[0];
    if (!file) {
        showToast('Choose a prescription image or PDF', 'error');
        return;
    }

    const status = document.getElementById('pharm-scan-status');
    const resultsBox = document.getElementById('pharm-rx-results');
    status.textContent = 'Scanning prescription with OCR...';
    resultsBox.innerHTML = '';

    try {
        // Same engine order as the patient upload: Python/Tesseract first,
        // then the in-browser engine for plain images.
        const outcome = await runOcrWithFallback(file, null);
        if (!outcome.text) {
            status.textContent = '';
            return;
        }

        status.textContent = `Text extracted${outcome.confidence ? ' (confidence ' + Math.round(outcome.confidence) + '%)' : ''}. Review and edit before verifying.`;
        const results = parsePrescriptionText(outcome.text);
        renderPharmacistScan(results);
    } catch (e) {
        status.textContent = '';
        console.error('Pharmacist OCR failed:', e);
        showToast('OCR service error: ' + e.message, 'error');
    }
}

function renderPharmacistScan(results) {
    const container = document.getElementById('pharm-rx-results');
    const detected = (results && results.medications) || [];
    const rows = detected.length ? detected : [{ name: '', dosage: '', frequency: '', duration: '', instructions: '' }];

    container.innerHTML = `
        <div style="overflow-x:auto;">
            <table style="width:100%;border-collapse:collapse;min-width:680px;">
                <thead>
                    <tr style="text-align:left;font-size:.8rem;color:var(--text-muted,#666);">
                        <th style="padding:6px;">Medicine</th>
                        <th style="padding:6px;">Dosage</th>
                        <th style="padding:6px;">Frequency</th>
                        <th style="padding:6px;">Duration</th>
                        <th style="padding:6px;">Instructions</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows.map(m => `
                        <tr class="pharm-rx-row">
                            <td style="padding:4px;"><input class="rx-name" value="${pharmEsc(m.name)}" placeholder="Medicine" style="width:100%;padding:6px;border:1px solid #ccc;border-radius:6px;"></td>
                            <td style="padding:4px;"><input class="rx-dosage" value="${pharmEsc(m.dosage)}" placeholder="e.g. 500mg" style="width:100%;padding:6px;border:1px solid #ccc;border-radius:6px;"></td>
                            <td style="padding:4px;"><input class="rx-frequency" value="${pharmEsc(m.frequency)}" placeholder="e.g. Twice daily" style="width:100%;padding:6px;border:1px solid #ccc;border-radius:6px;"></td>
                            <td style="padding:4px;"><input class="rx-duration" value="${pharmEsc(m.duration)}" placeholder="e.g. 5 days" style="width:100%;padding:6px;border:1px solid #ccc;border-radius:6px;"></td>
                            <td style="padding:4px;"><input class="rx-instructions" value="${pharmEsc(m.instructions)}" placeholder="e.g. After food" style="width:100%;padding:6px;border:1px solid #ccc;border-radius:6px;"></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap;">
            <button class="btn-secondary" onclick="addPharmacistRow()">
                <i class="fas fa-plus"></i> Add Row
            </button>
            <button class="btn-primary" onclick="verifyAndAddMedications()">
                <i class="fas fa-check-double"></i> Verify &amp; Add to Patient
            </button>
        </div>
    `;
}

function addPharmacistRow() {
    const tbody = document.querySelector('#pharm-rx-results tbody');
    if (!tbody) return;
    const tr = document.createElement('tr');
    tr.className = 'pharm-rx-row';
    tr.innerHTML = ['name', 'dosage', 'frequency', 'duration', 'instructions'].map(field =>
        `<td style="padding:4px;"><input class="rx-${field}" placeholder="${field}" style="width:100%;padding:6px;border:1px solid #ccc;border-radius:6px;"></td>`
    ).join('');
    tbody.appendChild(tr);
}

async function verifyAndAddMedications() {
    if (!currentPharmPatient) {
        showToast('Load a patient first', 'error');
        return;
    }

    const rows = [...document.querySelectorAll('#pharm-rx-results .pharm-rx-row')];
    const entries = rows.map(row => ({
        name: row.querySelector('.rx-name')?.value.trim() || '',
        dosage: row.querySelector('.rx-dosage')?.value.trim() || '',
        frequency: row.querySelector('.rx-frequency')?.value.trim() || '',
        duration: row.querySelector('.rx-duration')?.value.trim() || '',
        instructions: row.querySelector('.rx-instructions')?.value.trim() || ''
    })).filter(m => m.name);

    if (!entries.length) {
        showToast('Add at least one medicine to verify', 'error');
        return;
    }

    const pharmacist = App.currentUser?.name || 'Pharmacist';
    const uid = currentPharmPatient.uid;
    const stamp = new Date().toISOString();
    let added = 0;

    try {
        for (const m of entries) {
            const medId = generateId();
            await db.collection('users').doc(uid).collection('medications').doc(medId).set({
                id: medId,
                name: m.name,
                dosage: m.dosage || 'As directed',
                frequency: m.frequency || 'As directed',
                time: '08:00',
                duration: m.duration || '',
                notes: m.instructions || '',
                startDate: stamp,
                active: true,
                warnings: [],
                verified: true,
                addedBy: pharmacist,
                addedByRole: 'pharmacist'
            });
            added++;
        }

        // One prescription record describing this verified scan.
        const rxId = generateId();
        await db.collection('users').doc(uid).collection('prescriptions').doc(rxId).set({
            id: rxId,
            date: new Date().toLocaleDateString(),
            medications: entries,
            verifiedBy: pharmacist,
            verifiedAt: stamp,
            addedByRole: 'pharmacist'
        });

        // Audit trail the patient can see in their history.
        const histId = generateId();
        await db.collection('users').doc(uid).collection('history').doc(histId).set({
            id: histId,
            type: 'medication',
            title: 'Medication Verified by Pharmacist',
            details: `${added} medicine(s) added by ${pharmacist}`,
            date: stamp
        });

        showToast(`Verified and added ${added} medicine(s) to ${currentPharmPatient.profile.name || 'patient'}`);

        document.getElementById('pharm-rx-results').innerHTML = '';
        document.getElementById('pharm-scan-status').textContent = '';
        document.getElementById('pharm-rx-file').value = '';

        // Re-read the patient so the new medication appears immediately.
        await loadPatientByCode();
    } catch (e) {
        console.error('Verify/add failed:', e);
        showToast('Could not save to patient: ' + (e.code || e.message), 'error');
    }
}
