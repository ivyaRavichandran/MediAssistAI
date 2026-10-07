// ===== Web Push Client =====
// Registers this browser with the server so medication reminders are delivered
// as real push notifications, which keep working when the tab is closed.

const PushManager = {
    supported: false,
    registration: null,
    endpoint: null,
    _subscribed: false,

    init() {
        this.supported =
            'serviceWorker' in navigator &&
            'PushManager' in window &&
            'Notification' in window;

        if (!this.supported) {
            console.log('Web Push: not supported in this browser');
            return;
        }

        navigator.serviceWorker.ready
            .then((reg) => {
                this.registration = reg;
                return this.subscribe(reg);
            })
            .then(() => {
                navigator.serviceWorker.addEventListener('message', (event) => {
                    if (event.data?.type === 'DOSE_TAKEN' && event.data.reminderId) {
                        markDoseTaken(event.data.reminderId, 'Medication');
                    }
                });
            })
            .catch((e) => console.warn('Web Push: setup failed:', e.message));
    },

    async subscribe(reg) {
        if (this._subscribed) return true;
        if (Notification.permission === 'denied') {
            console.log('Web Push: notifications blocked by the user');
            return false;
        }

        if (Notification.permission !== 'granted') {
            const result = await Notification.requestPermission();
            if (result !== 'granted') return false;
        }

        const keyRes = await fetch('/api/push/vapid-key');
        if (!keyRes.ok) {
            console.log('Web Push: server has no VAPID key configured');
            return false;
        }
        const { publicKey } = await keyRes.json();

        const existing = await reg.pushManager.getSubscription();
        const subscription = existing || await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: this.urlBase64ToUint8Array(publicKey)
        });

        this.endpoint = subscription.endpoint;
        this._subscribed = true;

        await this.syncSchedule();
        console.log('Web Push: subscribed');
        return true;
    },

    // Tell the server the current reminder list. Called whenever reminders
    // change so a new dose time is scheduled without re-subscribing.
    async syncSchedule() {
        if (!this.endpoint || typeof App === 'undefined') return;
        const reminders = (App.reminders || []).map(r => ({
            id: r.id,
            time: r.time,
            repeat: r.repeat,
            days: r.days || [],
            active: r.active !== false
        }));

        try {
            const res = await fetch('/api/push/schedule', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ endpoint: this.endpoint, reminders })
            });
            if (!res.ok) throw new Error('HTTP ' + res.status);
        } catch (e) {
            console.warn('Web Push: schedule sync failed:', e.message);
        }
    },

    async sendTest() {
        if (!this.endpoint) {
            showToast('Enable notifications first', 'warning');
            return;
        }
        const res = await fetch('/api/push/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: this.endpoint })
        });
        const data = await res.json();
        showToast(data.ok ? 'Test notification sent' : 'Test failed: ' + (data.reason || 'unknown'),
            data.ok ? 'success' : 'error');
    },

    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
    }
};

// Called by App.init once the user is logged in and reminders are loaded.
async function initPushNotifications() {
    PushManager.init();
}

// Push the current reminder list to the server. Safe to call repeatedly.
function syncPushSchedule() {
    if (PushManager._subscribed) PushManager.syncSchedule();
}