// ===== Refill Assistance Module =====
// Tracks remaining stock for each medication, estimates how long the stock
// will last based on the dosing schedule, and raises refill alerts when a
// medication is running low or has already run out.

// Doses taken per day for each frequency label used across the app
const DOSES_PER_DAY = {
    'once daily': 1,
    'once-daily': 1,
    'once': 1,
    'once daily at bedtime': 1,
    'once weekly': 0.14,
    'twice daily': 2,
    'twice-daily': 2,
    'three times daily': 3,
    'three-times': 3,
    'four times daily': 4,
    'as needed': 2
};

const DEFAULT_REPACK_SIZE = 30;   // tablets in a typical strip/pack
const DEFAULT_LOW_STOCK_DAYS = 5; // warn when fewer days of cover remain

function dosesPerDayFor(med) {
    if (typeof med.dosesPerDay === 'number' && med.dosesPerDay > 0) {
        return med.dosesPerDay;
    }
    const freq = (med.frequency || '').toLowerCase().trim();
    if (DOSES_PER_DAY[freq] !== undefined) return DOSES_PER_DAY[freq];
    // Fall back to the number of reminders attached to this medication
    const linked = (App.reminders || []).filter(r => r.medicationId === med.id);
    if (linked.length > 0) return Math.max(1, linked.length);
    return 1;
}

// Returns the refill-relevant state for one medication
function getRefillStatus(med) {
    const dosesPerDay = dosesPerDayFor(med);
    const stock = Number.isFinite(med.stock) ? med.stock : null;
    const threshold = Number.isFinite(med.refillThreshold) ? med.refillThreshold : DEFAULT_LOW_STOCK_DAYS;

    if (stock === null) {
        return { tracked: false, stock: null, dosesPerDay, daysLeft: null, level: 'untracked', threshold };
    }

    const daysLeft = dosesPerDay > 0 ? Math.floor(stock / dosesPerDay) : null;
    const refills = Array.isArray(med.refillHistory) ? med.refillHistory : [];
    const lastRefill = refills.length > 0 ? refills[refills.length - 1] : null;

    let level = 'ok';
    if (stock <= 0) level = 'out';
    else if (daysLeft !== null && daysLeft <= 1) level = 'critical';
    else if (stock <= threshold) level = 'low';
    else if (daysLeft !== null && daysLeft <= threshold) level = 'low';

    return {
        tracked: true,
        stock,
        dosesPerDay,
        daysLeft,
        level,
        threshold,
        lastRefill,
        refills
    };
}

// All medications that need attention, most urgent first
function getRefillAlerts() {
    const order = { out: 0, critical: 1, low: 2 };
    return App.medications
        .filter(m => m.active !== false)
        .map(med => ({ med, status: getRefillStatus(med) }))
        .filter(x => x.status.tracked && x.status.level !== 'ok' && x.status.level !== 'untracked')
        .sort((a, b) => {
            const byLevel = order[a.status.level] - order[b.status.level];
            if (byLevel !== 0) return byLevel;
            return (a.status.daysLeft ?? 0) - (b.status.daysLeft ?? 0);
        });
}

function isLowStock(med) {
    const s = getRefillStatus(med);
    return s.tracked && (s.level === 'out' || s.level === 'critical' || s.level === 'low');
}

// ===== Rendering =====

