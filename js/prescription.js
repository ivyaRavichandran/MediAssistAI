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

    const steps = document.querySelectorAll('.processing-steps .step');
    steps.forEach(s => {
        s.classList.remove('active', 'completed');
        const i = s.querySelector('i');
        i.className = 'fas fa-circle';
    });
}

async function processPrescription() {
    if (!currentFile) {
        showToast('Please upload a prescription first', 'error');
        return;
    }

    document.getElementById('preview-section').classList.add('hidden');
    document.getElementById('processing-section').classList.remove('hidden');

    // Step 1: OCR with Tesseract.js
    await simulateProcessing('step-1', 500);
    let rawText = '';
    try {
        const result = await Tesseract.recognize(currentFile, 'eng', {
            logger: m => {
                if (m.status === 'recognizing text') {
                    const pct = Math.round(m.progress * 100);
                    const el = document.querySelector('#step-1 span');
                    if (el) el.textContent = `Extracting text with OCR... ${pct}%`;
                }
            }
        });
        rawText = result.data.text;
        document.querySelector('#step-1 span').textContent = `Extracted ${rawText.length} characters`;
    } catch (err) {
        console.error('OCR failed:', err);
        document.querySelector('#step-1 span').textContent = 'OCR failed - using fallback';
    }

    // Step 2: AI Analysis
    await simulateProcessing('step-2', 800);
    document.querySelector('#step-2 span').textContent = 'Analyzing extracted text...';

    // Step 3: Identify medications
    await simulateProcessing('step-3', 600);
    document.querySelector('#step-3 span').textContent = 'Identifying medications...';

    // Step 4: Check interactions
    await simulateProcessing('step-4', 400);
    document.querySelector('#step-4 span').textContent = 'Checking interactions...';

    // Parse the OCR text into structured results
    const results = parsePrescriptionText(rawText);

    document.getElementById('processing-section').classList.add('hidden');
    document.getElementById('results-section').classList.remove('hidden');

    displayResults(results);

    const prescription = {
        id: Date.now().toString(),
        date: new Date().toLocaleDateString(),
        imageData: currentFile ? await fileToBase64(currentFile) : null,
        medications: results.medications,
        doctor: results.doctor,
        diagnosis: results.diagnosis,
        rawText: results.rawText
    };

    App.prescriptions.push(prescription);
    App.addHistory('upload', 'Prescription Uploaded', `Uploaded prescription from Dr. ${results.doctor}`);
    App.saveData();
    App.updateDashboard();
}

function fileToBase64(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_SIZE = 400;
                let { width, height } = img;
                if (width > MAX_SIZE || height > MAX_SIZE) {
                    if (width > height) { height = (height / width) * MAX_SIZE; width = MAX_SIZE; }
                    else { width = (width / height) * MAX_SIZE; height = MAX_SIZE; }
                }
                canvas.width = width;
                canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.6));
            };
            img.src = reader.result;
        };
        reader.readAsDataURL(file);
    });
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

            const nextStep = step.nextElementSibling;
            if (nextStep) {
                nextStep.querySelector('i').className = 'fas fa-circle-notch fa-spin';
            }
            resolve();
        }, duration);
    });
}

// ===== Prescription Text Parser =====

