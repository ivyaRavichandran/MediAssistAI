// ===== Drug Interaction Checker Module =====

// Comprehensive drug interaction database
const drugInteractionDB = {
    'aspirin': {
        commonName: 'Aspirin',
        type: 'NSAID / Antiplatelet',
        interactions: {
            'warfarin': { severity: 'severe', description: 'Significantly increased risk of bleeding. Avoid combination or monitor closely.' },
            'ibuprofen': { severity: 'moderate', description: 'Increased risk of gastrointestinal bleeding and reduced cardioprotective effect of aspirin.' },
            'naproxen': { severity: 'moderate', description: 'May reduce aspirin\'s antiplatelet effect. Take aspirin 30 min before naproxen.' },
            'methotrexate': { severity: 'severe', description: 'Aspirin can increase methotrexate levels, leading to toxicity.' },
            'clopidogrel': { severity: 'moderate', description: 'Dual antiplatelet therapy increases bleeding risk. Common in cardiac patients.' },
            'lisinopril': { severity: 'moderate', description: 'Aspirin may reduce the antihypertensive effect of ACE inhibitors.' },
            'metformin': { severity: 'mild', description: 'Long-term aspirin use may slightly enhance metformin\'s blood sugar-lowering effect.' },
            'amlodipine': { severity: 'mild', description: 'Generally safe combination. Monitor blood pressure.' },
            'atorvastatin': { severity: 'mild', description: 'Safe combination, commonly used together in cardiovascular disease.' }
        }
    },
    'ibuprofen': {
        commonName: 'Ibuprofen',
        type: 'NSAID',
        interactions: {
            'aspirin': { severity: 'moderate', description: 'May reduce aspirin\'s cardioprotective effect. Take aspirin 30 min before ibuprofen.' },
            'warfarin': { severity: 'severe', description: 'High risk of gastrointestinal bleeding. Avoid combination.' },
            'lisinopril': { severity: 'moderate', description: 'NSAIDs reduce ACE inhibitor effectiveness and increase kidney damage risk.' },
            'amlodipine': { severity: 'mild', description: 'May slightly reduce blood pressure-lowering effect.' },
            'metformin': { severity: 'moderate', description: 'NSAIDs may impair kidney function, increasing metformin toxicity risk.' },
            'naproxen': { severity: 'moderate', description: 'Combined NSAIDs increase GI bleeding risk. Avoid using two NSAIDs together.' },
            'clopidogrel': { severity: 'moderate', description: 'Increased bleeding risk. Monitor for signs of bleeding.' },
            'gliclazide': { severity: 'moderate', description: 'NSAIDs may enhance hypoglycemic effect of sulfonylureas.' }
        }
    },
    'warfarin': {
        commonName: 'Warfarin',
        type: 'Anticoagulant',
        interactions: {
            'aspirin': { severity: 'severe', description: 'Dramatically increased bleeding risk. Avoid unless specifically indicated.' },
            'ibuprofen': { severity: 'severe', description: 'High risk of hemorrhage. Avoid combination.' },
            'paracetamol': { severity: 'mild', description: 'Safe at recommended doses. High doses may enhance anticoagulant effect.' },
            'metformin': { severity: 'mild', description: 'Generally safe. Monitor INR occasionally.' },
            'amoxicillin': { severity: 'mild', description: 'May slightly increase INR. Monitor when starting/stopping antibiotic.' },
            'omeprazole': { severity: 'moderate', description: 'Omeprazole may increase warfarin levels. Monitor INR.' },
            'naproxen': { severity: 'severe', description: 'Very high bleeding risk. Strictly avoid.' }
        }
    },
    'metformin': {
        commonName: 'Metformin',
        type: 'Antidiabetic',
        interactions: {
            'ibuprofen': { severity: 'moderate', description: 'NSAIDs can impair kidney function, increasing lactic acidosis risk with metformin.' },
            'warfarin': { severity: 'mild', description: 'Generally safe. Occasional INR monitoring recommended.' },
            'lisinopril': { severity: 'mild', description: 'Safe combination. Both are commonly used together in diabetic patients.' },
            'amlodipine': { severity: 'mild', description: 'Safe combination. Amlodipine is often preferred antihypertensive in diabetics.' },
            'aspirin': { severity: 'mild', description: 'Generally safe. Low-dose aspirin often recommended for diabetic patients.' },
            'gliclazide': { severity: 'moderate', description: 'Both lower blood sugar. Monitor for hypoglycemia.' },
            'alcohol': { severity: 'severe', description: 'Alcohol increases lactic acidosis risk with metformin. Limit alcohol intake.' }
        }
    },
    'amlodipine': {
        commonName: 'Amlodipine',
        type: 'Calcium Channel Blocker',
        interactions: {
            'atorvastatin': { severity: 'mild', description: 'Safe and commonly used combination. May slightly increase statin levels.' },
            'lisinopril': { severity: 'mild', description: 'Excellent combination therapy for hypertension.' },
            'metformin': { severity: 'mild', description: 'Safe in diabetic patients with hypertension.' },
            'aspirin': { severity: 'mild', description: 'Safe combination, commonly used in cardiovascular disease.' },
            'ibuprofen': { severity: 'mild', description: 'NSAIDs may slightly reduce blood pressure control.' },
            'simvastatin': { severity: 'moderate', description: 'Amlodipine may increase simvastatin levels. Limit simvastatin to 20mg.' },
            'cyclosporine': { severity: 'moderate', description: 'Both may increase each other\'s levels. Monitor closely.' }
        }
    },
    'lisinopril': {
        commonName: 'Lisinopril',
        type: 'ACE Inhibitor',
        interactions: {
            'ibuprofen': { severity: 'moderate', description: 'NSAIDs reduce antihypertensive effect and increase kidney damage risk.' },
            'aspirin': { severity: 'moderate', description: 'May reduce blood pressure-lowering effect.' },
            'amlodipine': { severity: 'mild', description: 'Excellent combination for hypertension.' },
            'metformin': { severity: 'mild', description: 'Safe combination, often used together in diabetic nephropathy.' },
            'warfarin': { severity: 'mild', description: 'Generally safe. Monitor INR.' },
            'potassium': { severity: 'severe', description: 'ACE inhibitors increase potassium levels. Avoid potassium supplements without monitoring.' },
            'spironolactone': { severity: 'severe', description: 'High risk of hyperkalaemia. Monitor potassium levels closely.' }
        }
    },
    'paracetamol': {
        commonName: 'Paracetamol (Acetaminophen)',
        type: 'Analgesic / Antipyretic',
        interactions: {
            'warfarin': { severity: 'mild', description: 'Safe at recommended doses. High doses may slightly enhance anticoagulant effect.' },
            'aspirin': { severity: 'mild', description: 'Safe combination. Often used together for enhanced pain relief.' },
            'ibuprofen': { severity: 'mild', description: 'Safe combination for pain relief. Different mechanisms complement each other.' },
            'metformin': { severity: 'mild', description: 'Safe combination. Paracetamol is the preferred painkiller for diabetics.' },
            'alcohol': { severity: 'moderate', description: 'Regular alcohol use increases liver damage risk with paracetamol.' }
        }
    },
    'cetirizine': {
        commonName: 'Cetirizine',
        type: 'Antihistamine',
        interactions: {
            'aspirin': { severity: 'mild', description: 'Generally safe combination.' },
            'metformin': { severity: 'mild', description: 'No significant interaction.' },
            'amlodipine': { severity: 'mild', description: 'Safe combination.' },
            'warfarin': { severity: 'mild', description: 'No significant interaction at standard doses.' },
            'alcohol': { severity: 'moderate', description: 'May enhance sedative effects of alcohol. Avoid excessive alcohol.' },
            'sedatives': { severity: 'moderate', description: 'May increase drowsiness when combined with sedative medications.' }
        }
    },
    'omeprazole': {
        commonName: 'Omeprazole',
        type: 'Proton Pump Inhibitor',
        interactions: {
            'warfarin': { severity: 'moderate', description: 'May increase warfarin levels. Monitor INR when starting/stopping.' },
            'clopidogrel': { severity: 'severe', description: 'Omeprazole significantly reduces clopidogrel activation. Avoid combination.' },
            'metformin': { severity: 'mild', description: 'May slightly reduce metformin absorption. Generally safe.' },
            'aspirin': { severity: 'mild', description: 'Often co-prescribed to protect stomach from aspirin. Safe combination.' },
            'methotrexate': { severity: 'moderate', description: 'May increase methotrexate levels. Monitor for toxicity.' },
            'calcium': { severity: 'moderate', description: 'Long-term PPI use may reduce calcium absorption. Supplement if needed.' },
            'iron': { severity: 'moderate', description: 'May reduce iron absorption. Take iron supplement separately.' }
        }
    },
    'atorvastatin': {
        commonName: 'Atorvastatin',
        type: 'Statin',
        interactions: {
            'amlodipine': { severity: 'mild', description: 'Safe and commonly used combination. Fixed-dose combinations available.' },
            'aspirin': { severity: 'mild', description: 'Safe. Often used together for cardiovascular protection.' },
            'warfarin': { severity: 'mild', description: 'May slightly enhance warfarin effect. Monitor INR initially.' },
            'metformin': { severity: 'mild', description: 'Safe in diabetic patients. Statins may slightly increase blood sugar.' },
            'grapefruit': { severity: 'moderate', description: 'Grapefruit juice may increase statin levels. Limit intake.' },
            'fibrates': { severity: 'moderate', description: 'Increased risk of muscle damage (rhabdomyolysis). Avoid combination if possible.' },
            'erythromycin': { severity: 'moderate', description: 'May increase statin levels. Monitor for muscle pain.' }
        }
    },
    'amlodipine': {
        commonName: 'Amlodipine',
        type: 'Calcium Channel Blocker',
        interactions: {}
    },
    'gliclazide': {
        commonName: 'Gliclazide',
        type: 'Sulfonylurea Antidiabetic',
        interactions: {
            'metformin': { severity: 'moderate', description: 'Both lower blood sugar. Risk of hypoglycemia. Monitor glucose closely.' },
            'ibuprofen': { severity: 'moderate', description: 'NSAIDs may enhance hypoglycemic effect.' },
            'aspirin': { severity: 'mild', description: 'May slightly enhance blood sugar lowering. Monitor glucose.' },
            'warfarin': { severity: 'moderate', description: 'May enhance anticoagulant effect. Monitor INR.' },
            'alcohol': { severity: 'severe', description: 'Alcohol increases hypoglycemia risk. Avoid excessive intake.' }
        }
    },
    'pantoprazole': {
        commonName: 'Pantoprazole',
        type: 'Proton Pump Inhibitor',
        interactions: {
            'warfarin': { severity: 'moderate', description: 'May increase warfarin effect. Monitor INR.' },
            'clopidogrel': { severity: 'severe', description: 'Reduces clopidogrel activation. Use alternative PPI like pantoprazole is preferred over omeprazole but still caution.' },
            'methotrexate': { severity: 'moderate', description: 'May increase methotrexate levels.' },
            'iron supplements': { severity: 'moderate', description: 'May reduce iron absorption. Take separately.' },
            'calcium': { severity: 'moderate', description: 'Long-term use may affect calcium absorption.' }
        }
    },
    'domperidone': {
        commonName: 'Domperidone',
        type: 'Prokinetic / Antiemetic',
        interactions: {
            'ketoconazole': { severity: 'severe', description: 'Strongly inhibits domperidone metabolism. Avoid combination.' },
            'erythromycin': { severity: 'severe', description: 'May increase domperidone levels. Avoid combination.' },
            'itraconazole': { severity: 'severe', description: 'May increase domperidone levels. Avoid.' },
            'cimetidine': { severity: 'moderate', description: 'May slightly increase domperidone levels.' }
        }
    },
    'telmisartan': {
        commonName: 'Telmisartan',
        type: 'ARB (Angiotensin Receptor Blocker)',
        interactions: {
            'aspirin': { severity: 'mild', description: 'Generally safe. Low-dose aspirin can be used with ARBs.' },
            'ibuprofen': { severity: 'moderate', description: 'NSAIDs reduce antihypertensive effect and increase kidney risk.' },
            'lisinopril': { severity: 'moderate', description: 'Dual RAAS blockade generally not recommended. Hyperkalemia risk.' },
            'metformin': { severity: 'mild', description: 'Safe combination in diabetic patients.' },
            'potassium': { severity: 'severe', description: 'ARBs increase potassium. Avoid supplements without monitoring.' },
            'spironolactone': { severity: 'severe', description: 'High risk of hyperkalemia. Monitor potassium closely.' }
        }
    }
};

