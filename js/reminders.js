// ===== Reminders Module =====

let reminderInterval = null;

function setupReminders() {
    // Check reminders every minute
    if (reminderInterval) clearInterval(reminderInterval);
    reminderInterval = setInterval(checkReminders, 60000);
    checkReminders();
}

function checkReminders() {
    if (Notification.permission !== 'granted') return;

    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const today = now.toISOString().split('T')[0];

    App.reminders.forEach(reminder => {
        if (!reminder.active) return;

        const med = App.medications.find(m => m.id === reminder.medicationId);
        if (!med) return;

        // Check if already taken today
        if (reminder.takenDates?.includes(today)) return;

        // Check if time matches
        if (reminder.time === currentTime) {
            sendNotification(med.name, `${med.dosage} - ${reminder.mealBefore ? 'Take before meal' : reminder.mealAfter ? 'Take after meal' : 'Time to take your medication'}`);
        }
    });
}

function sendNotification(title, body) {
    if (Notification.permission === 'granted') {
        new Notification(`MediAssist AI - ${title}`, {
            body: body,
            icon: 'assets/images/icon.png',
            badge: 'assets/images/badge.png',
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
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const today = now.toISOString().split('T')[0];

    container.innerHTML = sortedReminders.map(r => {
        const med = App.medications.find(m => m.id === r.medicationId);
        const taken = r.takenDates?.includes(today);
        const isPast = r.time < currentTime;

        return `
            <div class="schedule-item" style="${taken ? 'opacity: 0.6;' : ''} ${isPast && !taken ? 'border-left: 3px solid var(--danger);' : ''}">
                <div class="schedule-time">${formatTime(r.time)}</div>
                <div class="schedule-info">
                    <h4>${med?.name || 'Unknown Medication'}</h4>
                    <p>${med?.dosage || ''} | ${med?.frequency || ''} ${r.mealBefore ? '| Before meal' : r.mealAfter ? '| After meal' : ''}</p>
                </div>
                <div class="schedule-actions">
                    <button class="btn-take-dose ${taken ? 'taken' : ''}" 
                        onclick="markDoseTaken('${r.id}', '${med?.name || ''}')" 
                        ${taken ? 'disabled' : ''}>
                        ${taken ? '<i class="fas fa-check"></i> Taken' : '<i class="fas fa-pills"></i> Take'}
                    </button>
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
    showToast('Reminder deleted');
}

function markDoseTaken(reminderId, medName) {
    const today = new Date().toISOString().split('T')[0];
    const reminder = App.reminders.find(r => r.id === reminderId);

    if (reminder) {
        if (!reminder.takenDates) reminder.takenDates = [];
        if (!reminder.takenDates.includes(today)) {
            reminder.takenDates.push(today);
            App.addHistory('medication', 'Dose Taken', `Took ${medName}`);
            App.saveData();
            showToast(`${medName} marked as taken!`);
        } else {
            showToast('Already taken today', 'warning');
        }
    }

    renderReminders();
    App.updateDashboard();
}