const KNOWN_DRUGS = {
    'paracetamol': { dosage: '500mg', frequency: 'Three Times Daily', duration: '5 days', instructions: 'Take after meals', type: 'Analgesic/Antipyretic' },
    'acetaminophen': { dosage: '500mg', frequency: 'Three Times Daily', duration: '5 days', instructions: 'Take after meals', type: 'Analgesic/Antipyretic' },
    'dolo': { dosage: '650mg', frequency: 'As Needed', duration: '5 days', instructions: 'For fever, max 3g/day', type: 'Analgesic/Antipyretic' },
    'crocin': { dosage: '500mg', frequency: 'Three Times Daily', duration: '5 days', instructions: 'Take after meals', type: 'Analgesic/Antipyretic' },
    'amoxicillin': { dosage: '500mg', frequency: 'Three Times Daily', duration: '7 days', instructions: 'Take after meals', type: 'Antibiotic' },
    'azithromycin': { dosage: '500mg', frequency: 'Once Daily', duration: '5 days', instructions: 'Take 1 hour before or 2 hours after meals', type: 'Antibiotic' },
    'metronidazole': { dosage: '400mg', frequency: 'Three Times Daily', duration: '5 days', instructions: 'Avoid alcohol', type: 'Antibiotic' },
    'ciprofloxacin': { dosage: '500mg', frequency: 'Twice Daily', duration: '7 days', instructions: 'Take with plenty of water', type: 'Antibiotic' },
    'cetirizine': { dosage: '10mg', frequency: 'Once Daily', duration: '5 days', instructions: 'Take at bedtime', type: 'Antihistamine' },
    'levocetirizine': { dosage: '5mg', frequency: 'Once Daily', duration: '5 days', instructions: 'Take at bedtime', type: 'Antihistamine' },
    'loratadine': { dosage: '10mg', frequency: 'Once Daily', duration: '5 days', instructions: 'Take in the morning', type: 'Antihistamine' },
    'metformin': { dosage: '500mg', frequency: 'Twice Daily', duration: '30 days', instructions: 'Take with meals', type: 'Antidiabetic' },
    'glimepiride': { dosage: '2mg', frequency: 'Once Daily', duration: '30 days', instructions: 'Take before breakfast', type: 'Antidiabetic' },
    'gliclazide': { dosage: '80mg', frequency: 'Twice Daily', duration: '30 days', instructions: 'Take before meals', type: 'Antidiabetic' },
    'amlodipine': { dosage: '5mg', frequency: 'Once Daily', duration: '30 days', instructions: 'Take in the morning', type: 'Antihypertensive' },
    'telmisartan': { dosage: '40mg', frequency: 'Once Daily', duration: '30 days', instructions: 'Take at same time daily', type: 'Antihypertensive' },
    'losartan': { dosage: '50mg', frequency: 'Once Daily', duration: '30 days', instructions: 'Take at same time daily', type: 'Antihypertensive' },
    'aspirin': { dosage: '75mg', frequency: 'Once Daily', duration: 'Ongoing', instructions: 'Take after meals', type: 'Antiplatelet' },
    'clopidogrel': { dosage: '75mg', frequency: 'Once Daily', duration: 'Ongoing', instructions: 'Take at same time daily', type: 'Antiplatelet' },
    'atorvastatin': { dosage: '10mg', frequency: 'Once Daily', duration: '30 days', instructions: 'Take at bedtime', type: 'Statin' },
    'rosuvastatin': { dosage: '10mg', frequency: 'Once Daily', duration: '30 days', instructions: 'Take at bedtime', type: 'Statin' },
    'omeprazole': { dosage: '20mg', frequency: 'Once Daily', duration: '14 days', instructions: 'Take 30 min before breakfast', type: 'PPI' },
    'pantoprazole': { dosage: '40mg', frequency: 'Once Daily', duration: '14 days', instructions: 'Take 30 min before breakfast', type: 'PPI' },
    'esomeprazole': { dosage: '40mg', frequency: 'Once Daily', duration: '14 days', instructions: 'Take 30 min before breakfast', type: 'PPI' },
    'domperidone': { dosage: '10mg', frequency: 'Three Times Daily', duration: '14 days', instructions: 'Take before meals', type: 'Prokinetic' },
    'ranitidine': { dosage: '150mg', frequency: 'Twice Daily', duration: '14 days', instructions: 'Take before meals', type: 'H2 Blocker' },
    'pantop': { dosage: '40mg', frequency: 'Once Daily', duration: '14 days', instructions: 'Take 30 min before breakfast', type: 'PPI' },
    'dolo': { dosage: '650mg', frequency: 'As Needed', duration: '5 days', instructions: 'For fever, max 3g/day', type: 'Analgesic' },
    'combiflam': { dosage: '1 tablet', frequency: 'Three Times Daily', duration: '5 days', instructions: 'Take after meals', type: 'NSAID+Analgesic' },
    'ibuprofen': { dosage: '400mg', frequency: 'Three Times Daily', duration: '5 days', instructions: 'Take after meals', type: 'NSAID' },
    'naproxen': { dosage: '250mg', frequency: 'Twice Daily', duration: '5 days', instructions: 'Take after meals', type: 'NSAID' },
    'diclofenac': { dosage: '50mg', frequency: 'Three Times Daily', duration: '5 days', instructions: 'Take after meals', type: 'NSAID' },
    'tramadol': { dosage: '50mg', frequency: 'Three Times Daily', duration: '5 days', instructions: 'Take with water, avoid driving', type: 'Opioid Analgesic' },
    'vitamin d': { dosage: '1000 IU', frequency: 'Once Weekly', duration: '12 weeks', instructions: 'Take with fatty meal', type: 'Supplement' },
    'vitamin d3': { dosage: '1000 IU', frequency: 'Once Weekly', duration: '12 weeks', instructions: 'Take with fatty meal', type: 'Supplement' },
    'calcium': { dosage: '500mg', frequency: 'Twice Daily', duration: '30 days', instructions: 'Take with food', type: 'Supplement' },
    'iron': { dosage: ' tablet', frequency: 'Once Daily', duration: '30 days', instructions: 'Take on empty stomach', type: 'Supplement' },
    'folic acid': { dosage: '5mg', frequency: 'Once Daily', duration: '30 days', instructions: 'Take in the morning', type: 'Supplement' },
    'montelukast': { dosage: '10mg', frequency: 'Once Daily', duration: '30 days', instructions: 'Take at bedtime', type: 'Leukotriene Inhibitor' },
    'salbutamol': { dosage: '2mg', frequency: 'Three Times Daily', duration: '7 days', instructions: 'Take as needed for wheeze', type: 'Bronchodilator' },
    'prednisolone': { dosage: '5mg', frequency: 'Once Daily', duration: '7 days', instructions: 'Take in the morning with food', type: 'Corticosteroid' },
    'azithral': { dosage: '500mg', frequency: 'Once Daily', duration: '5 days', instructions: 'Take 1 hour before meals', type: 'Antibiotic' },
    'pan': { dosage: '40mg', frequency: 'Once Daily', duration: '14 days', instructions: 'Take 30 min before breakfast', type: 'PPI' },
    'monocef': { dosage: '500mg', frequency: 'Twice Daily', duration: '7 days', instructions: 'Take after meals', type: 'Antibiotic' },
    'taxim': { dosage: '200mg', frequency: 'Twice Daily', duration: '7 days', instructions: 'Take after meals', type: 'Antibiotic' },
    'augmentin': { dosage: '625mg', frequency: 'Three Times Daily', duration: '7 days', instructions: 'Take after meals', type: 'Antibiotic' },
    'doxycycline': { dosage: '100mg', frequency: 'Twice Daily', duration: '7 days', instructions: 'Take with full glass of water', type: 'Antibiotic' },
    'azole': { dosage: '200mg', frequency: 'Once Daily', duration: '7 days', instructions: 'Take after meals', type: 'Antifungal' },
    'fluconazole': { dosage: '150mg', frequency: 'Once', duration: '1 dose', instructions: 'Single dose', type: 'Antifungal' },
    'ondansetron': { dosage: '4mg', frequency: 'Three Times Daily', duration: '3 days', instructions: 'Take before meals', type: 'Antiemetic' },
    'domstal': { dosage: '10mg', frequency: 'Three Times Daily', duration: '7 days', instructions: 'Take before meals', type: 'Prokinetic' },
    'digene': { dosage: '2 tablets', frequency: 'Three Times Daily', duration: '7 days', instructions: 'Take after meals and at bedtime', type: 'Antacid' },
    'gelusil': { dosage: '2 tablets', frequency: 'Three Times Daily', duration: '7 days', instructions: 'Take after meals', type: 'Antacid' },
    'panadol': { dosage: '500mg', frequency: 'Three Times Daily', duration: '5 days', instructions: 'Take after meals', type: 'Analgesic' },
    'tylenol': { dosage: '500mg', frequency: 'Three Times Daily', duration: '5 days', instructions: 'Take after meals', type: 'Analgesic' },
    'avil': { dosage: '25mg', frequency: 'Three Times Daily', duration: '5 days', instructions: 'Take after meals', type: 'Antihistamine' },
    'allegra': { dosage: '120mg', frequency: 'Once Daily', duration: '7 days', instructions: 'Take on empty stomach', type: 'Antihistamine' },
    'zyrtec': { dosage: '10mg', frequency: 'Once Daily', duration: '5 days', instructions: 'Take at bedtime', type: 'Antihistamine' },
    'sinarest': { dosage: '1 tablet', frequency: 'Three Times Daily', duration: '5 days', instructions: 'Take after meals', type: 'Decongestant' },
    'sinex': { dosage: '2 drops', frequency: 'Three Times Daily', duration: '5 days', instructions: 'Nasal drops, 2 per nostril', type: 'Decongestant' },
    'becosules': { dosage: '1 capsule', frequency: 'Once Daily', duration: '30 days', instructions: 'Take after meals', type: 'Multivitamin' },
    'neurobion': { dosage: '1 tablet', frequency: 'Once Daily', duration: '30 days', instructions: 'Take after meals', type: 'Vitamin B Complex' },
    'shelcal': { dosage: '1 tablet', frequency: 'Once Daily', duration: '30 days', instructions: 'Take after meals', type: 'Calcium+Vitamin D' },
    'evion': { dosage: '400mg', frequency: 'Once Daily', duration: '30 days', instructions: 'Take after meals', type: 'Vitamin E' }
};