function renderRefillPage() {
    const container = document.getElementById('refill-list');
    if (!container) return;

    const tracked = App.medications.filter(m => getRefillStatus(m).tracked);
    const untracked = App.medications.filter(m => !getRefillStatus(m).tracked);
    const alerts = getRefillAlerts();

    // Summary counters
    const dueNow = tracked.filter(m => getRefillStatus(m).level === 'out' || getRefillStatus(m).level === 'critical').length;
    const dueSoon = tracked.filter(m => getRefillStatus(m).level === 'low').length;
    setText('refill-due-now', dueNow);
    setText('refill-due-soon', dueSoon);
    setText('refill-tracked-count', tracked.length);
    setText('refill-untracked-count', untracked.length);

    if (App.medications.length === 0) {
        container.innerHTML = `
            <div class="empty-state-card">
                <i class="fas fa-box-open"></i>
                <h3>No Medications to Refill</h3>
                <p>Add a medication with a stock quantity to start tracking refills.</p>
                <button class="btn-primary" onclick="navigateTo('medications')">
                    <i class="fas fa-pills"></i> Go to My Medications
                </button>
            </div>
        `;
        return;
    }

    let html = '';

    if (alerts.length > 0) {
        html += `
            <div class="refill-alert-banner">
                <i class="fas fa-exclamation-triangle"></i>
                <div>
                    <strong>${alerts.length} medication${alerts.length > 1 ? 's' : ''} need attention</strong>
                    <p>${alerts.map(a => `${escapeHtml(a.med.name)} (${refillLevelLabel(a.status.level)})`).join(' &middot; ')}</p>
                </div>
            </div>
        `;
    } else if (tracked.length > 0) {
        html += `
            <div class="refill-alert-banner refill-ok">
                <i class="fas fa-check-circle"></i>
                <div>
                    <strong>All medication stock looks healthy</strong>
                    <p>No refills are due right now.</p>
                </div>
            </div>
        `;
    }

    if (tracked.length > 0) {
        html += `<h3 class="refill-section-title">Tracked stock</h3>`;
        html += `<div class="refill-grid">` + tracked.map(renderRefillCard).join('') + `</div>`;
    }

    if (untracked.length > 0) {
        html += `
            <h3 class="refill-section-title">Not tracked yet</h3>
            <p class="refill-hint">Add a stock quantity to these medications to see days remaining and refill alerts.</p>
        `;
        html += `<div class="refill-grid refill-grid-muted">` + untracked.map(renderUntrackedCard).join('') + `</div>`;
    }

    container.innerHTML = html;
}

function renderRefillCard(med) {
    const s = getRefillStatus(med);
    const pct = stockPercentage(s);
    return `
        <div class="refill-card refill-${s.level}">
            <div class="refill-card-head">
                <div>
                    <h4>${escapeHtml(med.name)}</h4>
                    <p>${escapeHtml(med.dosage || '')} &middot; ${escapeHtml(med.frequency || '')}</p>
                </div>
                <span class="refill-level-badge">${refillLevelLabel(s.level)}</span>
            </div>

            <div class="refill-stock-row">
                <div class="refill-stock-numbers">
                    <span class="refill-stock-value">${s.stock}</span>
                    <span class="refill-stock-unit">${escapeHtml(stockUnit(med))} left</span>
                </div>
                <div class="refill-stock-days">
                    ${s.daysLeft === null ? 'Schedule unknown' : (s.daysLeft <= 0 ? 'Out of stock' : `About ${s.daysLeft} day${s.daysLeft === 1 ? '' : 's'} left`)}
                </div>
            </div>

            <div class="refill-bar-track">
                <div class="refill-bar-fill refill-bar-${s.level}" style="width: ${pct}%"></div>
            </div>

            <div class="refill-meta">
                <span><i class="fas fa-pills"></i> ${s.dosesPerDay} dose${s.dosesPerDay === 1 ? '' : 's'}/day</span>
                <span><i class="fas fa-clock"></i> ${s.lastRefill ? `Last refill ${formatShortDate(s.lastRefill.date)}` : 'No refill recorded'}</span>
            </div>

            <div class="refill-card-actions">
                <button class="btn-sm btn-primary" onclick="openRefillModal('${med.id}')">
                    <i class="fas fa-plus"></i> Record refill
                </button>
                <button class="btn-sm btn-secondary" onclick="openStockEditor('${med.id}')">
                    <i class="fas fa-edit"></i> Update stock
                </button>
            </div>

            ${renderRefillHistory(s.refills)}
        </div>
    `;
}

