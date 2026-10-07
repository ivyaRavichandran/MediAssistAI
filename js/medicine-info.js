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
    // Resolve a possibly dotted path (e.g. "openfda.brand_name") against the
    // nested result object, exactly as the real OpenFDA payload is shaped.
    const readPath = (obj, path) => {
        let node = obj;
        for (const part of path.split('.')) {
            if (node && typeof node === 'object' && part in node) node = node[part];
            else return undefined;
        }
        return node;
    };

    // Pull the first field that actually has content; returns null when the API
    // provided nothing, so the UI can hide that section instead of inventing
    // "Not available" placeholders.
    const pick = (fields) => {
        for (const f of fields) {
            const v = readPath(result, f);
            if (v === undefined || v === null) continue;
            if (Array.isArray(v)) {
                if (v.length === 0) continue;
                const joined = v.map(x => String(x || '').trim()).filter(Boolean).join(', ');
                if (joined) return joined;
                continue;
            }
            const s = String(v).trim();
            if (s) return s;
        }
        return null;
    };

    const clean = (s, max) => {
        if (!s) return null;
        const text = String(s).replace(/\s+/g, ' ').trim();
        if (!text) return null;
        return text.length > max ? text.substring(0, max) + '...' : text;
    };

    const toList = (s, maxItems) => {
        if (!s) return [];
        return String(s).split(/[;.](?:\s|$)/).map(x => x.trim()).filter(x => x.length > 3 && x.length < 160).slice(0, maxItems);
    };

    const brandName = pick(['openfda.brand_name']);
    const genericName = pick(['openfda.generic_name']);
    const substanceName = pick(['openfda.substance_name']);
    const route = pick(['openfda.route']);
    const drugClass = pick(['openfda.pharm_class_epc']);

    return {
        name: brandName
            ? (genericName && genericName !== brandName ? `${brandName} (${genericName})` : brandName)
            : (genericName || substanceName || 'Unknown medicine'),
        type: drugClass || (route ? `Route: ${route}` : null),
        description: clean(pick(['description', 'clinical_pharmacology']), 500),
        forms: route ? [route] : [],
        dosage: clean(pick(['dosage_and_administration']), 300),
        sideEffects: toList(pick(['adverse_reactions']), 8),
        interactions: toList(pick(['drug_interactions']), 5),
        price: null,
        substitutes: [],
        source: 'OpenFDA'
    };
}

// Show/hide a whole detail section (title + content) based on whether data
// exists. Missing or empty info hides the entire section instead of rendering
// "Information not available".
function setDetailContent(id, render) {
    const el = document.getElementById(id);
    if (!el) return;
    const section = el.closest('.detail-section');
    const value = (typeof render === 'function') ? render() : render;
    const empty = value === null || value === undefined ||
        (typeof value === 'string' && !value.trim()) ||
        (Array.isArray(value) && value.length === 0);

    if (empty) {
        if (section) section.classList.add('hidden');
        el.textContent = '';
        el.innerHTML = '';
    } else {
        if (section) section.classList.remove('hidden');
        el.innerHTML = value;
    }
}

function displayMedicineInfo(med) {
    const container = document.getElementById('medicine-details');
    container.classList.remove('hidden');

    document.getElementById('medicine-name').textContent = med.name;

    const typeEl = document.getElementById('medicine-type');
    if (med.type) {
        typeEl.textContent = med.type;
        typeEl.classList.remove('hidden');
    } else {
        typeEl.classList.add('hidden');
    }

    setDetailContent('medicine-description', med.description);
    setDetailContent('medicine-forms', med.forms && med.forms.length
        ? `<div class="tag-list">${med.forms.map(f => `<span class="tag">${f}</span>`).join('')}</div>`
        : null);
    setDetailContent('medicine-dosage', med.dosage);
    setDetailContent('medicine-side-effects', med.sideEffects && med.sideEffects.length
        ? `<div class="tag-list">${med.sideEffects.map(s => `<span class="tag" style="background: #fff5f5; color: var(--danger);">${s}</span>`).join('')}</div>`
        : null);
    setDetailContent('medicine-interactions', med.interactions && med.interactions.length
        ? `<div class="tag-list">${med.interactions.map(i => `<span class="tag" style="background: #fffbeb; color: var(--warning);">${i}</span>`).join('')}</div>`
        : null);
    setDetailContent('medicine-price', med.price && med.price.min !== undefined
        ? `<strong>₹${med.price.min} - ₹${med.price.max}</strong> per ${med.price.unit}
            <br><small style="color: var(--text-muted);">*Approximate prices, may vary by location and pharmacy</small>`
        : null);
    setDetailContent('medicine-substitutes', med.substitutes && med.substitutes.length
        ? `<div class="tag-list">${med.substitutes.map(s => `<span class="tag" style="background: #e8f5e9; color: var(--success);">${s}</span>`).join('')}</div>`
        : null);

    App.addHistory('medication', 'Medicine Searched', `Searched for ${med.name}`);
    App.saveData();
}

function displayGenericResult(query) {
    const container = document.getElementById('medicine-details');
    container.classList.remove('hidden');

    // Only the name is shown for an unknown medicine; every other section is
    // hidden entirely rather than displaying "Information not available".
    document.getElementById('medicine-name').textContent = capitalize(query);
    document.getElementById('medicine-type').classList.add('hidden');
    setDetailContent('medicine-description', null);
    setDetailContent('medicine-forms', null);
    setDetailContent('medicine-dosage', null);
    setDetailContent('medicine-side-effects', null);
    setDetailContent('medicine-interactions', null);
    setDetailContent('medicine-price', null);
    setDetailContent('medicine-substitutes', null);

    App.addHistory('medication', 'Medicine Searched', `Searched for ${query}`);
    App.saveData();
}

