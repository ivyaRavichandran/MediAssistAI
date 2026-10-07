// ===== Global State =====
const App = {
    currentUser: null,
    medications: [],
    prescriptions: [],
    reminders: [],
    history: [],
    currentPage: 'dashboard',

    init() {
        this.setupDragDrop();
        this.setupFileInput();
        this.setupNotifications();

        auth.onAuthStateChanged(async (user) => {
            if (user) {
                // Always start from an empty slate; any stale in-memory data
                // from a previous account must not bleed into this session.
                if (this._saveTimer) clearTimeout(this._saveTimer);
                this.medications = [];
                this.prescriptions = [];
                this.reminders = [];
                this.history = [];

                this.currentUser = {
                    uid: user.uid,
                    name: user.displayName || user.email.split('@')[0],
                    email: user.email
                };

                try {
                    const userDoc = await db.collection('users').doc(user.uid).get();
                    if (userDoc.exists) {
                        const data = userDoc.data();
                        this.currentUser = { ...this.currentUser, ...data, uid: user.uid };
                    }
                } catch (e) {
                    console.log('Could not load user profile:', e);
                }

                await this.loadFromFirestore();
                this.showApp();

                // Register this browser for medication push notifications.
                if (typeof initPushNotifications === 'function') {
                    setTimeout(() => initPushNotifications(), 800);
                }
            } else {
                this.currentUser = null;
                this.medications = [];
                this.prescriptions = [];
                this.reminders = [];
                this.history = [];
                this.showAuth();
            }

            setTimeout(() => {
                document.getElementById('loading-screen').style.opacity = '0';
                setTimeout(() => {
                    document.getElementById('loading-screen').classList.add('hidden');
                }, 500);
            }, 1500);
        });

        // Periodic auth check - detect lost session
        setInterval(() => {
            if (this.currentUser && !FB.userId()) {
                showToast('Session expired. Please log in again.', 'warning');
                auth.signOut();
            }
        }, 60000);
    },

    async saveToFirestore() {
        if (!FB.userId()) return;
        try {
            await FB.saveAll({
                medications: this.medications,
                prescriptions: this.prescriptions,
                reminders: this.reminders,
                history: this.history
            });
        } catch (e) {
            console.error('Firestore save error:', e.code || e.message || e);
            this.saveToLocalFallback();
        }
    },

    async loadFromFirestore() {
        if (!FB.userId()) return;
        try {
            const data = await FB.loadAll();
            this.medications = data.medications;
            this.prescriptions = data.prescriptions;
            this.reminders = data.reminders;
            this.history = data.history;
        } catch (e) {
            console.error('Firestore load error:', e);
            this.loadFromLocalFallback();
        }
    },

    saveToLocalFallback() {
        const collections = {
            medications: this.medications,
            prescriptions: this.prescriptions,
            reminders: this.reminders,
            history: this.history
        };
        for (const [base, value] of Object.entries(collections)) {
            const key = (typeof userStorageKey === 'function') ? userStorageKey(base) : null;
            if (key) localStorage.setItem(key, JSON.stringify(value));
        }
    },

    readLocalFallback(base) {
        const key = (typeof userStorageKey === 'function') ? userStorageKey(base) : null;
        if (!key) return [];   // never read another account's or shared data
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    },

    loadFromLocalFallback() {
        this.medications = this.readLocalFallback('medications');
        this.prescriptions = this.readLocalFallback('prescriptions');
        this.reminders = this.readLocalFallback('reminders');
        this.history = this.readLocalFallback('history');
    },

    saveData() {
        this.saveToLocalFallback();
        const uid = (typeof FB !== 'undefined' && FB.userId) ? FB.userId() : null;
        if (!uid) return;
        if (this._saveTimer) clearTimeout(this._saveTimer);
        this._saveTimer = setTimeout(() => {
            // Guard against a login switch in the 300ms debounce window so one
            // user's in-memory data can never be written into another user's
            // Firestore document.
            if ((typeof FB === 'undefined') || !FB.userId() || FB.userId() !== uid) return;
            this.saveToFirestore().catch(e => {
                console.error('Firestore save failed:', e);
                if (typeof showToast === 'function') {
                    showToast('Cloud save failed - data saved locally', 'warning');
                }
            });
        }, 300);
    },

    showAuth() {
        document.getElementById('auth-section').classList.remove('hidden');
        document.getElementById('app').classList.add('hidden');
    },

    showApp() {
        document.getElementById('auth-section').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        this.updateDashboard();
        this.updateGreeting();
        setupReminders();

        const key = (typeof userStorageKey === 'function') ? userStorageKey('wearable') : null;
        const saved = key ? JSON.parse(localStorage.getItem(key) || '{}') : {};
        if (typeof WearableSimulator !== 'undefined' && !WearableSimulator.isRunning) {
            WearableSimulator.init(saved.profile || 'normal');
            WearableSimulator.start();
        }

        // Google Drive OAuth returns here via ?drive=connected|error.
        this.handleDriveRedirect();
    },

    handleDriveRedirect() {
        const params = new URLSearchParams(window.location.search);
        const drive = params.get('drive');
        if (!drive && !params.has('drive')) return;

        if (drive === 'connected') {
            showToast('Google Drive connected', 'success');
        } else if (drive === 'error') {
            showToast('Google Drive connection failed', 'error');
        }
        this.navigateTo('wearable');

        // Remove the flag so a refresh doesn't re-trigger the toast.
        const url = new URL(window.location.href);
        url.searchParams.delete('drive');
        history.replaceState(null, '', url.pathname + url.search);
    },

    navigateTo(page) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

        const pageEl = document.getElementById(`page-${page}`);
        const navEl = document.querySelector(`[data-page="${page}"]`);

        if (pageEl) pageEl.classList.add('active');
        if (navEl) navEl.classList.add('active');

        this.currentPage = page;
        document.getElementById('sidebar').classList.remove('open');
        this.refreshPage(page);
    },

    refreshPage(page) {
        switch (page) {
            case 'dashboard':
                this.updateDashboard();
                break;
            case 'medications':
                renderMedications();
                break;
            case 'refills':
                renderRefillPage();
                break;
            case 'reminders':
                renderReminders();
                break;
            case 'interactions':
                updateInteractionDrugsList();
                break;
            case 'history':
                renderHistory();
                break;
            case 'wearable':
                if (typeof initWearablePage === 'function') initWearablePage();
                if (typeof initDrivePanel === 'function') initDrivePanel();
                break;
        }
    },

    updateGreeting() {
        const hour = new Date().getHours();
        let greeting = 'Good morning';
        if (hour >= 12 && hour < 17) greeting = 'Good afternoon';
        else if (hour >= 17) greeting = 'Good evening';

        const name = this.currentUser?.name || 'User';
        document.getElementById('greeting').textContent = `${greeting}, ${name}!`;
    },

    updateDashboard() {
        document.getElementById('stat-medications').textContent = this.medications.length;
        document.getElementById('stat-prescriptions').textContent = this.prescriptions.length;

        const todayReminders = this.getTodayReminders();
        document.getElementById('stat-reminders').textContent = todayReminders.length;

        const warnings = this.medications.reduce((acc, med) => acc + (med.warnings?.length || 0), 0);
        document.getElementById('stat-warnings').textContent = warnings;

        this.renderDashboardReminders(todayReminders);
        this.renderDashboardPrescriptions();
        if (typeof renderDashboardRefillAlerts === 'function') {
            renderDashboardRefillAlerts();
        }

        const badge = document.getElementById('notification-badge');
        if (todayReminders.length > 0) {
            badge.textContent = todayReminders.length;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }

        refreshHealthTips();
    },

    getTodayReminders() {
        return this.reminders.filter(r => {
            if (!r.active) return false;
            if (r.repeat === 'daily') return true;
            if (r.repeat === 'weekdays') {
                const day = new Date().getDay();
                return day >= 1 && day <= 5;
            }
            if (r.repeat === 'specific' && r.days) {
                const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                return r.days.includes(dayNames[new Date().getDay()]);
            }
            return true;
        });
    },

    renderDashboardReminders(reminders) {
        const container = document.getElementById('dashboard-reminders');
        if (reminders.length === 0) {
            container.innerHTML = '<p class="empty-state">No upcoming medications</p>';
            return;
        }

        container.innerHTML = reminders
            .sort((a, b) => a.time.localeCompare(b.time))
            .slice(0, 5)
            .map(r => {
                const med = this.medications.find(m => m.id === r.medicationId);
                const status = typeof getReminderStatus === 'function'
                    ? getReminderStatus(r)
                    : (r.takenDates?.includes(todayKey()) ? 'taken' : 'due');

                let action;
                if (status === 'taken') {
                    action = `<button class="btn-take-dose taken" disabled><i class="fas fa-check"></i> Taken</button>`;
                } else if (status === 'missed') {
                    action = `<span class="dose-status missed"><i class="fas fa-exclamation-circle"></i> Not taken</span>`;
                } else if (status === 'skipped') {
                    action = `<span class="dose-status skipped"><i class="fas fa-minus"></i> Skipped</span>`;
                } else if (status === 'due') {
                    action = `<button class="btn-take-dose due" onclick="markDoseTaken('${r.id}', '${escapeHtml(med?.name || '')}')">
                                  <i class="fas fa-pills"></i> Take now
                              </button>`;
                } else {
                    action = `<span class="dose-status upcoming">Due ${formatTime(r.time)}</span>`;
                }

                return `
                    <div class="schedule-item dose-${status}" style="${status === 'taken' || status === 'skipped' ? 'opacity: 0.6;' : ''}">
                        <div class="schedule-time">${formatTime(r.time)}</div>
                        <div class="schedule-info">
                            <h4>${escapeHtml(med?.name || 'Unknown')}</h4>
                            <p>${escapeHtml(med?.dosage || '')} ${r.mealBefore ? '- Before meal' : r.mealAfter ? '- After meal' : ''}</p>
                        </div>
                        <div class="schedule-actions">${action}</div>
                    </div>
                `;
            }).join('');
    },

    renderDashboardPrescriptions() {
        const container = document.getElementById('dashboard-prescriptions');
        if (this.prescriptions.length === 0) {
            container.innerHTML = '<p class="empty-state">No prescriptions uploaded</p>';
            return;
        }

        container.innerHTML = this.prescriptions
            .slice(-5)
            .reverse()
            .map(p => `
                <div class="schedule-item">
                    <div class="history-icon upload">
                        <i class="fas fa-file-medical"></i>
                    </div>
                    <div class="schedule-info">
                        <h4>Prescription #${p.id}</h4>
                        <p>${p.date} - ${p.medications?.length || 0} medications found</p>
                    </div>
                </div>
            `).join('');
    },

    addHistory(type, title, details) {
        this.history.push({
            id: generateId(),
            type,
            title,
            details,
            date: new Date().toISOString()
        });
    },

    setupNotifications() {
        if ('Notification' in window) {
            const toggle = document.getElementById('enable-notifications');
            if (toggle) toggle.checked = Notification.permission === 'granted';
        }
    },

    setupDragDrop() {
        const uploadArea = document.getElementById('upload-area');
        if (!uploadArea) return;

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => {
                uploadArea.classList.add('dragover');
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => {
                uploadArea.classList.remove('dragover');
            });
        });

        uploadArea.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            if (files.length > 0) handleFile(files[0]);
        });

        uploadArea.addEventListener('click', () => {
            document.getElementById('file-input').click();
        });
    },

    setupFileInput() {
        const fileInput = document.getElementById('file-input');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) handleFile(e.target.files[0]);
            });
        }
    }
};