function updateInteractionDrugsList() {
    const container = document.getElementById('interaction-drugs-list');
    if (!container) return;

    if (App.medications.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9rem;">No medications added yet. Add medications first or enter drugs manually below.</p>';
        return;
    }

    container.innerHTML = App.medications.map(med => `
        <div class="drug-chip">
            <span>${med.name}</span>
            <span class="remove-drug" onclick="removeInteractionDrug(this, '${med.name}')">&times;</span>
        </div>
    `).join('');
}

function removeInteractionDrug(el, name) {
    el.parentElement.remove();
}

function checkInteractions() {
    const manualInput = document.getElementById('manual-drugs').value;
    const chipDrugs = Array.from(document.querySelectorAll('#interaction-drugs-list .drug-chip span:first-child'))
        .map(el => el.textContent.trim());

    let drugs = [...chipDrugs];

    if (manualInput) {
        const manualDrugs = manualInput.split(',').map(d => d.trim()).filter(d => d);
        drugs = [...drugs, ...manualDrugs];
    }

    // Remove duplicates
    drugs = [...new Set(drugs.map(d => d.toLowerCase()))];

    if (drugs.length < 2) {
        showToast('Please enter at least 2 drugs to check interactions', 'warning');
        return;
    }

    const results = [];

    for (let i = 0; i < drugs.length; i++) {
        for (let j = i + 1; j < drugs.length; j++) {
            const interaction = findInteraction(drugs[i], drugs[j]);
            if (interaction) {
                results.push({
                    drug1: drugs[i],
                    drug2: drugs[j],
                    ...interaction
                });
            }
        }
    }

    displayInteractionResults(results, drugs);
    App.addHistory('warning', 'Interactions Checked', `Checked ${drugs.length} drugs for interactions`);
}

