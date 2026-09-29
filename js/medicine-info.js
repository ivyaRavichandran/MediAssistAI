// ===== Medicine Info & Price Estimation Module =====

// Medicine database with detailed information
const medicineDB = {
    'paracetamol': {
        name: 'Paracetamol (Acetaminophen)',
        type: 'Analgesic / Antipyretic',
        description: 'Paracetamol is one of the most commonly used medications for pain relief and fever reduction. It works by inhibiting prostaglandin synthesis in the central nervous system. It is considered one of the safest painkillers when used at recommended doses.',
        forms: ['Tablet 500mg', 'Tablet 650mg', 'Syrup 120mg/5ml', 'Drops 100mg/ml', 'IV Injection 10mg/ml', 'Suspension 250mg/5ml'],
        dosage: 'Adults: 500mg-1g every 4-6 hours (max 4g/day). Children: 10-15mg/kg every 4-6 hours.',
        sideEffects: ['Nausea (rare)', 'Allergic reactions (rare)', 'Liver damage (overdose)', 'Skin rash (very rare)'],
        interactions: ['Warfarin (may enhance effect at high doses)', 'Alcohol (increases liver risk)'],
        price: { min: 5, max: 50, currency: 'INR', unit: 'strip of 10' },
        substitutes: ['Crocin', 'Dolo', 'Calpol', 'Tylenol', 'Panadol']
    },
    'amoxicillin': {
        name: 'Amoxicillin',
        type: 'Antibiotic (Penicillin)',
        description: 'Amoxicillin is a widely used antibiotic belonging to the penicillin group. It works by killing bacteria and is effective against a wide range of infections including respiratory tract infections, urinary tract infections, and skin infections.',
        forms: ['Capsule 250mg', 'Capsule 500mg', 'Tablet 500mg', 'Syrup 125mg/5ml', 'Syrup 250mg/5ml', 'Powder for suspension'],
        dosage: 'Adults: 250-500mg every 8 hours or 500-875mg every 12 hours. Children: 25-50mg/kg/day divided every 8-12 hours.',
        sideEffects: ['Diarrhea', 'Nausea', 'Skin rash', 'Vomiting', 'Allergic reactions', 'Vaginal thrush'],
        interactions: ['Warfarin (may increase effect)', 'Methotrexate', 'Oral contraceptives (may reduce effectiveness)'],
        price: { min: 30, max: 120, currency: 'INR', unit: 'strip of 10' },
        substitutes: ['Mox', 'Amoxil', 'Amoxicillin-Teva', 'Novamox', 'Amoxicap']
    },
    'ibuprofen': {
        name: 'Ibuprofen',
        type: 'NSAID (Non-Steroidal Anti-Inflammatory Drug)',
        description: 'Ibuprofen is a non-steroidal anti-inflammatory drug used for pain, inflammation, and fever. It works by inhibiting COX-1 and COX-2 enzymes, reducing prostaglandin production.',
        forms: ['Tablet 200mg', 'Tablet 400mg', 'Tablet 600mg', 'Suspension 100mg/5ml', 'Gel 5%', 'IV Injection'],
        dosage: 'Adults: 200-400mg every 4-6 hours (max 1200mg/day OTC, 3200mg prescription). Children: 5-10mg/kg every 6-8 hours.',
        sideEffects: ['Stomach pain', 'Heartburn', 'Nausea', 'Dizziness', 'Headache', 'GI bleeding (long-term)', 'Kidney problems (long-term)'],
        interactions: ['Aspirin (reduces cardioprotective effect)', 'Warfarin (increased bleeding risk)', 'ACE inhibitors (reduced effect)', 'Lithium', 'Methotrexate'],
        price: { min: 10, max: 80, currency: 'INR', unit: 'strip of 10' },
        substitutes: ['Brufen', 'Ibugesic', 'Combiflam', 'Advil', 'Motrin']
    },
    'metformin': {
        name: 'Metformin',
        type: 'Antidiabetic (Biguanide)',
        description: 'Metformin is the first-line medication for type 2 diabetes. It works by decreasing glucose production in the liver, improving insulin sensitivity, and reducing intestinal glucose absorption.',
        forms: ['Tablet 500mg', 'Tablet 850mg', 'Tablet 1000mg', 'Extended-release 500mg', 'Extended-release 750mg', 'Extended-release 1000mg', 'Syrup 500mg/5ml'],
        dosage: 'Start 500mg once or twice daily with meals. Increase by 500mg weekly as tolerated. Max 2550mg/day (immediate release) or 2000mg (extended release).',
        sideEffects: ['Nausea', 'Diarrhea', 'Stomach pain', 'Metallic taste', 'Decreased appetite', 'Lactic acidosis (rare but serious)', 'Vitamin B12 deficiency (long-term)'],
        interactions: ['Alcohol (increased lactic acidosis risk)', 'Ibuprofen (kidney impairment)', 'Contrast dyes (hold before/after imaging)', 'Carbonic anhydrase inhibitors'],
        price: { min: 20, max: 150, currency: 'INR', unit: 'strip of 10' },
        substitutes: ['Glycomet', 'Glyciphage', 'Obimet', 'Metformin-Teva', 'Glucophage']
    },
    'amlodipine': {
        name: 'Amlodipine',
        type: 'Calcium Channel Blocker',
        description: 'Amlodipine is a calcium channel blocker used to treat high blood pressure and angina. It works by relaxing blood vessels, allowing blood to flow more easily.',
        forms: ['Tablet 2.5mg', 'Tablet 5mg', 'Tablet 10mg'],
        dosage: 'Initial: 5mg once daily. Max: 10mg once daily. Elderly: Start at 2.5mg.',
        sideEffects: ['Ankle swelling', 'Dizziness', 'Flushing', 'Headache', 'Fatigue', 'Palpitations'],
        interactions: ['Simvastatin (limit to 20mg)', 'Cyclosporine', 'Dantrolene IV'],
        price: { min: 30, max: 200, currency: 'INR', unit: 'strip of 10' },
        substitutes: ['Amlodac', 'Amlopin', 'Stamlo', 'Amlong', 'Cresp']
    },
    'lisinopril': {
        name: 'Lisinopril',
        type: 'ACE Inhibitor',
        description: 'Lisinopril is an ACE inhibitor used for hypertension, heart failure, and post-heart attack protection. It works by blocking the conversion of angiotensin I to angiotensin II.',
        forms: ['Tablet 2.5mg', 'Tablet 5mg', 'Tablet 10mg', 'Tablet 20mg', 'Tablet 40mg'],
        dosage: 'Hypertension: Start 10mg once daily. Usual: 20-40mg/day. Heart failure: Start 2.5-5mg. Max: 80mg/day.',
        sideEffects: ['Dry cough', 'Dizziness', 'Headache', 'Hyperkalemia', 'Angioedema (rare)', 'Kidney impairment'],
        interactions: ['NSAIDs (reduced effect)', 'Potassium supplements (hyperkalemia risk)', 'Spironolactone', 'Lithium'],
        price: { min: 40, max: 200, currency: 'INR', unit: 'strip of 10' },
        substitutes: ['Zestril', 'Prinivil', 'Lisnop', 'Cardopril', 'ACE-One']
    },
    'omeprazole': {
        name: 'Omeprazole',
        type: 'Proton Pump Inhibitor (PPI)',
        description: 'Omeprazole reduces stomach acid production by blocking the proton pump in the stomach lining. Used for GERD, peptic ulcers, and H. pylori eradication.',
        forms: ['Capsule 10mg', 'Capsule 20mg', 'Capsule 40mg', 'Powder for injection', 'Suspension'],
        dosage: 'GERD: 20mg once daily for 4-8 weeks. Ulcers: 20-40mg daily. H. pylori: 20mg twice daily with antibiotics.',
        sideEffects: ['Headache', 'Abdominal pain', 'Nausea', 'Diarrhea', 'Vitamin B12 deficiency (long-term)', 'Bone fractures (long-term)', 'Magnesium depletion'],
        interactions: ['Clopidogrel (reduced activation)', 'Warfarin (increased levels)', 'Methotrexate', 'Iron/calcium supplements (reduced absorption)'],
        price: { min: 30, max: 180, currency: 'INR', unit: 'strip of 10' },
        substitutes: ['Omez', 'Pantop', 'Pan 40', 'Razo', 'Esomeprazole (Nexium)']
    },
    'atorvastatin': {
        name: 'Atorvastatin',
        type: 'Statin (HMG-CoA Reductase Inhibitor)',
        description: 'Atorvastatin lowers cholesterol by blocking HMG-CoA reductase, the enzyme responsible for cholesterol production in the liver. Used for high cholesterol and cardiovascular disease prevention.',
        forms: ['Tablet 10mg', 'Tablet 20mg', 'Tablet 40mg', 'Tablet 80mg'],
        dosage: 'Start 10-20mg once daily. Max: 80mg/day. Take any time of day, with or without food.',
        sideEffects: ['Muscle pain/weakness', 'Joint pain', 'Digestive problems', 'Headache', 'Liver enzyme elevation', 'Rhabdomyolysis (rare)'],
        interactions: ['Grapefruit juice', 'Fibrates (rhabdomyolysis risk)', 'Erythromycin', 'Clarithromycin', 'Cyclosporine'],
        price: { min: 50, max: 350, currency: 'INR', unit: 'strip of 10' },
        substitutes: ['Lipitor', 'Atorva', 'Storvas', 'Tulip', 'Atcad']
    },
    'cetirizine': {
        name: 'Cetirizine',
        type: 'Antihistamine (Second Generation)',
        description: 'Cetirizine is a non-sedating antihistamine used for allergies, hay fever, and urticaria. It blocks H1 histamine receptors to reduce allergic symptoms.',
        forms: ['Tablet 5mg', 'Tablet 10mg', 'Syrup 5mg/5ml', 'Drops 10mg/ml', 'Nasal spray'],
        dosage: 'Adults: 10mg once daily. Children 6-12 years: 5-10mg once daily. Children 2-5 years: 2.5mg once daily.',
        sideEffects: ['Drowsiness (mild)', 'Dry mouth', 'Fatigue', 'Headache', 'Dizziness'],
        interactions: ['Alcohol (increased drowsiness)', 'CNS depressants', 'Theophylline'],
        price: { min: 15, max: 100, currency: 'INR', unit: 'strip of 10' },
        substitutes: ['Zyrtec', 'Cetcip', 'Alerid', 'Cetcold', 'Histazin']
    },
    'pantoprazole': {
        name: 'Pantoprazole',
        type: 'Proton Pump Inhibitor (PPI)',
        description: 'Pantoprazole reduces stomach acid production. It is used for GERD, erosive esophagitis, Zollinger-Ellison syndrome, and as part of H. pylori eradication therapy.',
        forms: ['Tablet 20mg', 'Tablet 40mg', 'Tablet 4mg (oral suspension)', 'IV Injection 40mg', 'IV Injection 40mg/10ml'],
        dosage: 'GERD: 40mg once daily for 4-8 weeks. Maintenance: 20mg daily. Erosive esophagitis: 40mg daily for up to 8 weeks.',
        sideEffects: ['Headache', 'Abdominal pain', 'Nausea', 'Gas/bloating', 'Dizziness', 'Long-term: B12 deficiency, bone fractures'],
        interactions: ['Clopidogrel (reduced activation)', 'Warfarin', 'Methotrexate', 'Iron supplements', 'Calcium supplements'],
        price: { min: 40, max: 250, currency: 'INR', unit: 'strip of 10' },
        substitutes: ['Pantodac', 'Pan 40', 'Pantop', 'Pentaz', 'Pand']
    }
};

