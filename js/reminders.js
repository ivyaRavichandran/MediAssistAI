// ===== Reminders Module =====

let reminderInterval = null;

// A dose can only be marked inside this window around the scheduled time.
// Before the window opens the reminder is "upcoming"; after it closes an
// untaken dose becomes "missed" and can no longer be marked taken.
const DOSE_WINDOW_BEFORE_MIN = 15;
const DOSE_WINDOW_AFTER_MIN = 60;

// Local calendar date. toISOString() is UTC, which rolls the date over
// incorrectly for anyone east or west of Greenwich.
function todayKey() {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
}

function timeToMinutes(hhmm) {
    const [h, m] = String(hhmm || '').split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
}

function nowMinutes() {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
}

// 'upcoming' | 'due' | 'taken' | 'missed'
function getReminderStatus(reminder) {
    const today = todayKey();
    if (reminder.takenDates?.includes(today)) return 'taken';
    if (reminder.skippedDates?.includes(today)) return 'skipped';

    const due = timeToMinutes(reminder.time);
    if (due === null) return 'upcoming';

    const now = nowMinutes();
    if (now < due - DOSE_WINDOW_BEFORE_MIN) return 'upcoming';
    if (now <= due + DOSE_WINDOW_AFTER_MIN) return 'due';
    return 'missed';
}

function isDoseActionAllowed(reminder) {
    return getReminderStatus(reminder) === 'due';
}

function setupReminders() {
    // Check frequently so a notification lands close to the scheduled minute
    // instead of drifting up to a minute behind.
    if (reminderInterval) clearInterval(reminderInterval);
    reminderInterval = setInterval(checkReminders, 20000);
    checkReminders();
}

function checkReminders() {
    const today = todayKey();

    App.reminders.forEach(reminder => {
        if (!reminder.active) return;

        const med = App.medications.find(m => m.id === reminder.medicationId);
        if (!med) return;

        // Only fire while the dose window is open, and only once per day.
        if (!isDoseActionAllowed(reminder)) return;
        if (!reminder.notifiedDates) reminder.notifiedDates = [];
        if (reminder.notifiedDates.includes(today)) return;

        reminder.notifiedDates.push(today);
        App.saveData();

        const meal = reminder.mealBefore ? 'Take before meal'
            : reminder.mealAfter ? 'Take after meal' : 'Time to take your medication';
        sendNotification(med.name, `${med.dosage || ''} - ${meal}`.trim());

        if (typeof renderReminders === 'function') renderReminders();
        if (typeof App.updateDashboard === 'function') App.updateDashboard();
    });
}

function sendNotification(title, body) {
    if (Notification.permission === 'granted') {
        new Notification(`MediAssist AI - ${title}`, {
            body: body,
            icon: 'assets/images/icon.png',
            badge: 'assets/images/badge.png',
            tag: `mediassist-dose-${title}-${body}`,
            requireInteraction: true,
            vibrate: [200, 100, 200]
        });

        // Also show toast
        showToast(`Reminder: ${title} - ${body}`, 'warning');
    }
}

function toggleNotifications() {
    const toggle = document.getElementById('enable-notifications');

    if (toggle.checked) {
        if ('Notification' in window) {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    showToast('Notifications enabled!');
                    setupReminders();
                } else {
                    toggle.checked = false;
                    showToast('Notification permission denied', 'error');
                }
            });
        } else {
            toggle.checked = false;
            showToast('Notifications not supported in this browser', 'error');
        }
    }
}

function renderReminders() {
    renderTodaySchedule();
    renderAllReminders();
    populateReminderMedicationSelect();
}