function renderUntrackedCard(med) {
    return `
        <div class="refill-card refill-untracked">
            <div class="refill-card-head">
                <div>
                    <h4>${escapeHtml(med.name)}</h4>
                    <p>${escapeHtml(med.dosage || '')} &middot; ${escapeHtml(med.frequency || '')}</p>
                </div>
                <span class="refill-level-badge">Not tracked</span>
            </div>
            <p class="refill-hint">No stock quantity recorded for this medication.</p>
            <div class="refill-card-actions">
                <button class="btn-sm btn-primary" onclick="openStockEditor('${med.id}')">
                    <i class="fas fa-plus"></i> Add stock
                </button>
            </div>
        </div>
    `;
}

function renderRefillHistory(refills) {
    if (!refills || refills.length === 0) return '';
    const recent = refills.slice(-3).reverse();
    return `
        <div class="refill-history">
            <h5>Recent refills</h5>
            <ul>
                ${recent.map(r => `<li><span>${formatShortDate(r.date)}</span><span>+${r.quantity} ${escapeHtml(r.unit || 'tablets')}</span></li>`).join('')}
            </ul>
        </div>
    `;
}

function stockPercentage(status) {
    if (!status.tracked) return 0;
    const capacity = status.stock + status.threshold * Math.max(1, status.dosesPerDay);
    if (capacity <= 0) return 0;
    return Math.max(2, Math.min(100, Math.round((status.stock / capacity) * 100)));
}

function refillLevelLabel(level) {
    switch (level) {
        case 'out': return 'Out of stock';
        case 'critical': return 'Refill now';
        case 'low': return 'Running low';
        default: return 'In stock';
    }
}

