// ===== Firebase Configuration & Helpers =====

const firebaseConfig = {
    apiKey: "AIzaSyAmUEc1DQHBjW993TiHxNbmE_IUwrwr_E8",
    authDomain: "mediassistai-65290.firebaseapp.com",
    projectId: "mediassistai-65290",
    storageBucket: "mediassistai-65290.firebasestorage.app",
    messagingSenderId: "987715430999",
    appId: "1:987715430999:web:a771a1a498f6ba82d05112",
    measurementId: "G-NDG8FBRXKY"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

// ===== Per-user local storage =====
// Every account gets its own localStorage keys so a new user can never see
// another user's cached data on the same browser. Returns null when nobody is
// signed in, and callers must treat null as "no data" rather than falling back
// to any shared/unscoped keys.
function userStorageKey(base) {
    const uid = (typeof FB !== 'undefined' && FB.userId) ? FB.userId() : null;
    if (!uid) return null;
    return `mediassist_${base}__${uid}`;
}

// ===== Firestore Helpers =====

const FB = {
    userId() {
        return auth.currentUser?.uid || null;
    },

    userDoc() {
        const uid = this.userId();
        if (!uid) return null;
        return db.collection('users').doc(uid);
    },

    async saveUser(profile) {
        const uid = this.userId();
        if (!uid) return;
        const userRef = db.collection('users').doc(uid);
        const existing = await userRef.get();
        await userRef.set({
            name: profile.name,
            email: profile.email,
            phone: profile.phone || '',
            dob: profile.dob || '',
            createdAt: existing.exists && existing.data().createdAt
                ? existing.data().createdAt
                : firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    },

    async loadCollection(name) {
        const doc = this.userDoc();
        if (!doc) return [];
        const snap = await doc.collection(name).get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    async saveCollection(name, items) {
        const doc = this.userDoc();
        if (!doc) return;
        const colRef = doc.collection(name);

        const newIds = new Set(items.map(i => i.id));

        // Write new/changed items first, and only then delete what is absent.
        // Deleting first was unsafe: four collections are saved in parallel and
        // a failing one would already have wiped its rows, so the next save
        // would delete the rest. That is what emptied the History list.
        const writes = items.map(item =>
            colRef.doc(item.id).set({ ...item }, { merge: true })
        );
        await Promise.all(writes);

        // Mirror-deletes are only safe when this browser's copy is known to be
        // a complete snapshot of the cloud. Otherwise an empty or reset local
        // array would silently erase everything stored in Firestore.
        if (!FB._cloudLoaded || !FB._cloudLoaded[name]) return;

        const existing = await colRef.get();
        if (existing.empty) return;

        // Hard stop: never turn a wipe into a deletion. If the local copy is
        // empty but the cloud has rows, treat it as a failed load, not as a
        // request to delete everything.
        if (items.length === 0) {
            console.warn(`[sync] Skipped delete for "${name}": local copy is empty but cloud has ${existing.size} record(s).`);
            return;
        }

        const deletes = [];
        existing.docs.forEach(d => {
            if (!newIds.has(d.id)) deletes.push(d.ref.delete());
        });
        await Promise.all(deletes);
    },

    async addItem(collectionName, item) {
        const doc = this.userDoc();
        if (!doc) return;
        const id = item.id || generateId();
        await doc.collection(collectionName).doc(id).set({ ...item, id });
        return id;
    },

    async removeItem(collectionName, itemId) {
        const doc = this.userDoc();
        if (!doc) return;
        await doc.collection(collectionName).doc(itemId).delete();
    },

    async updateItem(collectionName, itemId, data) {
        const doc = this.userDoc();
        if (!doc) return;
        await doc.collection(collectionName).doc(itemId).update(data);
    },

    async loadAll() {
        const [medications, prescriptions, reminders, history] = await Promise.all([
            this.loadCollection('medications'),
            this.loadCollection('prescriptions'),
            this.loadCollection('reminders'),
            this.loadCollection('history')
        ]);

        // Firestore is the source of truth, but if it comes back empty while
        // this browser still holds records locally for THIS user, keep the
        // local copy rather than showing a wiped dashboard. Local keys are
        // namespaced per account (userStorageKey) so one user's cache can never
        // be served to another user.
        const merge = (cloud, base) => {
            if (cloud.length > 0) return cloud;
            const localKey = userStorageKey(base);
            if (!localKey) return [];   // nobody signed in -> empty, not other user's data
            try {
                return JSON.parse(localStorage.getItem(localKey) || '[]');
            } catch (e) {
                return [];
            }
        };

        const result = {
            medications: merge(medications, 'medications'),
            prescriptions: merge(prescriptions, 'prescriptions'),
            reminders: merge(reminders, 'reminders'),
            history: merge(history, 'history')
        };

        // Only mark a collection as authoritative when the cloud actually
        // answered with rows. Without this, an empty/partial load would let the
        // next save mirror-delete real cloud records.
        FB._cloudLoaded = {
            medications: medications.length > 0,
            prescriptions: prescriptions.length > 0,
            reminders: reminders.length > 0,
            history: history.length > 0
        };

        return result;
    },

    async saveAll(data) {
        // Never push an empty snapshot over a populated cloud account, and only
        // ever read fallback data from this account's own namespaced keys.
        const merged = {};
        for (const key of ['medications', 'prescriptions', 'reminders', 'history']) {
            const incoming = data[key] || [];
            if (incoming.length === 0) {
                const localKey = userStorageKey(key);
                let cached = [];
                if (localKey) {
                    try {
                        cached = JSON.parse(localStorage.getItem(localKey) || '[]');
                    } catch (e) { cached = []; }
                }
                if (cached.length > 0) merged[key] = cached;
            } else {
                merged[key] = incoming;
            }
        }

        await Promise.all([
            this.saveCollection('medications', merged.medications || []),
            this.saveCollection('prescriptions', merged.prescriptions || []),
            this.saveCollection('reminders', merged.reminders || []),
            this.saveCollection('history', merged.history || [])
        ]);
    }
};
