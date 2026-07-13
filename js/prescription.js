// ===== Prescription Upload & OCR Module =====

let currentFile = null;

function handleFile(file) {
    if (!file.type.match(/image\/(jpeg|jpg|png|gif|webp)|application\/pdf/)) {
        showToast('Please upload an image or PDF file', 'error');
        return;
    }

    if (file.size > 10 * 1024 * 1024) {
        showToast('File size must be less than 10MB', 'error');
        return;
    }

    currentFile = file;

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('preview-image').src = e.target.result;
        document.getElementById('preview-section').classList.remove('hidden');
        document.querySelector('.upload-area').classList.add('hidden');
        document.querySelector('.upload-options').classList.add('hidden');
    };
    reader.readAsDataURL(file);
}

function captureImage() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = (e) => {
        if (e.target.files.length > 0) handleFile(e.target.files[0]);
    };
    input.click();
}

function clearUpload() {
    currentFile = null;
    document.getElementById('preview-section').classList.add('hidden');
    document.querySelector('.upload-area').classList.remove('hidden');
    document.querySelector('.upload-options').classList.remove('hidden');
    document.getElementById('processing-section').classList.add('hidden');
    document.getElementById('results-section').classList.add('hidden');
    document.getElementById('file-input').value = '';
}

async function processPrescription() {
    if (!currentFile) {
        showToast('Please upload a prescription first', 'error');
        return;
    }

    // Show processing
    document.getElementById('preview-section').classList.add('hidden');
    document.getElementById('processing-section').classList.remove('hidden');

    // Simulate OCR and AI processing steps
    const steps = ['step-1', 'step-2', 'step-3', 'step-4'];
    for (let i = 0; i < steps.length; i++) {
        await simulateProcessing(steps[i], 1000 + Math.random() * 1500);
    }

    // Generate mock results (in real app, this would use OCR + AI)
    const results = generatePrescriptionResults();

    // Show results
    document.getElementById('processing-section').classList.add('hidden');
    document.getElementById('results-section').classList.remove('hidden');

    displayResults(results);

    // Save prescription
    const prescription = {
        id: App.prescriptions.length + 1,
        date: new Date().toLocaleDateString(),
        imageData: currentFile ? URL.createObjectURL(currentFile) : null,
        medications: results.medications,
        doctor: results.doctor,
        diagnosis: results.diagnosis
    };

    App.prescriptions.push(prescription);
    App.addHistory('upload', 'Prescription Uploaded', `Uploaded prescription from Dr. ${results.doctor}`);
    App.saveData();
    App.updateDashboard();
}

function simulateProcessing(stepId, duration) {
    return new Promise((resolve) => {
        const step = document.getElementById(stepId);
        step.classList.add('active');
        step.querySelector('i').className = 'fas fa-circle-notch fa-spin';

        setTimeout(() => {
            step.classList.remove('active');
            step.classList.add('completed');
            step.querySelector('i').className = 'fas fa-check-circle';

            // Reset next step icon
            const nextStep = step.nextElementSibling;
            if (nextStep) {
                nextStep.querySelector('i').className = 'fas fa-circle-notch fa-spin';
            }

            resolve();
        }, duration);
    });
}

function generatePrescriptionResults() {
    // Simulated prescription data (in production, this comes from OCR + AI)
    const doctorNames = ['Rajesh Kumar', 'Priya Sharma', 'Amit Patel', 'Sneha Reddy', 'Vikram Singh'];
    const diagnoses = [
        'Upper Respiratory Tract Infection',
        'Type 2 Diabetes Mellitus',
        'Hypertension',
        'Gastroesophageal Reflux Disease',
        'Viral Fever',
        'Migraine',
        'Allergic Rhinitis'
    ];

    const medicationSets = [
        [
            { name: 'Amoxicillin', dosage: '500mg', frequency: 'Three Times Daily', duration: '7 days', instructions: 'Take after meals' },
            { name: 'Paracetamol', dosage: '650mg', frequency: 'As Needed', duration: '5 days', instructions: 'For fever, max 3g/day' },
            { name: 'Cetirizine', dosage: '10mg', frequency: 'Once Daily', duration: '5 days', instructions: 'Take at bedtime' }
        ],
        [
            { name: 'Metformin', dosage: '500mg', frequency: 'Twice Daily', duration: '30 days', instructions: 'Take with meals' },
            { name: 'Glimepiride', dosage: '2mg', frequency: 'Once Daily', duration: '30 days', instructions: 'Take before breakfast' },
            { name: 'Vitamin D3', dosage: '1000 IU', frequency: 'Once Weekly', duration: '12 weeks', instructions: 'Take with fatty meal' }
        ],
        [
            { name: 'Amlodipine', dosage: '5mg', frequency: 'Once Daily', duration: '30 days', instructions: 'Take in the morning' },
            { name: 'Telmisartan', dosage: '40mg', frequency: 'Once Daily', duration: '30 days', instructions: 'Take at same time daily' },
            { name: 'Aspirin', dosage: '75mg', frequency: 'Once Daily', duration: 'Ongoing', instructions: 'Take after meals' }
        ],
        [
            { name: 'Pantoprazole', dosage: '40mg', frequency: 'Once Daily', duration: '14 days', instructions: 'Take 30 min before breakfast' },
            { name: 'Domperidone', dosage: '10mg', frequency: 'Three Times Daily', duration: '14 days', instructions: 'Take before meals' },
            { name: 'Antacid Gel', dosage: '10ml', frequency: 'As Needed', duration: '14 days', instructions: 'Take after meals and at bedtime' }
        ]
    ];

    const selectedMeds = medicationSets[Math.floor(Math.random() * medicationSets.length)];
    const warnings = [];

    // Check for basic interactions
    if (selectedMeds.some(m => m.name === 'Aspirin') && selectedMeds.some(m => m.name === 'Warfarin')) {
        warnings.push('High risk: Aspirin + Warfarin increases bleeding risk');
    }

    return {
        doctor: doctorNames[Math.floor(Math.random() * doctorNames.length)],
        date: new Date().toLocaleDateString(),
        diagnosis: diagnoses[Math.floor(Math.random() * diagnoses.length)],
        medications: selectedMeds,
        warnings: warnings,
        rawText: `[Prescription]\nDoctor: ${doctorNames[0]}\nDate: ${new Date().toLocaleDateString()}\n\nRx:\n${selectedMeds.map(m => `${m.name} ${m.dosage} - ${m.frequency} x ${m.duration}`).join('\n')}\n\nInstructions: ${selectedMeds.map(m => m.instructions).join(', ')}`
    };
}

