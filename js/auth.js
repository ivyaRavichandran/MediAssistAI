// ===== Authentication Module (Firebase Auth) =====

// Which of the two logins is selected. Patients and pharmacists share the same
// Firebase project but the account's saved role decides what the app shows.
let authRole = 'patient';

// Role chosen at the moment an account is created. Consumed once by the
// auth-state handler so a later patient login can never inherit it.
let pendingRole = null;

// Remember the role on this device so a page reload or a blocked Firestore
// read never demotes a pharmacist back to the patient view.
function roleStorageKey(uid) {
    return 'mediassist_role__' + uid;
}

function setAuthRole(role) {
    authRole = role === 'pharmacist' ? 'pharmacist' : 'patient';
    const p = document.getElementById('role-btn-patient');
    const ph = document.getElementById('role-btn-pharmacist');
    const hint = document.getElementById('auth-role-hint');
    if (p) {
        p.classList.toggle('active', authRole === 'patient');
        p.setAttribute('aria-pressed', authRole === 'patient' ? 'true' : 'false');
    }
    if (ph) {
        ph.classList.toggle('active', authRole === 'pharmacist');
        ph.setAttribute('aria-pressed', authRole === 'pharmacist' ? 'true' : 'false');
    }
    if (hint) hint.innerHTML = `Signing in as a <strong>${authRole === 'pharmacist' ? 'Pharmacist' : 'Patient'}</strong>`;
}

// Patient codes are what the pharmacist types in. Exclude look-alike
// characters (0/O, 1/I) so a code read off a screen is never mistyped.
function makePatientCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let body = '';
    for (let i = 0; i < 6; i++) body += chars[Math.floor(Math.random() * chars.length)];
    return 'PAT-' + body;
}

async function createUniquePatientCode() {
    for (let i = 0; i < 6; i++) {
        const code = makePatientCode();
        try {
            const doc = await db.collection('patientCodes').doc(code).get();
            if (!doc.exists) return code;
        } catch (e) {
            // If the lookup itself fails, still hand back a code; the write
            // below is what actually reserves it.
            return code;
        }
    }
    return 'PAT-' + Date.now().toString(36).toUpperCase().slice(-6);
}

function passwordRules(password) {
    return {
        length: password.length >= 8,
        upper: /[A-Z]/.test(password),
        lower: /[a-z]/.test(password),
        digit: /\d/.test(password),
        symbol: /[^A-Za-z0-9]/.test(password)
    };
}

function isStrongPassword(password) {
    const rules = passwordRules(password);
    return rules.length && rules.upper && rules.lower && rules.digit && rules.symbol;
}

// Live feedback under the sign-up password field.
function updatePasswordStrength() {
    const input = document.getElementById('reg-password');
    const hint = document.getElementById('reg-password-hint');
    if (!input || !hint) return;
    hint.classList.remove('hint-ok', 'hint-bad');
    if (input.value === '') {
        hint.textContent = 'Use 8+ characters with an uppercase, lowercase, number and symbol.';
        return;
    }
    if (isStrongPassword(input.value)) {
        hint.classList.add('hint-ok');
        hint.textContent = 'Password is strong.';
    } else {
        hint.classList.add('hint-bad');
        hint.textContent = 'Weak password - add uppercase, lowercase, number and symbol (8+ chars).';
    }
}

function showLogin() {
    document.getElementById('login-form').classList.remove('hidden');
    document.getElementById('register-form').classList.add('hidden');
}