function renderTodaySchedule() {
    const container = document.getElementById('today-schedule');
    const todayReminders = App.getTodayReminders();

    if (todayReminders.length === 0) {
        container.innerHTML = `
            <div class="empty-state-card">
                <i class="fas fa-bell-slash"></i>
                <h3>No Reminders Today</h3>
                <p>Add medication reminders to stay on track</p>
            </div>
        `;
        return;
    }

    const sortedReminders = todayReminders.sort((a, b) => a.time.localeCompare(b.time));

    container.innerHTML = sortedReminders.map(r => {
        const med = App.medications.find(m => m.id === r.medicationId);
        const status = getReminderStatus(r);
        const cls = { taken: 'taken', missed: 'missed', due: 'due', upcoming: 'upcoming', skipped: 'skipped' }[status];

        let action;
        if (status === 'taken') {
            action = `<button class="btn-take-dose taken" disabled><i class="fas fa-check"></i> Taken</button>`;
        } else if (status === 'skipped') {
            action = `<button class="btn-take-dose skipped" disabled><i class="fas fa-minus"></i> Skipped</button>`;
        } else if (status === 'missed') {
            action = `<span class="dose-status missed"><i class="fas fa-exclamation-circle"></i> Not taken</span>
                       <button class="btn-icon" onclick="skipDose('${r.id}')" title="Mark as skipped">
                           <i class="fas fa-forward"></i>
                       </button>`;
        } else if (status === 'due') {
            action = `<button class="btn-take-dose due" onclick="markDoseTaken('${r.id}', '${med?.name || ''}')">
                          <i class="fas fa-pills"></i> Take now
                      </button>`;
        } else {
            action = `<span class="dose-status upcoming">Due at ${formatTime(r.time)}</span>`;
        }

        return `
            <div class="schedule-item dose-${cls}" style="${status === 'taken' || status === 'skipped' ? 'opacity: 0.6;' : ''}">
                <div class="schedule-time">${formatTime(r.time)}</div>
                <div class="schedule-info">
                    <h4>${escapeHtml(med?.name || 'Unknown Medication')}</h4>
                    <p>${escapeHtml(med?.dosage || '')}${med?.frequency ? ' | ' + escapeHtml(med.frequency) : ''} ${r.mealBefore ? '| Before meal' : r.mealAfter ? '| After meal' : ''}</p>
                </div>
                <div class="schedule-actions">
                    ${action}
                </div>
            </div>
        `;
    }).join('');
}

function renderAllReminders() {
    const container = document.getElementById('all-reminders');

    if (App.reminders.length === 0) {
        container.innerHTML = '<p class="empty-state">No reminders configured</p>';
        return;
    }

    container.innerHTML = App.reminders.map(r => {
        const med = App.medications.find(m => m.id === r.medicationId);
        return `
            <div class="schedule-item">
                <div class="schedule-time">${formatTime(r.time)}</div>
                <div class="schedule-info">
                    <h4>${med?.name || 'Unknown'}</h4>
                    <p>${r.repeat === 'daily' ? 'Every day' : r.repeat === 'weekdays' ? 'Weekdays' : 'Specific days'}</p>
                </div>
                <button class="btn-icon" onclick="deleteReminder('${r.id}')" title="Delete reminder">
                    <i class="fas fa-trash" style="color: var(--danger);"></i>
                </button>
            </div>
        `;
    }).join('');
}

function populateReminderMedicationSelect() {
    const select = document.getElementById('reminder-medication');
    if (!select) return;

    select.innerHTML = '<option value="">Select medication</option>' +
        App.medications.map(med => `<option value="${med.id}">${med.name} ${med.dosage}</option>`).join('');
}

// Two reminders for the same medicine at the same time fire two notifications
// and show twice in the schedule, so treat that as the same reminder.
function hasIdenticalReminder(candidate) {
    const sameDays = (a, b) => {
        const x = [...(a || [])].sort().join(',');
        const y = [...(b || [])].sort().join(',');
        return x === y;
    };

    return App.reminders.some(r =>
        r.medicationId === candidate.medicationId &&
        r.time === candidate.time &&
        r.repeat === candidate.repeat &&
        sameDays(r.days, candidate.days) &&
        r.active !== false
    );
}

function showAddReminderModal() {
    if (App.medications.length === 0) {
        showToast('Please add a medication first', 'warning');
        return;
    }

    populateReminderMedicationSelect();
    document.getElementById('add-reminder-modal').classList.remove('hidden');
}

