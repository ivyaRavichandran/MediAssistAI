// ===== Medication Management Module =====

// ===== Medication lifecycle =====
// A course lasts as long as its duration says: "5 days", "2 weeks",
// "1 month", or a bare number (the patient form stores days). "Ongoing",
// "Not specified" and blank durations never expire.

function parseDurationDays(duration) {
    if (duration == null) return null;
    const text = String(duration).trim().toLowerCase();
    if (!text) return null;
    if (/\b(ongoing|continuous|indefinite|long[- ]?term|chronic|not specified|n\/a)\b/.test(text)) {
        return null;
    }

    const match = text.match(/(\d+(?:\.\d+)?)\s*(days|day|weeks|week|months|month|years|year|mo|d|w|y)\b/);
    if (!match) {
        // The patient form stores bare numbers of days ("30", "90").
        if (/^\d+(?:\.\d+)?$/.test(text)) {
            const bare = parseFloat(text);
            return Number.isFinite(bare) && bare > 0 ? bare : null;
        }
        return null;
    }

    const amount = parseFloat(match[1]);
    if (!Number.isFinite(amount) || amount <= 0) return null;

    const unit = match[2];
    if (unit === 'day' || unit === 'days' || unit === 'd') return amount;
    if (unit === 'week' || unit === 'weeks' || unit === 'w') return amount * 7;
    if (unit === 'month' || unit === 'months' || unit === 'mo') return amount * 30;
    if (unit === 'year' || unit === 'years' || unit === 'y') return amount * 365;
    return null;
}

function getMedicationStartDate(med) {
    if (!med) return null;
    const raw = med.startDate || med.createdAt;
    if (raw instanceof Date) return isNaN(raw.getTime()) ? null : raw;
    if (typeof raw === 'string' || typeof raw === 'number') {
        const date = new Date(raw);
        return isNaN(date.getTime()) ? null : date;
    }
    // Firestore timestamps arrive as Timestamp instances or
    // {seconds, nanoseconds} objects.
    if (raw && typeof raw.toDate === 'function') return raw.toDate();
    if (raw && typeof raw === 'object' && 'seconds' in raw) {
        return new Date(raw.seconds * 1000);
    }
    return null;
}

function getMedicationEndDate(med) {
    if (!med) return null;
    if (med.endDate) {
        const stored = new Date(med.endDate);
        if (!isNaN(stored.getTime())) return stored;
    }
    const days = parseDurationDays(med.duration);
    if (days === null) return null;
    const start = getMedicationStartDate(med);
    if (!start) return null;
    return new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
}

// Archived (active === false) medication courses are always "past".
function isMedicationExpired(med, now = Date.now()) {
    if (!med) return false;
    if (med.active === false) return true;
    const end = getMedicationEndDate(med);
    return !!end && now >= end.getTime();
}

function isMedicationCurrent(med, now = Date.now()) {
    return !!med && med.active !== false && !isMedicationExpired(med, now);
}

function getCurrentMedications() {
    return (App.medications || []).filter(med => isMedicationCurrent(med));
}

function getPastMedications() {
    return (App.medications || []).filter(med => !isMedicationCurrent(med));
}

// Called on login and by the expiry watcher. Moves finished courses out of
// the current list, deletes their reminders, and records the completion in
// history so it is not lost.
function archiveExpiredMedications(options = {}) {
    if (!App || !Array.isArray(App.medications)) return false;
    const now = Date.now();
    const expired = [];

    App.medications.forEach(med => {
        if (med.active === false) return;
        if (!isMedicationExpired(med, now)) return;
        const end = getMedicationEndDate(med);
        med.active = false;
        med.endedAt = (end || new Date(now)).toISOString();
        if (end) med.endDate = end.toISOString();
        expired.push(med);
    });

    // Also sweep reminders left behind by a partially-saved archive from a
    // previous session, even when nothing expired this time.
    const inactiveIds = new Set(
        App.medications
            .filter(med => !isMedicationCurrent(med, now))
            .map(med => med.id)
    );
    const staleReminderCount = (App.reminders || [])
        .filter(r => inactiveIds.has(r.medicationId))
        .length;

    if (expired.length === 0 && staleReminderCount === 0) return false;

    App.reminders = (App.reminders || []).filter(r => !inactiveIds.has(r.medicationId));

    expired.forEach(med => {
        const duration = med.duration || 'the prescribed course';
        App.addHistory(
            'medication',
            'Medication Course Completed',
            `${med.name}${med.dosage ? ' ' + med.dosage : ''} finished after ${duration}`
        );
    });

    App.saveData();
    if (expired.length > 0 && options.notify !== false && typeof showToast === 'function') {
        showToast(`${expired.length} medication course${expired.length === 1 ? '' : 's'} completed and moved to history`, 'warning');
    }
    if (staleReminderCount > 0 && typeof syncPushSchedule === 'function') {
        try { syncPushSchedule(); } catch (e) { /* push sync is best-effort */ }
    }
    return true;
}