function findInteraction(drug1, drug2) {
    const d1 = drug1.toLowerCase();
    const d2 = drug2.toLowerCase();

    // Check both directions
    if (drugInteractionDB[d1]?.interactions?.[d2]) {
        return drugInteractionDB[d1].interactions[d2];
    }
    if (drugInteractionDB[d2]?.interactions?.[d1]) {
        return drugInteractionDB[d2].interactions[d1];
    }

    // Fuzzy matching
    for (const key of Object.keys(drugInteractionDB)) {
        if (d1.includes(key) || key.includes(d1)) {
            for (const innerKey of Object.keys(drugInteractionDB[key].interactions || {})) {
                if (d2.includes(innerKey) || innerKey.includes(d2)) {
                    return drugInteractionDB[key].interactions[innerKey];
                }
            }
        }
    }

    return null;
}

function displayInteractionResults(results, drugs) {
    const container = document.getElementById('interaction-results');
    const listContainer = document.getElementById('interaction-list');

    container.classList.remove('hidden');

    if (results.length === 0) {
        listContainer.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: var(--success);">
                <i class="fas fa-check-circle" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                <h3>No Known Interactions Found</h3>
                <p>No significant interactions were found between the ${drugs.length} drugs checked. Always consult your pharmacist or doctor for complete safety information.</p>
            </div>
        `;
        return;
    }

    // Sort by severity
    const severityOrder = { severe: 0, moderate: 1, mild: 2 };
    results.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    // Update warning count
    document.getElementById('stat-warnings').textContent = results.length;

    listContainer.innerHTML = results.map(r => `
        <div class="interaction-item ${r.severity}">
            <h4>
                <span class="severity-badge">${r.severity}</span>
                ${capitalize(r.drug1)} + ${capitalize(r.drug2)}
            </h4>
            <p>${r.description}</p>
        </div>
    `).join('');

    showToast(`Found ${results.length} interaction(s)`, results.some(r => r.severity === 'severe') ? 'error' : 'warning');
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}
