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

        const existing = await colRef.get();
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
        // this browser still holds records locally, keep the local copy rather
        // than showing the user a wiped dashboard.
        const merge = (cloud, localKey) => {
            if (cloud.length > 0 || !localKey) return cloud;
            const local = JSON.parse(localStorage.getItem(localKey) || '[]');
            return local;
        };

        return {
            medications: merge(medications, 'mediassist_medications'),
            prescriptions: merge(prescriptions, 'mediassist_prescriptions'),
            reminders: merge(reminders, 'mediassist_reminders'),
            history: merge(history, 'mediassist_history')
        };
    },

    async saveAll(data) {
        await Promise.all([
            this.saveCollection('medications', data.medications || []),
            this.saveCollection('prescriptions', data.prescriptions || []),
            this.saveCollection('reminders', data.reminders || []),
            this.saveCollection('history', data.history || [])
        ]);
    }
};
