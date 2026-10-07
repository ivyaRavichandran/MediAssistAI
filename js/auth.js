// ===== Authentication Module (Firebase Auth) =====

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
        await auth.signInWithEmailAndPassword(email, password);
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

    // Date of birth must be a real past date (future dates are not allowed).
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

    try {
        const cred = await auth.createUserWithEmailAndPassword(email, password);
        await FB.saveUser({ name, email, phone, dob });
        showToast(`Welcome to MediAssist AI, ${name}!`);
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