function displayResults(results) {
    document.getElementById('result-doctor').textContent = `Dr. ${results.doctor}`;
    document.getElementById('result-date').textContent = results.date;
    document.getElementById('result-diagnosis').textContent = results.diagnosis;

    const medsContainer = document.getElementById('result-medications');
    medsContainer.innerHTML = results.medications.map(med => `
        <div class="med-item">
            <div class="med-item-info">
                <h4>${med.name} ${med.dosage}</h4>
                <p>${med.frequency} | ${med.duration} | ${med.instructions}</p>
            </div>
        </div>
    `).join('');

    const warningsContainer = document.getElementById('result-warnings');
    if (results.warnings.length > 0) {
        warningsContainer.innerHTML = results.warnings.map(w => `
            <div class="warning-item">
                <i class="fas fa-exclamation-triangle"></i>
                <span>${w}</span>
            </div>
        `).join('');
    } else {
        warningsContainer.innerHTML = '<p style="color: var(--success);"><i class="fas fa-check-circle"></i> No warnings detected</p>';
    }

    // Store results for adding to medications
    window.currentPrescriptionResults = results;
}

function addToMedications() {
    const results = window.currentPrescriptionResults;
    if (!results) return;

    results.medications.forEach(med => {
        const newMed = {
            id: generateId(),
            name: med.name,
            dosage: med.dosage,
            frequency: med.frequency,
            time: '08:00',
            duration: med.duration,
            notes: med.instructions,
            startDate: new Date().toISOString(),
            active: true,
            warnings: []
        };
        App.medications.push(newMed);

        // Create reminder
        App.reminders.push({
            id: generateId(),
            medicationId: newMed.id,
            time: '08:00',
            repeat: 'daily',
            days: [],
            mealBefore: med.instructions?.toLowerCase().includes('before meal'),
            mealAfter: med.instructions?.toLowerCase().includes('after meal'),
            active: true,
            takenDates: []
        });
    });

    App.addHistory('medication', 'Medications Added', `Added ${results.medications.length} medications from prescription`);
    App.saveData();
    App.updateDashboard();
    showToast(`${results.medications.length} medications added successfully!`);
}

function checkInteractionsFromResults() {
    const results = window.currentPrescriptionResults;
    if (!results) return;

    App.navigateTo('interactions');
    setTimeout(() => {
        const input = document.getElementById('manual-drugs');
        if (input) {
            input.value = results.medications.map(m => m.name).join(', ');
            checkInteractions();
        }
    }, 300);
}

function setRemindersFromResults() {
    const results = window.currentPrescriptionResults;
    if (!results) return;

    addToMedications();
    App.navigateTo('reminders');
}

// Text-to-speech for prescription results
function readAloud() {
    if ('speechSynthesis' in window) {
        const results = window.currentPrescriptionResults;
        if (!results) return;

        const text = `Prescription from Dr. ${results.doctor}. Diagnosis: ${results.diagnosis}. Medications: ${results.medications.map(m => `${m.name} ${m.dosage}, ${m.frequency}, ${m.instructions}`).join('. ')}.`;

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.pitch = 1;
        speechSynthesis.speak(utterance);
        showToast('Reading prescription aloud...');
    } else {
        showToast('Text-to-speech not supported in this browser', 'warning');
    }
}

function downloadReport() {
    const results = window.currentPrescriptionResults;
    if (!results) return;

    const report = `
╔══════════════════════════════════════════════════╗
║         MediAssist AI - Prescription Report      ║
╠══════════════════════════════════════════════════╣
║                                                  ║
║  Doctor: Dr. ${results.doctor.padEnd(36)}║
║  Date: ${results.date.padEnd(40)}║
║  Diagnosis: ${results.diagnosis.padEnd(36)}║
║                                                  ║
╠══════════════════════════════════════════════════╣
║  MEDICATIONS                                     ║
╠══════════════════════════════════════════════════╣
${results.medications.map(m => `║  ${m.name} ${m.dosage}\n║  Frequency: ${m.frequency}\n║  Duration: ${m.duration}\n║  Instructions: ${m.instructions}\n║`).join('\n')}
╚══════════════════════════════════════════════════╝
    `.trim();

    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prescription-report-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Report downloaded!');
}
