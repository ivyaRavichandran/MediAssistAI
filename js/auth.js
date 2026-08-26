// ===== Authentication Module (Firebase Auth) =====

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

    if (password.length < 6) {
        showToast('Password must be at least 6 characters', 'error');
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