async function searchMedicine() {
    const query = document.getElementById('medicine-search').value.toLowerCase().trim();

    if (!query) {
        showToast('Please enter a medicine name', 'warning');
        return;
    }

    // Try local database first (fast)
    let found = null;
    if (medicineDB[query]) {
        found = medicineDB[query];
    } else {
        for (const [key, value] of Object.entries(medicineDB)) {
            if (key.includes(query) || value.name.toLowerCase().includes(query)) {
                found = value;
                break;
            }
        }
    }
    if (!found) {
        for (const [key, value] of Object.entries(medicineDB)) {
            if (value.substitutes?.some(s => s.toLowerCase().includes(query))) {
                found = value;
                break;
            }
        }
    }

    if (found) {
        displayMedicineInfo(found);
        return;
    }

    // Try OpenFDA API
    showToast('Searching OpenFDA...', 'info');
    try {
        const fdaResult = await searchOpenFDA(query);
        if (fdaResult) {
            displayMedicineInfo(fdaResult);
            return;
        }
    } catch (e) {
        console.log('OpenFDA search failed:', e.message);
    }

    showToast('Medicine not found in any database', 'warning');
    displayGenericResult(query);
}

async function searchOpenFDA(query) {
    const searches = [
        `openfda.brand_name:${encodeURIComponent(query)}`,
        `openfda.generic_name:${encodeURIComponent(query)}`,
        `openfda.substance_name:${encodeURIComponent(query)}`
    ];

    for (const search of searches) {
        try {
            const resp = await fetch(`https://api.fda.gov/drug/label.json?search=${search}&limit=1`);
            if (!resp.ok) continue;
            const data = await resp.json();
            if (data.results && data.results.length > 0) {
                return parseOpenFDAResult(data.results[0]);
            }
        } catch (e) {
            continue;
        }
    }
    return null;
}