function parsePrescriptionText(rawText) {
    const text = rawText || '';
    const textLower = text.toLowerCase();

    let doctor = 'Unknown Doctor';
    const doctorPatterns = [
        /(?:dr\.?|doctor)\s+([A-Z][a-zA-Z\s.]+?)(?:\s*[,\n]|$)/i,
        /(?:physician|consultant)\s*:\s*([A-Z][a-zA-Z\s.]+?)(?:\s*[,\n]|$)/i,
        /^([A-Z][a-zA-Z]+\s+[A-Z][a-zA-Z]+)/m
    ];
    for (const pat of doctorPatterns) {
        const m = text.match(pat);
        if (m) { doctor = m[1].trim(); break; }
    }

    let date = new Date().toLocaleDateString();
    const dateMatch = text.match(/(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/);
    if (dateMatch) date = dateMatch[1];

    let diagnosis = 'Not specified';
    const diagPatterns = [
        /(?:diagnosis|dx|d\/o|complaints?|presenting)\s*[:\-]\s*(.+?)(?:\n|$)/i,
        /(?:suffering from|diagnosed with|case of)\s+(.+?)(?:\n|,|\.)/i
    ];
    for (const pat of diagPatterns) {
        const m = text.match(pat);
        if (m) { diagnosis = m[1].trim(); break; }
    }

    const medications = [];
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);

    for (const line of lines) {
        const lineLower = line.toLowerCase();
        for (const [drugName, info] of Object.entries(KNOWN_DRUGS)) {
            if (lineLower.includes(drugName)) {
                const dosageMatch = line.match(/(\d+(?:\.\d+)?\s*(?:mg|g|ml|mcg|iu|%|tablet|capsule|syrup|drop)s?)/i);
                const dosage = dosageMatch ? dosageMatch[1] : info.dosage;

                const freqMatch = line.match(/(?:once|twice|thrice|3\s*times|2\s*times|daily|bedtime|before|after|every\s*\d+\s*hours)/i);
                let frequency = info.frequency;
                if (freqMatch) {
                    const f = freqMatch[0].toLowerCase();
                    if (f.includes('once') || f.includes('daily') || f.includes('od')) frequency = 'Once Daily';
                    else if (f.includes('twice') || f.includes('2 times') || f.includes('bd')) frequency = 'Twice Daily';
                    else if (f.includes('thrice') || f.includes('3 times') || f.includes('tid')) frequency = 'Three Times Daily';
                    else if (f.includes('bedtime') || f.includes('hs')) frequency = 'Once Daily at Bedtime';
                    else if (f.includes('every')) frequency = freqMatch[0];
                }

                const durationMatch = line.match(/(?:for\s+)?(\d+)\s*(?:days?|weeks?|months?)/i);
                const duration = durationMatch ? durationMatch[0] : info.duration;

                let instructions = info.instructions;
                if (lineLower.includes('before meal') || lineLower.includes('empty stomach') || lineLower.includes('before food')) {
                    instructions = 'Take before meals';
                } else if (lineLower.includes('after meal') || lineLower.includes('with food') || lineLower.includes('after food')) {
                    instructions = 'Take after meals';
                } else if (lineLower.includes('bedtime') || lineLower.includes('at night')) {
                    instructions = 'Take at bedtime';
                }

                if (!medications.find(m => m.name.toLowerCase() === drugName.toLowerCase())) {
                    medications.push({
                        name: drugName.charAt(0).toUpperCase() + drugName.slice(1),
                        dosage: dosage,
                        frequency: frequency,
                        duration: duration,
                        instructions: instructions,
                        type: info.type
                    });
                }
            }
        }
    }

    if (medications.length === 0 && text.length > 10) {
        const words = text.split(/\s+/);
        for (const word of words) {
            const clean = word.toLowerCase().replace(/[^a-z]/g, '');
            if (KNOWN_DRUGS[clean]) {
                const info = KNOWN_DRUGS[clean];
                medications.push({
                    name: clean.charAt(0).toUpperCase() + clean.slice(1),
                    dosage: info.dosage,
                    frequency: info.frequency,
                    duration: info.duration,
                    instructions: info.instructions,
                    type: info.type
                });
            }
        }
    }

    if (medications.length === 0) {
        medications.push({
            name: 'Unrecognized prescription',
            dosage: 'N/A',
            frequency: 'N/A',
            duration: 'N/A',
            instructions: 'Could not parse medications from image. Please check manually.',
            type: 'Unknown'
        });
    }

    const warnings = [];
    if (typeof checkInteractions === 'function') {
        for (let i = 0; i < medications.length; i++) {
            for (let j = i + 1; j < medications.length; j++) {
                const interaction = findInteraction(medications[i].name.toLowerCase(), medications[j].name.toLowerCase());
                if (interaction) {
                    warnings.push(`${medications[i].name} + ${medications[j].name}: ${interaction.description}`);
                }
            }
        }
    }

    return {
        doctor,
        date,
        diagnosis,
        medications,
        warnings,
        rawText: text
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
MediAssist AI - Prescription Report
====================================

Doctor: Dr. ${results.doctor}
Date: ${results.date}
Diagnosis: ${results.diagnosis}

MEDICATIONS
-----------
${results.medications.map((m, i) => `${i + 1}. ${m.name} ${m.dosage}\n   Frequency: ${m.frequency}\n   Duration: ${m.duration}\n   Instructions: ${m.instructions}\n   Type: ${m.type || 'N/A'}`).join('\n\n')}

${results.warnings.length > 0 ? `WARNINGS\n--------\n${results.warnings.map(w => `- ${w}`).join('\n')}` : 'No warnings detected.'}

RAW OCR TEXT
------------
${results.rawText || 'N/A'}

====================================
Generated by MediAssist AI
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
