// ===== Medication Management Module =====

function renderMedications() {
    const container = document.getElementById('medications-container');

    if (App.medications.length === 0) {
        container.innerHTML = `
            <div class="empty-state-card">
                <i class="fas fa-pills"></i>
                <h3>No Medications Yet</h3>
                <p>Add your medications or upload a prescription to get started</p>
                <button class="btn-primary" onclick="navigateTo('upload')">
                    <i class="fas fa-cloud-upload-alt"></i> Upload Prescription
                </button>
            </div>
        `;
        return;
    }

    container.innerHTML = App.medications.map(med => {
        const today = new Date().toISOString().split('T')[0];
        const reminder = App.reminders.find(r => r.medicationId === med.id);
        const taken = reminder?.takenDates?.includes(today);

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
                ${med.notes ? `<p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.75rem;"><i class="fas fa-info-circle"></i> ${med.notes}</p>` : ''}
                <div class="med-actions">
                    <button class="btn-take" onclick="takeMedication('${med.id}')">
                        <i class="fas ${taken ? 'fa-check' : 'fa-pills'}"></i> ${taken ? 'Taken' : 'Take Now'}
                    </button>
                    <button class="btn-delete" onclick="removeMedication('${med.id}')">
                        <i class="fas fa-trash"></i> Remove
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function showAddMedicationModal() {
    document.getElementById('add-medication-modal').classList.remove('hidden');
}

function addMedication(e) {
    e.preventDefault();

    const name = document.getElementById('med-name').value;
    const dosage = document.getElementById('med-dosage').value;
    const frequency = document.getElementById('med-frequency').value;
    const time = document.getElementById('med-time').value;
    const duration = document.getElementById('med-duration').value;
    const notes = document.getElementById('med-notes').value;

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
        warnings: []
    };

    App.medications.push(newMed);

    // Create reminder
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

    App.reminders.push(newReminder);
    App.addHistory('medication', 'Medication Added', `Added ${name} ${dosage}`);
    App.saveData();
    App.updateDashboard();
    renderMedications();

    closeModal('add-medication-modal');
    document.getElementById('add-medication-modal').querySelector('form').reset();
    showToast(`${name} added successfully!`);
}

function takeMedication(medId) {
    const today = new Date().toISOString().split('T')[0];
    const reminder = App.reminders.find(r => r.medicationId === medId);

    if (reminder) {
        if (!reminder.takenDates) reminder.takenDates = [];
        if (!reminder.takenDates.includes(today)) {
            reminder.takenDates.push(today);
            const med = App.medications.find(m => m.id === medId);
            App.addHistory('medication', 'Dose Taken', `Took ${med?.name || 'medication'}`);
            App.saveData();
            showToast('Dose marked as taken!');
        } else {
            showToast('Already taken today', 'warning');
        }
    }

    renderMedications();
    App.updateDashboard();
}

function removeMedication(medId) {
    if (!confirm('Are you sure you want to remove this medication?')) return;

    const med = App.medications.find(m => m.id === medId);
    App.medications = App.medications.filter(m => m.id !== medId);
    App.reminders = App.reminders.filter(r => r.medicationId !== medId);

    App.addHistory('medication', 'Medication Removed', `Removed ${med?.name || 'medication'}`);
    App.saveData();
    App.updateDashboard();
    renderMedications();
    showToast('Medication removed');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

// Close modal on backdrop click
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.classList.add('hidden');
    }
});