function showRegister() {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('register-form').classList.remove('hidden');
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
        showToast('Please fill in all fields', 'error');
        return;
    }

    try {
        const cred = await auth.signInWithEmailAndPassword(email, password);

        // The login chosen here is the source of truth ("two logins"): a
        // Patient login always opens the patient app, a Pharmacist login
        // always opens the pharmacy dashboard. Persist it on the account so a
        // reload (or another device) keeps the same experience.
        const resolvedRole = authRole;

        try { localStorage.setItem(roleStorageKey(cred.user.uid), resolvedRole); } catch (e) { /* ignore */ }
        try { await cred.user.updateProfile({ photoURL: 'mediassist-role:' + resolvedRole }); } catch (e) { /* ignore */ }
        try {
            await db.collection('users').doc(cred.user.uid).set({ role: resolvedRole }, { merge: true });
        } catch (e) {
            // Firestore rules may not be published yet; the local role still works.
            console.warn('Could not persist role:', e.message);
        }
    } catch (err) {
        if (err.code === 'auth/user-not-found') {
            showToast('No account found with this email', 'error');
        } else if (err.code === 'auth/wrong-password') {
            showToast('Incorrect password', 'error');
        } else if (err.code === 'auth/invalid-credential') {
            showToast('Invalid email or password', 'error');
        } else {
            showToast(err.message, 'error');
        }
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const phone = document.getElementById('reg-phone').value;
    const password = document.getElementById('reg-password').value;
    const dob = document.getElementById('reg-dob').value;

    if (!name || !email || !password) {
        showToast('Please fill in all required fields', 'error');
        return;
    }

    // Strong password is mandatory when creating an account.
    if (!isStrongPassword(password)) {
        showToast('Password must be at least 8 characters with uppercase, lowercase, number and symbol', 'error');
        updatePasswordStrength();
        return;
    }

    // Date of birth is required for patients; pharmacists don't need one.
    if (authRole === 'patient') {
        const dobDate = dob ? new Date(dob + 'T00:00:00') : null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (!dobDate || isNaN(dobDate.getTime())) {
            showToast('Please select your date of birth', 'error');
            return;
        }
        if (dobDate >= today) {
            showToast('Date of birth must be in the past', 'error');
            return;
        }
        if (dobDate.getFullYear() < 1900) {
            showToast('Date of birth looks invalid', 'error');
            return;
        }
    }

    try {
        const requestedCode = authRole === 'patient' ? await createUniquePatientCode() : null;

        const cred = await auth.createUserWithEmailAndPassword(email, password);
        pendingRole = authRole;
        try { localStorage.setItem(roleStorageKey(cred.user.uid), authRole); } catch (e) { /* ignore */ }

        // Reserve the code before saving the profile. If the reservation
        // fails (typically a Firestore rule blocking patientCodes) the
        // account must not advertise a code the pharmacist cannot look up.
        let patientCode = null;
        if (requestedCode) {
            try {
                await db.collection('patientCodes').doc(requestedCode).set({
                    uid: cred.user.uid,
                    name,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                patientCode = requestedCode;
            } catch (e) {
                console.warn('Could not reserve patient code:', e.message);
            }
        }

        await FB.saveUser({
            name,
            email,
            phone,
            dob,
            role: authRole,
            patientCode: patientCode || ''
        });

        if (patientCode) {
            showToast(`Welcome, ${name}! Your patient code is ${patientCode}`);
        } else if (authRole === 'patient') {
            showToast(`Welcome, ${name}! Your patient code could not be saved - the pharmacy lookup will not work until Firestore rules allow it.`, 'warning');
        } else {
            showToast(`Pharmacist account created. Welcome, ${name}!`);
        }
    } catch (err) {
        if (err.code === 'auth/email-already-in-use') {
            showToast('Email already registered. Try signing in.', 'error');
        } else if (err.code === 'auth/weak-password') {
            showToast('Password is too weak', 'error');
        } else if (err.code === 'auth/invalid-email') {
            showToast('Invalid email address', 'error');
        } else if (err.code === 'auth/operation-not-allowed') {
            showToast('Email/password sign-up is not enabled', 'error');
        } else {
            showToast(err.message, 'error');
        }
    }
}

async function handleLogout() {
    try {
        await auth.signOut();
        App.currentUser = null;
        App.showAuth();
        showToast('Logged out successfully');
    } catch (err) {
        showToast('Logout failed: ' + err.message, 'error');
    }
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

document.addEventListener('click', (e) => {
    const sidebar = document.getElementById('sidebar');
    const menuToggle = document.querySelector('.menu-toggle');
    if (sidebar && sidebar.classList.contains('open') &&
        !sidebar.contains(e.target) && !menuToggle?.contains(e.target)) {
        sidebar.classList.remove('open');
    }
});

// Restrict the DOB picker to past dates only: the calendar's max lands on
// yesterday (local time), and any date typed or picked that is today or later
// is wiped immediately. This is enforced at the input level (not just at
// submit) so a future date can never be selected during account creation.
(function setDobLimit() {
    const dob = document.getElementById('reg-dob');
    if (!dob) return;

    const pad = n => String(n).padStart(2, '0');
    const isoDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const todayIso = () => {
        const d = new Date();
        return isoDate(d);
    };
    const yesterdayIso = () => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return isoDate(d);
    };

    // Keep the picker's max fresh in case the device clock changed mid-session.
    const refreshMax = () => { dob.max = yesterdayIso(); };

    // Wipe anything that resolves to today or a future day.
    const rejectFuture = () => {
        if (!dob.value) return;
        const picked = new Date(dob.value + 'T00:00:00');
        if (isNaN(picked.getTime())) return;
        if (dob.value >= todayIso()) {
            dob.value = '';
            if (typeof showToast === 'function') {
                showToast('Date of birth must be in the past', 'error');
            }
            refreshMax();
        }
    };

    refreshMax();
    dob.addEventListener('focus', refreshMax);
    dob.addEventListener('input', rejectFuture);
    dob.addEventListener('change', rejectFuture);
})();