function parseOpenFDAResult(result) {
    const getField = (field) => {
        const val = result[field];
        if (Array.isArray(val)) return val.join(', ');
        return val || 'Not available';
    };

    const brandName = getField('openfda.brand_name');
    const genericName = getField('openfda.generic_name');
    const substanceName = getField('openfda.substance_name');
    const route = getField('openfda.route');
    const drugClass = getField('openfda.pharm_class_epc');

    const description = getField('description') || getField('clinical_pharmacology') || 'No description available';
    const dosageAndAdmin = getField('dosage_and_administration') || 'Consult your doctor for dosage';
    const warningsText = getField('warnings') || getField('warnings_and_cautions') || 'No warnings listed';
    const sideEffectsText = getField('adverse_reactions') || 'Consult your doctor for side effects';
    const contraindications = getField('contraindications') || 'Not listed';
    const interactions = getField('drug_interactions') || 'Consult your doctor';

    return {
        name: brandName !== 'Not available' ? `${brandName} (${genericName})` : genericName !== 'Not available' ? genericName : substanceName,
        type: drugClass !== 'Not available' ? drugClass : (route !== 'Not available' ? `Route: ${route}` : 'Medication'),
        description: description.substring(0, 500) + (description.length > 500 ? '...' : ''),
        forms: route !== 'Not available' ? [route] : ['Oral'],
        dosage: dosageAndAdmin.substring(0, 300) + (dosageAndAdmin.length > 300 ? '...' : ''),
        sideEffects: sideEffectsText.substring(0, 300).split(/[,;.]/).map(s => s.trim()).filter(s => s.length > 3 && s.length < 100).slice(0, 8),
        interactions: interactions.substring(0, 300).split(/[,;.]/).map(s => s.trim()).filter(s => s.length > 3 && s.length < 100).slice(0, 5),
        price: { min: '?', max: '?', currency: 'INR', unit: 'consult pharmacy' },
        substitutes: [],
        source: 'OpenFDA'
    };
}

