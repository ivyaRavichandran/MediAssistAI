// ===== Pharmacist Module =====
// Pharmacists are a separate login type. They access a patient by the unique
// code issued at patient registration, can view that patient's profile,
// medications and history, and are the only role allowed to scan, review,
// verify and add medication to a patient's record.

let currentPharmPatient = null;
let pharmActiveTab = 'current';
let pharmSearchQuery = '';
let editingPharmMedId = null;

const PHARM_TAB_PANELS = {
    current: 'pharm-current-medications',
    past: 'pharm-past-medications',
    prescriptions: 'pharm-prescriptions',
    wearable: 'pharm-wearable'
};

function initPharmacistUI() {
    currentPharmPatient = null;
    pharmActiveTab = 'current';
    pharmSearchQuery = '';
    editingPharmMedId = null;
    document.getElementById('pharm-patient-area')?.classList.add('hidden');
    const input = document.getElementById('pharm-code-input');
    if (input) input.value = '';
    const results = document.getElementById('pharm-rx-results');
    if (results) results.innerHTML = '';
    const status = document.getElementById('pharm-scan-status');
    if (status) status.textContent = '';
    const file = document.getElementById('pharm-rx-file');
    if (file) file.value = '';
    const search = document.getElementById('pharm-med-search');
    if (search) search.value = '';
    document.querySelectorAll('.pharm-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.pharmTab === 'current');
    });
    Object.values(PHARM_TAB_PANELS).forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '';
    });
    const searchResults = document.getElementById('pharm-search-results');
    if (searchResults) {
        searchResults.innerHTML = '';
        searchResults.classList.add('hidden');
    }
    resetPharmacistHistory();
}

function resetPharmacistHistory() {
    const body = document.getElementById('pharm-history');
    const header = document.querySelector('.pharm-history-header');
    if (body) body.classList.add('hidden');
    if (header) header.classList.remove('open');
}

function togglePharmacistHistory() {
    const body = document.getElementById('pharm-history');
    const header = document.querySelector('.pharm-history-header');
    if (!body) return;
    const opening = body.classList.contains('hidden');
    body.classList.toggle('hidden', !opening);
    if (header) header.classList.toggle('open', opening);
    if (opening) renderPharmacistHistory();
}

function setPharmacistTab(tab) {
    if (!PHARM_TAB_PANELS[tab]) return;
    pharmActiveTab = tab;
    document.querySelectorAll('.pharm-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.pharmTab === tab);
    });
    renderPharmacistMedicationPanels();
}

function applyPharmacistSearch(value) {
    pharmSearchQuery = String(value || '').trim().toLowerCase();
    renderPharmacistMedicationPanels();
}

function pharmMedIsCurrent(med) {
    if (typeof isMedicationCurrent === 'function') return isMedicationCurrent(med);
    return !!med && med.active !== false;
}