// ===== Utility Functions =====
function formatTime(time24) {
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const icon = toast.querySelector('i');
    const msg = document.getElementById('toast-message');

    msg.textContent = message;
    toast.className = `toast ${type}`;

    if (type === 'success') icon.className = 'fas fa-check-circle';
    else if (type === 'error') icon.className = 'fas fa-exclamation-circle';
    else if (type === 'warning') icon.className = 'fas fa-exclamation-triangle';

    toast.classList.remove('hidden');

    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function renderHistory() {
    const container = document.getElementById('history-list');
    if (!container) return;

    if (App.history.length === 0) {
        container.innerHTML = `
            <div class="empty-state-card">
                <i class="fas fa-history"></i>
                <h3>No History Yet</h3>
                <p>Your activity will appear here</p>
            </div>
        `;
        return;
    }

    container.innerHTML = App.history
        .slice(-20)
        .reverse()
        .map(item => {
            const date = new Date(item.date);
            const timeAgo = getTimeAgo(date);

            let iconClass = 'upload';
            let icon = 'fa-file-medical';
            if (item.type === 'medication') { iconClass = 'medication'; icon = 'fa-pills'; }
            if (item.type === 'reminder') { iconClass = 'reminder'; icon = 'fa-bell'; }
            if (item.type === 'refill') { iconClass = 'medication'; icon = 'fa-boxes-stacked'; }
            if (item.type === 'warning') { iconClass = 'warning'; icon = 'fa-exclamation-triangle'; }

            return `
                <div class="history-item">
                    <div class="history-icon ${iconClass}">
                        <i class="fas ${icon}"></i>
                    </div>
                    <div class="history-info">
                        <h4>${item.title}</h4>
                        <p>${item.details}</p>
                    </div>
                    <span style="font-size: 0.8rem; color: var(--text-muted); white-space: nowrap;">${timeAgo}</span>
                </div>
            `;
        }).join('');
}

function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

function navigateTo(page) {
    App.navigateTo(page);
}

// ===== Dynamic Health Tips =====
const healthTipPool = [
    { icon: 'fa-check-circle', color: '#4caf50', text: 'Always take medications at the same time daily for best results.' },
    { icon: 'fa-tint', color: '#2196f3', text: 'Stay hydrated - drink at least 8 glasses of water daily.' },
    { icon: 'fa-exclamation-circle', color: '#ff9800', text: 'Never skip doses without consulting your doctor first.' },
    { icon: 'fa-walking', color: '#4caf50', text: 'Walk at least 30 minutes a day to maintain heart health.' },
    { icon: 'fa-apple-alt', color: '#e91e63', text: 'Eat at least 5 servings of fruits and vegetables daily.' },
    { icon: 'fa-bed', color: '#673ab7', text: 'Get 7-9 hours of sleep every night for optimal recovery.' },
    { icon: 'fa-smoking-ban', color: '#f44336', text: 'Smoking increases medication interactions. Talk to your doctor.' },
    { icon: 'fa-heartbeat', color: '#e91e63', text: 'Monitor your blood pressure regularly if you are on antihypertensives.' },
    { icon: 'fa-utensils', color: '#ff9800', text: 'Some medications work best on an empty stomach - check with your pharmacist.' },
    { icon: 'fa-pills', color: '#2196f3', text: 'Complete the full course of antibiotics even if you feel better.' },
    { icon: 'fa-car', color: '#f44336', text: 'Drowsiness-inducing medications: avoid driving or operating machinery.' },
    { icon: 'fa-wine-bottle', color: '#ff9800', text: 'Alcohol can interact with many medications. Avoid mixing unless approved.' },
    { icon: 'fa-sun', color: '#ff9800', text: 'Some medications increase sun sensitivity. Use SPF 30+ sunscreen.' },
    { icon: 'fa-thermometer-half', color: '#f44336', text: 'Check your temperature if you feel unwell - fever can affect drug absorption.' },
    { icon: 'fa-notes-medical', color: '#4caf50', text: 'Keep an updated list of all your medications and share with every doctor.' },
    { icon: 'fa-running', color: '#2196f3', text: 'Regular exercise helps manage diabetes and heart conditions better.' },
    { icon: 'fa-brain', color: '#9c27b0', text: 'Stress management is as important as medication for chronic conditions.' },
    { icon: 'fa-weight', color: '#ff9800', text: 'Maintaining a healthy weight reduces the need for higher medication doses.' },
    { icon: 'fa-hand-holding-medical', color: '#f44336', text: 'Store medications in a cool, dry place away from direct sunlight.' },
    { icon: 'fa-calendar-check', color: '#4caf50', text: 'Set medication reminders to never miss a dose.' },
    { icon: 'fa-allergies', color: '#ff9800', text: 'Always inform doctors about all medications you take to avoid interactions.' },
    { icon: 'fa-bone', color: '#795548', text: 'Long-term PPI use may affect calcium absorption. Consider supplements.' },
    { icon: 'fa-eye', color: '#2196f3', text: 'Diabetes patients: get annual eye exams to check for retinopathy.' },
    { icon: 'fa-tooth', color: '#00bcd4', text: 'Some medications cause dry mouth - maintain good oral hygiene.' },
    { icon: 'fa-shield-alt', color: '#4caf50', text: 'Vaccinations are important even if you are on medication. Consult your doctor.' },
    { icon: 'fa-procedures', color: '#f44336', text: 'Always inform your surgeon about all medications before any procedure.' },
    { icon: 'fa-mortar-pestle', color: '#ff9800', text: 'Crush or split tablets only if approved - some are extended-release.' },
    { icon: 'fa-child', color: '#e91e63', text: 'Keep all medications out of reach of children.' },
    { icon: 'fa-recycle', color: '#4caf50', text: 'Dispose of expired medications at a pharmacy, not in the trash.' },
    { icon: 'fa-hospital', color: '#f44336', text: 'Carry your medication list in your wallet in case of emergencies.' },
    { icon: 'fa-user-md', color: '#2196f3', text: 'Regular follow-ups with your doctor ensure your treatment stays on track.' }
];

function refreshHealthTips() {
    const container = document.getElementById('health-tips-container');
    if (!container) return;

    const shuffled = [...healthTipPool].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, 3);

    // Add medication-specific tips if user has meds
    if (App.medications.length > 0) {
        const medNames = App.medications.map(m => m.name).join(', ');
        selected.push({
            icon: 'fa-pills',
            color: '#0077b6',
            text: `Your current medications: ${medNames}. Always check for interactions.`
        });
        selected.shift();
    }

    container.innerHTML = selected.map(tip => `
        <div class="tip-item">
            <i class="fas ${tip.icon}" style="color: ${tip.color};"></i>
            <p>${tip.text}</p>
        </div>
    `).join('');
}

// ===== Initialize =====
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