function displayMedicineInfo(med) {
    const container = document.getElementById('medicine-details');
    container.classList.remove('hidden');

    document.getElementById('medicine-name').textContent = med.name;
    document.getElementById('medicine-type').textContent = med.type;
    document.getElementById('medicine-description').textContent = med.description;

    document.getElementById('medicine-forms').innerHTML = `
        <div class="tag-list">
            ${med.forms.map(f => `<span class="tag">${f}</span>`).join('')}
        </div>
    `;

    document.getElementById('medicine-dosage').textContent = med.dosage;

    document.getElementById('medicine-side-effects').innerHTML = `
        <div class="tag-list">
            ${med.sideEffects.map(s => `<span class="tag" style="background: #fff5f5; color: var(--danger);">${s}</span>`).join('')}
        </div>
    `;

    document.getElementById('medicine-interactions').innerHTML = `
        <div class="tag-list">
            ${med.interactions.map(i => `<span class="tag" style="background: #fffbeb; color: var(--warning);">${i}</span>`).join('')}
        </div>
    `;

    document.getElementById('medicine-price').innerHTML = `
        <strong>₹${med.price.min} - ₹${med.price.max}</strong> per ${med.price.unit}
        <br><small style="color: var(--text-muted);">*Approximate prices, may vary by location and pharmacy</small>
    `;

    document.getElementById('medicine-substitutes').innerHTML = `
        <div class="tag-list">
            ${med.substitutes.map(s => `<span class="tag" style="background: #e8f5e9; color: var(--success);">${s}</span>`).join('')}
        </div>
    `;

    App.addHistory('medication', 'Medicine Searched', `Searched for ${med.name}`);
    App.saveData();
}

function displayGenericResult(query) {
    const container = document.getElementById('medicine-details');
    container.classList.remove('hidden');

    document.getElementById('medicine-name').textContent = capitalize(query);
    document.getElementById('medicine-type').textContent = 'Information not available';
    document.getElementById('medicine-description').textContent = `Detailed information for "${query}" is not available in our local database. Please consult a healthcare professional or pharmacist for accurate information about this medication.`;
    document.getElementById('medicine-forms').innerHTML = '<span class="tag">Consult pharmacist</span>';
    document.getElementById('medicine-dosage').textContent = 'Please consult your doctor for dosage information.';
    document.getElementById('medicine-side-effects').innerHTML = '<span class="tag">Consult pharmacist</span>';
    document.getElementById('medicine-interactions').innerHTML = '<span class="tag">Consult pharmacist</span>';
    document.getElementById('medicine-price').textContent = 'Price information not available. Please check with your local pharmacy.';
    document.getElementById('medicine-substitutes').innerHTML = '<span class="tag">Consult pharmacist</span>';
}