function pharmFormatDate(value) {
    if (!value) return '';
    let date;
    if (value && typeof value.toDate === 'function') {
        date = value.toDate();
    } else if (value && typeof value === 'object' && 'seconds' in value) {
        date = new Date(value.seconds * 1000);
    } else {
        date = new Date(value);
    }
    if (isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function pharmMedEndTime(med) {
    if (typeof getMedicationEndDate === 'function') {
        const end = getMedicationEndDate(med);
        if (end) return end.getTime();
    }
    const raw = med.endedAt || med.endDate;
    const date = raw ? new Date(raw) : null;
    return date && !isNaN(date.getTime()) ? date.getTime() : 0;
}

function pharmRxTime(rx) {
    const date = new Date(rx.verifiedAt || rx.date || 0);
    return isNaN(date.getTime()) ? 0 : date.getTime();
}

function pharmMatches(query, values) {
    if (!query) return true;
    return values.some(value => String(value ?? '').toLowerCase().includes(query));
}

function renderPharmMedicationEntry(med, isCurrent) {
    const badges = [];
    if (isCurrent) {
        badges.push('<span class="pharm-badge">Current</span>');
    } else {
        badges.push('<span class="pharm-badge past">Past</span>');
    }
    if (med.verified) badges.push('<span class="pharm-badge verified">Verified</span>');

    const start = typeof getMedicationStartDate === 'function' ? getMedicationStartDate(med) : null;
    const end = typeof getMedicationEndDate === 'function' ? getMedicationEndDate(med) : null;
    const details = [med.frequency, med.duration].filter(Boolean).map(pharmEsc);
    let dates = start ? `Started ${pharmFormatDate(start)}` : '';
    if (!isCurrent && end) dates += `${dates ? ' · ' : ''}Ended ${pharmFormatDate(end)}`;
    if (!isCurrent && !end && med.endedAt) dates += `${dates ? ' · ' : ''}Completed ${pharmFormatDate(med.endedAt)}`;
    if (dates) details.push(dates);
    if (med.notes) details.push(pharmEsc(med.notes));
    if (med.addedBy) details.push(`Added by ${pharmEsc(med.addedBy)}`);

    const actions = isCurrent
        ? `<div class="pharm-entry-actions">
               <button class="btn-secondary btn-sm" onclick="openPharmacistEditMedication('${pharmEsc(med.id)}')">
                   <i class="fas fa-pen"></i> Edit
               </button>
               <button class="btn-danger btn-sm" onclick="removePharmacistMedication('${pharmEsc(med.id)}')">
                   <i class="fas fa-trash"></i> Remove
               </button>
           </div>`
        : '';

    return `
        <div class="pharm-entry">
            <div class="pharm-entry-title">
                <strong>${pharmEsc(med.name || 'Medication')}</strong>
                <span>${pharmEsc(med.dosage || '')}</span>
                ${badges.join('')}
                ${actions}
            </div>
            <div class="pharm-entry-meta">${details.join(' · ')}</div>
        </div>
    `;
}

function renderPharmPrescriptionEntry(rx) {
    const meds = Array.isArray(rx.medications) ? rx.medications : [];
    const medItems = meds.map(med => {
        if (typeof med === 'string') return `<li>${pharmEsc(med)}</li>`;
        const detail = [med.dosage, med.frequency, med.duration].filter(Boolean).join(' · ');
        return `<li><strong>${pharmEsc(med.name || 'Medicine')}</strong>${detail ? ` — ${pharmEsc(detail)}` : ''}</li>`;
    }).join('');

    const meta = [
        rx.verifiedBy ? `Verified by ${pharmEsc(rx.verifiedBy)}` : '',
        rx.doctor ? `Doctor: ${pharmEsc(rx.doctor)}` : '',
        rx.diagnosis ? `Diagnosis: ${pharmEsc(rx.diagnosis)}` : '',
        rx.date ? pharmFormatDate(rx.date) : '',
        rx.verifiedAt ? pharmFormatDate(rx.verifiedAt) : ''
    ].filter(Boolean);

    return `
        <div class="pharm-entry">
            <div class="pharm-entry-title">
                <i class="fas fa-file-prescription" style="color:var(--primary,#0077b6);"></i>
                Prescription
                ${rx.verifiedBy ? '<span class="pharm-badge verified">Verified</span>' : ''}
            </div>
            <div class="pharm-entry-meta">${meta.join(' · ')}</div>
            ${medItems
                ? `<ul class="pharm-rx-meds">${medItems}</ul>`
                : '<div class="pharm-entry-meta">No medicines recorded for this prescription.</div>'}
        </div>
    `;
}

function pharmWearableTime(record) {
    const date = new Date(record?.timestamp || record?.recordedAt || 0);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleString(undefined, {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    });
}

function pharmVital(label, value, icon) {
    return `
        <div class="pharm-vital">
            <i class="fas ${icon}"></i>
            <span class="pharm-vital-label">${pharmEsc(label)}</span>
            <strong class="pharm-vital-value">${pharmEsc(value)}</strong>
        </div>
    `;
}

function renderPharmacistWearable() {
    const p = currentPharmPatient;
    const container = document.getElementById('pharm-wearable');
    if (!p || !container) return;

    const records = (Array.isArray(p.wearableRecords) ? [...p.wearableRecords] : [])
        .filter(r => r && (r.timestamp || r.recordedAt))
        .sort((a, b) => new Date(b.timestamp || b.recordedAt) - new Date(a.timestamp || a.recordedAt));

    const countEl = document.getElementById('pharm-wearable-count');
    if (countEl) countEl.textContent = records.length;

    if (!records.length) {
        container.innerHTML = `
            <div class="pharm-empty-state">
                <i class="fas fa-heart-pulse"></i>
                <p>No wearable readings yet.</p>
                <span>The patient needs to open the Wearable page while signed in so monitor readings are recorded.</span>
            </div>
        `;
        return;
    }

    const latest = records[0];
    const bp = latest.bloodPressure || {};
    const value = (v, suffix = '') => v === undefined || v === null || v === '' ? '—' : `${v}${suffix}`;
    const vitals = [
        pharmVital('Heart Rate', value(latest.heartRate, ' bpm'), 'fa-heartbeat'),
        pharmVital('SpO2', value(latest.spO2, '%'), 'fa-lungs'),
        pharmVital('Blood Pressure', bp.sys && bp.dia ? `${bp.sys}/${bp.dia} mmHg` : '—', 'fa-heart'),
        pharmVital('Temperature', value(latest.temperature, ' °C'), 'fa-temperature-half'),
        pharmVital('Stress', value(latest.stressLevel, '/100'), 'fa-brain'),
        pharmVital('Respiration', value(latest.respiratoryRate, '/min'), 'fa-wind'),
        pharmVital('Steps Today', value(latest.steps), 'fa-shoe-prints'),
        pharmVital('Health Score', value(latest.healthScore, '%'), 'fa-shield-heart')
    ].join('');

    const rows = records.slice(0, 30).map(record => {
        const rbp = record.bloodPressure || {};
        return `
            <tr>
                <td>${pharmEsc(pharmWearableTime(record))}</td>
                <td>${pharmEsc(value(record.heartRate, ' bpm'))}</td>
                <td>${pharmEsc(value(record.spO2, '%'))}</td>
                <td>${pharmEsc(rbp.sys && rbp.dia ? `${rbp.sys}/${rbp.dia}` : '—')}</td>
                <td>${pharmEsc(value(record.temperature, '°C'))}</td>
                <td>${pharmEsc(record.currentActivity ? String(record.currentActivity).replace('_', ' ') : '—')}</td>
            </tr>
        `;
    }).join('');

    container.innerHTML = `
        <div class="pharm-wearable-summary">
            <div>
                <span class="pharm-wearable-eyebrow">Latest reading</span>
                <strong>${pharmEsc(pharmWearableTime(latest))}</strong>
            </div>
            <span class="pharm-badge">${pharmEsc(latest.currentActivity ? String(latest.currentActivity).replace('_', ' ') : 'monitoring')}</span>
        </div>
        <div class="pharm-vitals-grid">${vitals}</div>
        <div class="pharm-wearable-recent">
            <h4>Recent Readings</h4>
            <div class="pharm-wearable-table-wrap">
                <table class="pharm-wearable-table">
                    <thead>
                        <tr>
                            <th>Recorded</th>
                            <th>Heart Rate</th>
                            <th>SpO2</th>
                            <th>BP</th>
                            <th>Temp</th>
                            <th>Activity</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        </div>
    `;
}

function renderPharmacistMedicationPanels() {
    const p = currentPharmPatient;
    if (!p) return;

    const meds = Array.isArray(p.medications) ? [...p.medications] : [];
    const current = meds.filter(pharmMedIsCurrent);
    const past = meds
        .filter(med => !pharmMedIsCurrent(med))
        .sort((a, b) => pharmMedEndTime(b) - pharmMedEndTime(a));
    const prescriptions = (Array.isArray(p.prescriptions) ? [...p.prescriptions] : [])
        .sort((a, b) => pharmRxTime(b) - pharmRxTime(a));

    const setCount = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };
    setCount('pharm-current-count', current.length);
    setCount('pharm-past-count', past.length);
    setCount('pharm-rx-count', prescriptions.length);

    const currentEl = document.getElementById(PHARM_TAB_PANELS.current);
    const pastEl = document.getElementById(PHARM_TAB_PANELS.past);
    const rxEl = document.getElementById(PHARM_TAB_PANELS.prescriptions);
    const searchEl = document.getElementById('pharm-search-results');

    if (currentEl) {
        currentEl.innerHTML = current.length
            ? current.map(med => renderPharmMedicationEntry(med, true)).join('')
            : '<p class="pharm-empty">No current medications.</p>';
    }
    if (pastEl) {
        pastEl.innerHTML = past.length
            ? past.map(med => renderPharmMedicationEntry(med, false)).join('')
            : '<p class="pharm-empty">No past medications yet. Completed courses will appear here.</p>';
    }
    if (rxEl) {
        rxEl.innerHTML = prescriptions.length
            ? prescriptions.map(renderPharmPrescriptionEntry).join('')
            : '<p class="pharm-empty">No prescriptions recorded.</p>';
    }

    renderPharmacistWearable();

    const searching = pharmSearchQuery.length > 0;
    Object.entries(PHARM_TAB_PANELS).forEach(([tab, id]) => {
        const el = document.getElementById(id);
        if (el) el.classList.toggle('hidden', searching || tab !== pharmActiveTab);
    });

    if (!searchEl) return;
    searchEl.classList.toggle('hidden', !searching);
    if (!searching) {
        searchEl.innerHTML = '';
        return;
    }

    const medMatches = meds.filter(med => pharmMatches(pharmSearchQuery, [
        med.name, med.dosage, med.frequency, med.duration, med.notes, med.addedBy
    ]));
    const rxMatches = prescriptions.filter(rx => {
        const medText = (Array.isArray(rx.medications) ? rx.medications : []).map(med =>
            typeof med === 'string' ? med : [med.name, med.dosage, med.frequency, med.duration].join(' ')
        ).join(' ');
        return pharmMatches(pharmSearchQuery, [medText, rx.verifiedBy, rx.date, rx.doctor, rx.diagnosis]);
    });

    let html = '';
    if (medMatches.length) {
        html += `<h4 class="pharm-result-heading">Medications (${medMatches.length})</h4>`;
        html += medMatches.map(med => renderPharmMedicationEntry(med, pharmMedIsCurrent(med))).join('');
    }
    if (rxMatches.length) {
        html += `<h4 class="pharm-result-heading">Prescriptions (${rxMatches.length})</h4>`;
        html += rxMatches.map(renderPharmPrescriptionEntry).join('');
    }
    searchEl.innerHTML = html || `<p class="pharm-empty">No results for “${pharmEsc(pharmSearchQuery)}”.</p>`;
}

function renderPharmacistHistory() {
    const p = currentPharmPatient;
    const history = document.getElementById('pharm-history');
    if (!p || !history) return;

    const items = (Array.isArray(p.history) ? [...p.history] : [])
        .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
        .slice(0, 25);

    history.innerHTML = items.length ? items.map(h => `
        <div class="pharm-entry">
            <div class="pharm-entry-title">${pharmEsc(h.title || 'Activity')}</div>
            <div class="pharm-entry-meta">
                ${pharmEsc(h.details || '')}${h.date ? ` — ${pharmFormatDate(h.date)}` : ''}
            </div>
        </div>
    `).join('') : '<p class="pharm-empty">No history recorded.</p>';
}

function setPharmacistMedicationModalMode(mode, med) {
    const editing = mode === 'edit' && !!med;
    editingPharmMedId = editing ? med.id : null;

    const title = document.getElementById('pharm-add-med-title');
    const submit = document.getElementById('pharm-add-med-submit');
    if (title) title.textContent = editing ? 'Edit Medication' : 'Add Medication for Patient';
    if (submit) submit.textContent = editing ? 'Save Changes' : 'Add Medication';

    const form = document.querySelector('#pharm-add-med-modal form');
    if (editing) {
        document.getElementById('pharm-med-name').value = med.name || '';
        document.getElementById('pharm-med-dosage').value = med.dosage || '';
        document.getElementById('pharm-med-frequency').value = med.frequency || '';
        document.getElementById('pharm-med-duration').value = med.duration || '';
        document.getElementById('pharm-med-notes').value = med.notes || '';
    } else if (form) {
        form.reset();
    }

    openModal('pharm-add-med-modal');
}

function openPharmacistAddMedication() {
    if (!currentPharmPatient) {
        showToast('Load a patient first', 'error');
        return;
    }
    if (typeof canManageMedications === 'function' && !canManageMedications()) {
        showToast('Only a pharmacist can add medications', 'error');
        return;
    }
    setPharmacistMedicationModalMode('add');
}

function openPharmacistEditMedication(medId) {
    if (!currentPharmPatient) {
        showToast('Load a patient first', 'error');
        return;
    }
    if (typeof canManageMedications === 'function' && !canManageMedications()) {
        showToast('Only a pharmacist can edit medications', 'error');
        return;
    }

    const med = (currentPharmPatient.medications || []).find(m => m.id === medId);
    if (!med) return;
    if (!pharmMedIsCurrent(med)) {
        showToast('Only current medications can be edited', 'error');
        return;
    }
    setPharmacistMedicationModalMode('edit', med);
}

async function submitPharmacistAddMedication(event) {
    event.preventDefault();

    if (!currentPharmPatient) {
        showToast('Load a patient first', 'error');
        return;
    }
    if (typeof canManageMedications === 'function' && !canManageMedications()) {
        showToast('Only a pharmacist can add medications', 'error');
        return;
    }

    const name = document.getElementById('pharm-med-name')?.value.trim() || '';
    const dosage = document.getElementById('pharm-med-dosage')?.value.trim() || '';
    const frequency = document.getElementById('pharm-med-frequency')?.value.trim() || '';
    const duration = document.getElementById('pharm-med-duration')?.value.trim() || '';
    const notes = document.getElementById('pharm-med-notes')?.value.trim() || '';

    if (!name || !dosage || !frequency) {
        showToast('Please fill in the medicine name, dosage and frequency', 'error');
        return;
    }

    const isEditing = !!editingPharmMedId;
    const medId = isEditing ? editingPharmMedId : generateId();
    const existing = isEditing
        ? (currentPharmPatient.medications || []).find(m => m.id === medId)
        : null;
    if (isEditing && !existing) {
        showToast('That medication no longer exists', 'error');
        editingPharmMedId = null;
        return;
    }

    const submitBtn = event.target.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    const pharmacist = App.currentUser?.name || 'Pharmacist';
    const uid = currentPharmPatient.uid;
    const stamp = new Date().toISOString();

    try {
        if (isEditing) {
            const updateData = {
                name,
                dosage,
                frequency,
                duration,
                notes,
                updatedAt: stamp,
                updatedBy: pharmacist
            };

            // Recalculate the course end date when the duration changes.
            if (duration !== (existing.duration || '')) {
                const start = typeof getMedicationStartDate === 'function'
                    ? getMedicationStartDate(existing)
                    : null;
                const days = typeof parseDurationDays === 'function'
                    ? parseDurationDays(duration)
                    : null;
                updateData.endDate = start && days
                    ? new Date(start.getTime() + days * 24 * 60 * 60 * 1000).toISOString()
                    : null;
            }

            await db.collection('users').doc(uid)
                .collection('medications').doc(medId)
                .set(updateData, { merge: true });

            const changes = [];
            if ((existing.name || '') !== name) changes.push(`name → ${name}`);
            if ((existing.dosage || '') !== dosage) changes.push(`dose ${existing.dosage || '—'} → ${dosage}`);
            if ((existing.frequency || '') !== frequency) changes.push(`frequency ${existing.frequency || '—'} → ${frequency}`);
            if ((existing.duration || '') !== duration) changes.push(`duration ${existing.duration || '—'} → ${duration || 'not set'}`);

            const histId = generateId();
            await db.collection('users').doc(uid).collection('history').doc(histId).set({
                id: histId,
                type: 'medication',
                title: 'Medication Updated by Pharmacist',
                details: `${name} updated by ${pharmacist}${changes.length ? ` (${changes.join(', ')})` : ''}`,
                date: stamp
            });

            showToast(`${name} updated`);
        } else {
            await db.collection('users').doc(uid).collection('medications').doc(medId).set({
                id: medId,
                name,
                dosage,
                frequency,
                duration,
                notes,
                startDate: stamp,
                active: true,
                warnings: [],
                verified: true,
                addedBy: pharmacist,
                addedByRole: 'pharmacist'
            });

            const histId = generateId();
            await db.collection('users').doc(uid).collection('history').doc(histId).set({
                id: histId,
                type: 'medication',
                title: 'Medication Added by Pharmacist',
                details: `${name} ${dosage} added manually by ${pharmacist}`,
                date: stamp
            });

            showToast(`${name} added to ${currentPharmPatient.profile.name || 'patient'}`);
        }

        editingPharmMedId = null;
        closeModal('pharm-add-med-modal');
        await loadPatientByCode();
    } catch (e) {
        console.error('Medication save failed:', e);
        showToast('Could not save medication: ' + (e.code || e.message), 'error');
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
}

async function removePharmacistMedication(medId) {
    if (!currentPharmPatient) {
        showToast('Load a patient first', 'error');
        return;
    }
    if (typeof canManageMedications === 'function' && !canManageMedications()) {
        showToast('Only a pharmacist can remove medications', 'error');
        return;
    }

    const med = (currentPharmPatient.medications || []).find(m => m.id === medId);
    if (!med) return;

    const patientName = currentPharmPatient.profile.name || 'this patient';
    if (!confirm(`Remove ${med.name} from ${patientName}?`)) return;

    const uid = currentPharmPatient.uid;
    const stamp = new Date().toISOString();
    const pharmacist = App.currentUser?.name || 'Pharmacist';

    try {
        await db.collection('users').doc(uid).collection('medications').doc(medId).delete();

        // Remove any dose reminders as well. This is best-effort so an
        // unpublished reminder rule cannot block the medication removal.
        const linkedReminders = (currentPharmPatient.reminders || [])
            .filter(r => r.medicationId === medId);
        await Promise.all(linkedReminders.map(r =>
            db.collection('users').doc(uid).collection('reminders').doc(r.id).delete()
                .catch(e => console.warn('Could not delete reminder:', e.code || e.message))
        ));

        const histId = generateId();
        await db.collection('users').doc(uid).collection('history').doc(histId).set({
            id: histId,
            type: 'medication',
            title: 'Medication Removed by Pharmacist',
            details: `${med.name}${med.dosage ? ' ' + med.dosage : ''} removed by ${pharmacist}`,
            date: stamp
        });

        showToast(`${med.name} removed from ${patientName}`);
        await loadPatientByCode();
    } catch (e) {
        console.error('Medication removal failed:', e);
        showToast('Could not remove medication: ' + (e.code || e.message), 'error');
    }
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

        const [medsSnap, rxSnap, remSnap, histSnap, wearableSnap] = await Promise.all([
            db.collection('users').doc(uid).collection('medications').get(),
            db.collection('users').doc(uid).collection('prescriptions').get(),
            db.collection('users').doc(uid).collection('reminders').get(),
            db.collection('users').doc(uid).collection('history').get(),
            db.collection('users').doc(uid).collection('wearableRecords')
                .orderBy('timestamp', 'desc').limit(50).get()
        ]);
        const toArr = (s) => s.docs.map(d => ({ id: d.id, ...d.data() }));

        currentPharmPatient = {
            uid,
            code,
            profile: userDoc.data(),
            medications: toArr(medsSnap),
            prescriptions: toArr(rxSnap),
            reminders: toArr(remSnap),
            history: toArr(histSnap),
            wearableRecords: toArr(wearableSnap)
        };

        pharmActiveTab = 'current';
        pharmSearchQuery = '';
        const search = document.getElementById('pharm-med-search');
        if (search) search.value = '';
        document.querySelectorAll('.pharm-tab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.pharmTab === 'current');
        });

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

    const meds = Array.isArray(p.medications) ? p.medications : [];
    const current = meds.filter(pharmMedIsCurrent);
    const past = meds.filter(med => !pharmMedIsCurrent(med));

    document.getElementById('pharm-patient-code').textContent = 'Code: ' + p.code;
    document.getElementById('pharm-patient-profile').innerHTML = `
        <div><strong>Name:</strong> ${pharmEsc(p.profile.name)}</div>
        <div><strong>Email:</strong> ${pharmEsc(p.profile.email)}</div>
        <div><strong>Phone:</strong> ${pharmEsc(p.profile.phone || '—')}</div>
        <div><strong>Date of Birth:</strong> ${pharmEsc(p.profile.dob || '—')}</div>
        <div><strong>Medications:</strong> ${current.length} current · ${past.length} past</div>
        <div><strong>Prescriptions:</strong> ${(p.prescriptions || []).length}</div>
        <div><strong>Wearable readings:</strong> ${(p.wearableRecords || []).length}</div>
    `;

    renderPharmacistMedicationPanels();
    renderPharmacistHistory();
    resetPharmacistHistory();
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