function addReminder(e) {
    e.preventDefault();

    // Guard against a double submit (Enter plus click, or two rapid clicks),
    // which previously saved the same reminder twice.
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn && submitBtn.disabled) return;
    if (submitBtn) submitBtn.disabled = true;

    const medicationId = document.getElementById('reminder-medication').value;
    const time = document.getElementById('reminder-time').value;
    const repeat = document.getElementById('reminder-repeat').value;
    const mealType = document.getElementById('reminder-meal').value;

    let days = [];
    if (repeat === 'specific') {
        days = Array.from(document.querySelectorAll('.days-checkbox input:checked')).map(cb => cb.value);
        if (days.length === 0) {
            showToast('Please select at least one day', 'error');
            if (submitBtn) submitBtn.disabled = false;
            return;
        }
    }

    const newReminder = {
        id: generateId(),
        medicationId,
        time,
        repeat,
        days,
        mealBefore: mealType === 'before',
        mealAfter: mealType === 'after',
        active: true,
        takenDates: []
    };

    if (hasIdenticalReminder(newReminder)) {
        showToast('A reminder for this medicine at this time already exists', 'warning');
        if (submitBtn) submitBtn.disabled = false;
        return;
    }

    App.reminders.push(newReminder);
    App.addHistory('reminder', 'Reminder Set', `Set reminder for ${formatTime(time)}`);
    App.saveData();
    App.updateDashboard();
    renderReminders();
    if (typeof syncPushSchedule === 'function') syncPushSchedule();

    closeModal('add-reminder-modal');
    document.getElementById('add-reminder-modal').querySelector('form').reset();
    showToast('Reminder added successfully!');

    // Re-enable for the next reminder the user sets.
    setTimeout(() => { if (submitBtn) submitBtn.disabled = false; }, 0);
}

function deleteReminder(reminderId) {
    if (!confirm('Delete this reminder?')) return;

    App.reminders = App.reminders.filter(r => r.id !== reminderId);
    App.saveData();
    App.updateDashboard();
    renderReminders();
    if (typeof syncPushSchedule === 'function') syncPushSchedule();
    showToast('Reminder deleted');
}

function markDoseTaken(reminderId, medName) {
    const today = todayKey();
    const reminder = App.reminders.find(r => r.id === reminderId);

    if (!reminder) {
        showToast('Reminder not found', 'error');
        return;
    }

    const status = getReminderStatus(reminder);
    if (status === 'taken') {
        showToast('Already marked as taken today', 'warning');
        return;
    }
    if (status === 'missed') {
        showToast(`Too late to mark ${medName} as taken - the dose window has closed`, 'error');
        renderReminders();
        return;
    }
    if (status === 'upcoming') {
        showToast(`Too early - ${medName} is due at ${formatTime(reminder.time)}`, 'warning');
        return;
    }

    if (!reminder.takenDates) reminder.takenDates = [];
    reminder.takenDates.push(today);

    // Reduce tracked stock only when the dose is genuinely logged.
    const med = App.medications.find(m => m.id === reminder.medicationId);
    if (med && typeof reduceStockForDose === 'function') {
        reduceStockForDose(med.id);
    }

    App.addHistory('medication', 'Dose Taken', `Took ${medName}`);
    App.saveData();
    App.updateDashboard();
    renderReminders();
    if (typeof renderMedications === 'function') renderMedications();
    showToast(`${medName} marked as taken`);
}

function skipDose(reminderId) {
    const today = todayKey();
    const reminder = App.reminders.find(r => r.id === reminderId);
    if (!reminder) return;

    const med = App.medications.find(m => m.id === reminder.medicationId);
    if (!reminder.skippedDates) reminder.skippedDates = [];
    reminder.skippedDates.push(today);

    App.addHistory('reminder', 'Dose Skipped', `Skipped ${med?.name || 'dose'} due ${formatTime(reminder.time)}`);
    App.saveData();
    renderReminders();
    App.updateDashboard();
    showToast(`${med?.name || 'Dose'} marked as skipped`, 'warning');
}
