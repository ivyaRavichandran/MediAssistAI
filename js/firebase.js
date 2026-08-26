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

        const existing = await colRef.get();
        const existingIds = new Set(existing.docs.map(d => d.id));
        const newIds = new Set(items.map(i => i.id));

        const deletes = [];
        existing.docs.forEach(d => {
            if (!newIds.has(d.id)) deletes.push(d.ref.delete());
        });
        await Promise.all(deletes);

        const writes = items.map(item => {
            return colRef.doc(item.id).set({ ...item }, { merge: true });
        });
        await Promise.all(writes);
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
        return { medications, prescriptions, reminders, history };
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