function renderMedications() {
    const container = document.getElementById('medications-container');
    const currentMeds = typeof getCurrentMedications === 'function'
        ? getCurrentMedications()
        : App.medications.filter(med => med.active !== false);

    if (currentMeds.length === 0) {
        container.innerHTML = `
            <div class="empty-state-card">
                <i class="fas fa-pills"></i>
                <h3>No Current Medications</h3>
                <p>Ask your pharmacist to scan and add a prescription for you.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = currentMeds.map(med => {
        const today = new Date().toISOString().split('T')[0];
        const reminder = App.reminders.find(r => r.medicationId === med.id);
        const taken = reminder?.takenDates?.includes(today);

        // The button mirrors the reminder state so the Medications page cannot
        // offer a dose that the schedule would refuse.
        const status = (reminder && typeof getReminderStatus === 'function')
            ? getReminderStatus(reminder)
            : (taken ? 'taken' : 'due');

        const takeAction = status === 'taken'
            ? `<button class="btn-take" disabled><i class="fas fa-check"></i> Taken</button>`
            : status === 'missed'
                ? `<button class="btn-take missed" disabled><i class="fas fa-exclamation-circle"></i> Not taken</button>`
                : status === 'skipped'
                    ? `<button class="btn-take" disabled><i class="fas fa-minus"></i> Skipped</button>`
                    : status === 'upcoming'
                        ? `<button class="btn-take" disabled title="Dose window not open yet">
                               <i class="fas fa-clock"></i> Due ${formatTime(reminder.time)}
                           </button>`
                        : `<button class="btn-take" onclick="takeMedication('${med.id}')">
                               <i class="fas fa-pills"></i> Take Now
                           </button>`;
        const refill = typeof getRefillStatus === 'function' ? getRefillStatus(med) : null;
        const stockUnitVal = med.stockUnit || 'tablets';

        const stockLine = refill && refill.tracked
            ? `<span class="med-stock-pill refill-pill-${refill.level}"><i class="fas fa-boxes-stacked"></i> ${refill.stock} ${escapeHtml(stockUnitVal)}${refill.daysLeft !== null ? ` - ${refill.daysLeft <= 0 ? 'out' : `~${refill.daysLeft}d left`}` : ''}</span>`
            : '';

        return `
            <div class="medication-card">
                <div class="med-status ${med.active ? 'active' : ''}"></div>
                <h3>${med.name}</h3>
                <div class="med-dosage">${med.dosage}</div>
                <div class="med-meta">
                    <span><i class="fas fa-clock"></i> ${med.frequency}</span>
                    <span><i class="fas fa-calendar"></i> ${med.duration}</span>
                    ${reminder ? `<span><i class="fas fa-bell"></i> ${formatTime(reminder.time)}</span>` : ''}
                </div>
                ${stockLine}
                ${med.notes ? `<p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.75rem;"><i class="fas fa-info-circle"></i> ${med.notes}</p>` : ''}
                <div class="med-actions">
                    ${takeAction}
                    ${refill && refill.tracked ? `<button class="btn-delete" onclick="openRefillModal('${med.id}')"><i class="fas fa-plus"></i> Refill</button>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function canManageMedications() {
    return App.currentUser?.role === 'pharmacist';
}

function showAddMedicationModal() {
    if (!canManageMedications()) {
        showToast('Only a pharmacist can add medications', 'error');
        return;
    }
    document.getElementById('add-medication-modal').classList.remove('hidden');
}

function addMedication(e) {
    e.preventDefault();

    if (!canManageMedications()) {
        showToast('Only a pharmacist can add medications', 'error');
        return;
    }

    const name = document.getElementById('med-name').value;
    const dosage = document.getElementById('med-dosage').value;
    const frequency = document.getElementById('med-frequency').value;
    const time = document.getElementById('med-time').value;
    const duration = document.getElementById('med-duration').value;
    const notes = document.getElementById('med-notes').value;
    const stockRaw = document.getElementById('med-stock')?.value;
    const stockUnitVal = document.getElementById('med-stock-unit')?.value || 'tablets';

    if (!name || !dosage || !frequency || !time) {
        showToast('Please fill in all required fields', 'error');
        return;
    }

    const newMed = {
        id: generateId(),
        name,
        dosage,
        frequency,
        time,
        duration,
        notes,
        startDate: new Date().toISOString(),
        active: true,
        warnings: [],
        stockUnit: stockUnitVal,
        refillHistory: []
    };

    // Stock is optional; only track the medication when a quantity is given
    const stockQty = parseInt(stockRaw, 10);
    if (Number.isFinite(stockQty) && stockQty >= 0) {
        newMed.stock = stockQty;
        if (stockQty > 0) {
            newMed.refillHistory.push({
                date: new Date().toISOString(),
                quantity: stockQty,
                unit: stockUnitVal
            });
        }
    }

    App.medications.push(newMed);

    // Create reminder, unless this medicine already has one at that time.
    const newReminder = {
        id: generateId(),
        medicationId: newMed.id,
        time,
        repeat: 'daily',
        days: [],
        mealBefore: false,
        mealAfter: false,
        active: true,
        takenDates: []
    };

    const duplicate = typeof hasIdenticalReminder === 'function'
        ? hasIdenticalReminder(newReminder)
        : App.reminders.some(r =>
            r.medicationId === newMed.id && r.time === time && r.repeat === 'daily');
    if (!duplicate) App.reminders.push(newReminder);
    App.addHistory('medication', 'Medication Added', `Added ${name} ${dosage}`);
    App.saveData();
    App.updateDashboard();
    renderMedications();
    if (typeof renderRefillPage === 'function') renderRefillPage();

    closeModal('add-medication-modal');
    document.getElementById('add-medication-modal').querySelector('form').reset();
    showToast(`${name} added successfully!`);
}

// Reduce tracked stock by one dose and record a refill alert when it runs out.
function reduceStockForDose(medId) {
    const med = App.medications.find(m => m.id === medId);
    let lowNow = false;
    if (!med || !Number.isFinite(med.stock)) return false;

    const unit = med.stockUnit || 'tablets';
    med.stock = Math.max(0, med.stock - 1);
    if (unit !== 'doses') {
        med.stockUpdatedAt = new Date().toISOString();
    }
    if (med.stock === 0) {
        lowNow = true;
        App.addHistory('refill', 'Out of Stock', `${med.name} is out of ${unit}`);
    }
    return lowNow;
}

// Marking a dose from the Medications page must obey the same dose window as
// the reminders page, otherwise it silently bypasses the rule.
function takeMedication(medId) {
    const today = typeof todayKey === 'function' ? todayKey() : new Date().toISOString().split('T')[0];
    const med = App.medications.find(m => m.id === medId);
    const reminder = App.reminders.find(r =>
        r.medicationId === medId && r.active !== false && !(r.takenDates || []).includes(today));

    if (!med) return;

    if (reminder && typeof getReminderStatus === 'function') {
        const status = getReminderStatus(reminder);
        if (status === 'taken') {
            showToast('Already taken today', 'warning');
            return;
        }
        if (status === 'missed') {
            showToast(`Too late to mark ${med.name} as taken - the dose window has closed`, 'error');
            renderMedications();
            return;
        }
        if (status === 'upcoming') {
            showToast(`Too early - ${med.name} is due at ${formatTime(reminder.time)}`, 'warning');
            return;
        }
    }

    if (reminder) {
        if (!reminder.takenDates) reminder.takenDates = [];
        reminder.takenDates.push(today);
        App.addHistory('medication', 'Dose Taken', `Took ${med.name}`);
    } else {
        App.addHistory('medication', 'Dose Taken', `Took ${med.name}`);
    }

    const lowNow = reduceStockForDose(medId);
    App.saveData();
    renderMedications();
    if (typeof renderRefillPage === 'function') renderRefillPage();
    if (typeof renderReminders === 'function') renderReminders();
    App.updateDashboard();
    showToast('Dose marked as taken!', lowNow ? 'warning' : 'success');
}

function removeMedication(medId) {
    if (!canManageMedications()) {
        showToast('Only a pharmacist can remove medications', 'error');
        return;
    }
    if (!confirm('Are you sure you want to remove this medication?')) return;

    const med = App.medications.find(m => m.id === medId);
    App.medications = App.medications.filter(m => m.id !== medId);
    App.reminders = App.reminders.filter(r => r.medicationId !== medId);

    App.addHistory('medication', 'Medication Removed', `Removed ${med?.name || 'medication'}`);
    App.saveData();
    App.updateDashboard();
    renderMedications();
    if (typeof renderRefillPage === 'function') renderRefillPage();
    showToast('Medication removed');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.remove('hidden');
    const focusable = modal.querySelector('select, input, button.btn-primary');
    if (focusable) setTimeout(() => focusable.focus(), 50);
}

// Close modal on backdrop click
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.classList.add('hidden');
    }
});