function stockUnit(med) {
    return med.stockUnit || 'tablets';
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function formatShortDate(dateStr) {
    if (!dateStr) return 'unknown';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'unknown';
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

// ===== Refill actions =====

function recordRefill(medId, quantity, unit, dateStr) {
    const med = App.medications.find(m => m.id === medId);
    if (!med) return;

    const qty = parseInt(quantity, 10);
    if (!Number.isFinite(qty) || qty <= 0) {
        showToast('Please enter a valid quantity', 'error');
        return;
    }

    const currentStock = Number.isFinite(med.stock) ? med.stock : 0;
    med.stock = currentStock + qty;
    med.stockUnit = unit || med.stockUnit || 'tablets';

    if (!Array.isArray(med.refillHistory)) med.refillHistory = [];
    med.refillHistory.push({
        date: dateStr || new Date().toISOString(),
        quantity: qty,
        unit: med.stockUnit
    });

    App.addHistory('refill', 'Refill Recorded', `${med.name}: +${qty} ${med.stockUnit} (${med.stock} in stock)`);
    App.saveData();
    App.updateDashboard();
    renderRefillPage();
    renderMedications();

    const status = getRefillStatus(med);
    showToast(`${med.name} refilled. ${status.daysLeft ?? '?'} days of supply estimated.`);
}

function updateStock(medId, newStock) {
    const med = App.medications.find(m => m.id === medId);
    if (!med) return;

    const qty = parseInt(newStock, 10);
    if (!Number.isFinite(qty) || qty < 0) {
        showToast('Please enter a valid stock quantity', 'error');
        return;
    }

    med.stock = qty;
    if (!Array.isArray(med.refillHistory)) med.refillHistory = [];
    med.stockUpdatedAt = new Date().toISOString();

    App.saveData();
    App.updateDashboard();
    renderRefillPage();
    renderMedications();
    showToast(`${med.name} stock updated to ${qty} ${stockUnit(med)}.`);
}

function refillModalOptions(selectEl, selectedId) {
    if (!selectEl) return;
    if (App.medications.length === 0) {
        selectEl.innerHTML = '<option value="">No medications available</option>';
        selectEl.disabled = true;
        return;
    }
    selectEl.disabled = false;
    selectEl.innerHTML = '<option value="">Select medication</option>' +
        App.medications.map(med => {
            const stock = Number.isFinite(med.stock) ? med.stock : 'n/a';
            return `<option value="${med.id}" ${med.id === selectedId ? 'selected' : ''}>${escapeHtml(med.name)} (${escapeHtml(med.dosage || '')}) - stock: ${stock}</option>`;
        }).join('');
}

function openRefillModal(medId) {
    refillModalOptions(document.getElementById('refill-med-select'), medId);
    const dateInput = document.getElementById('refill-date');
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
    const qtyInput = document.getElementById('refill-qty');
    if (qtyInput) qtyInput.value = DEFAULT_REPACK_SIZE;
    const unitInput = document.getElementById('refill-unit');
    if (unitInput) unitInput.value = 'tablets';
    openModal('refill-modal');
}

function openStockEditor(medId) {
    refillModalOptions(document.getElementById('stock-med-select'), medId);
    const med = App.medications.find(m => m.id === medId);
    const stockInput = document.getElementById('stock-qty');
    if (stockInput) stockInput.value = med && Number.isFinite(med.stock) ? med.stock : DEFAULT_REPACK_SIZE;
    const unitInput = document.getElementById('stock-unit');
    if (unitInput) unitInput.value = med ? stockUnit(med) : 'tablets';
    openModal('stock-modal');
}

// ===== Modal form handlers =====

function submitRefill(event) {
    if (event) event.preventDefault();
    const medId = document.getElementById('refill-med-select')?.value;
    if (!medId) {
        showToast('Please select a medication', 'error');
        return;
    }
    const qty = document.getElementById('refill-qty')?.value;
    const unit = document.getElementById('refill-unit')?.value;
    const date = document.getElementById('refill-date')?.value;
    recordRefill(medId, qty, unit, date ? new Date(date).toISOString() : null);
    closeModal('refill-modal');
}

function submitStockUpdate(event) {
    if (event) event.preventDefault();
    const medId = document.getElementById('stock-med-select')?.value;
    if (!medId) {
        showToast('Please select a medication', 'error');
        return;
    }
    const qty = document.getElementById('stock-qty')?.value;
    const unit = document.getElementById('stock-unit')?.value;
    const med = App.medications.find(m => m.id === medId);
    if (med) med.stockUnit = unit || stockUnit(med);
    updateStock(medId, qty);
    closeModal('stock-modal');
}

// ===== Dashboard integration =====

function renderDashboardRefillAlerts() {
    const container = document.getElementById('dashboard-refill-alerts');
    const wrapper = document.getElementById('dashboard-refill-alerts-wrap');
    if (!container) return;

    const alerts = getRefillAlerts().slice(0, 4);

    if (alerts.length === 0) {
        container.innerHTML = '';
        container.classList.add('hidden');
        if (wrapper) wrapper.classList.add('hidden');
        return;
    }

    if (wrapper) wrapper.classList.remove('hidden');
    container.classList.remove('hidden');
    container.innerHTML = alerts.map(({ med, status }) => `
        <div class="refill-alert-item refill-alert-${status.level}">
            <i class="fas ${status.level === 'low' ? 'fa-exclamation-circle' : 'fa-exclamation-triangle'}"></i>
            <div class="refill-alert-text">
                <strong>${escapeHtml(med.name)}</strong>
                <span>${status.stock === 0 ? 'Out of stock' : `${status.stock} ${escapeHtml(stockUnit(med))} left`}${status.daysLeft !== null && status.daysLeft > 0 ? ` - about ${status.daysLeft} day${status.daysLeft === 1 ? '' : 's'} of supply` : ''}</span>
            </div>
            <button class="btn-sm btn-primary" onclick="openRefillModal('${med.id}')">Refill</button>
        </div>
    `).join('');
}

// Escape user-controlled strings before injecting into innerHTML
function escapeHtml(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
