// ===== Global State =====
const App = {
    currentUser: null,
    medications: [],
    prescriptions: [],
    reminders: [],
    history: [],
    currentPage: 'dashboard',

    // Initialize app
    init() {
        this.loadData();
        this.checkAuth();
        this.setupDragDrop();
        this.setupFileInput();
        this.setupNotifications();
    },

    // Data persistence
    saveData() {
        localStorage.setItem('mediassist_medications', JSON.stringify(this.medications));
        localStorage.setItem('mediassist_prescriptions', JSON.stringify(this.prescriptions));
        localStorage.setItem('mediassist_reminders', JSON.stringify(this.reminders));
        localStorage.setItem('mediassist_history', JSON.stringify(this.history));
    },

    loadData() {
        this.medications = JSON.parse(localStorage.getItem('mediassist_medications') || '[]');
        this.prescriptions = JSON.parse(localStorage.getItem('mediassist_prescriptions') || '[]');
        this.reminders = JSON.parse(localStorage.getItem('mediassist_reminders') || '[]');
        this.history = JSON.parse(localStorage.getItem('mediassist_history') || '[]');
    },

    checkAuth() {
        const user = localStorage.getItem('mediassist_user');
        if (user) {
            this.currentUser = JSON.parse(user);
            this.showApp();
        } else {
            this.showAuth();
        }

        // Hide loading screen
        setTimeout(() => {
            document.getElementById('loading-screen').style.opacity = '0';
            setTimeout(() => {
                document.getElementById('loading-screen').classList.add('hidden');
            }, 500);
        }, 1500);
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
    },

    // Navigation
    navigateTo(page) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

        const pageEl = document.getElementById(`page-${page}`);
        const navEl = document.querySelector(`[data-page="${page}"]`);

        if (pageEl) pageEl.classList.add('active');
        if (navEl) navEl.classList.add('active');

        this.currentPage = page;

        // Close mobile sidebar
        document.getElementById('sidebar').classList.remove('open');

        // Refresh page data
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
            case 'reminders':
                renderReminders();
                break;
            case 'interactions':
                updateInteractionDrugsList();
                break;
            case 'history':
                renderHistory();
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

        // Update notification badge
        const badge = document.getElementById('notification-badge');
        if (todayReminders.length > 0) {
            badge.textContent = todayReminders.length;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    },

    getTodayReminders() {
        const today = new Date().toISOString().split('T')[0];
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
                const taken = r.takenDates?.includes(new Date().toISOString().split('T')[0]);
                return `
                    <div class="schedule-item">
                        <div class="schedule-time">${formatTime(r.time)}</div>
                        <div class="schedule-info">
                            <h4>${med?.name || 'Unknown'}</h4>
                            <p>${med?.dosage || ''} ${r.mealBefore ? '- Before meal' : r.mealAfter ? '- After meal' : ''}</p>
                        </div>
                        <button class="btn-take-dose ${taken ? 'taken' : ''}" 
                            onclick="markDoseTaken('${r.id}', '${med?.name || ''}')">
                            ${taken ? 'Taken' : 'Take'}
                        </button>
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
            id: Date.now(),
            type,
            title,
            details,
            date: new Date().toISOString()
        });
        this.saveData();
    },

    // Notifications setup
    setupNotifications() {
        if ('Notification' in window) {
            const toggle = document.getElementById('enable-notifications');
            toggle.checked = Notification.permission === 'granted';
        }
    },

    // Drag and drop
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

// Global navigation function
function navigateTo(page) {
    App.navigateTo(page);
}

// ===== Initialize =====
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
