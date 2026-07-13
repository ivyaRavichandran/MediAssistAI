// ===== Authentication Module =====

function showLogin() {
    document.getElementById('login-form').classList.remove('hidden');
    document.getElementById('register-form').classList.add('hidden');
}

function showRegister() {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('register-form').classList.remove('hidden');
}

function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    // Demo login / local auth
    const users = JSON.parse(localStorage.getItem('mediassist_users') || '[]');
    const user = users.find(u => u.email === email && u.password === password);

    if (user) {
        App.currentUser = user;
        localStorage.setItem('mediassist_user', JSON.stringify(user));
        App.showApp();
        showToast(`Welcome back, ${user.name}!`);
    } else {
        // Allow demo login with any credentials
        if (email && password) {
            const demoUser = {
                id: generateId(),
                name: email.split('@')[0],
                email: email,
                phone: '',
                dob: ''
            };
            App.currentUser = demoUser;
            localStorage.setItem('mediassist_user', JSON.stringify(demoUser));

            // Save to users list
            users.push({ ...demoUser, password });
            localStorage.setItem('mediassist_users', JSON.stringify(users));

            App.showApp();
            showToast(`Welcome, ${demoUser.name}!`);
        } else {
            showToast('Invalid credentials', 'error');
        }
    }
}

function handleRegister(e) {
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

    const users = JSON.parse(localStorage.getItem('mediassist_users') || '[]');

    if (users.find(u => u.email === email)) {
        showToast('Email already registered', 'error');
        return;
    }

    const newUser = {
        id: generateId(),
        name,
        email,
        phone,
        dob,
        password
    };

    users.push(newUser);
    localStorage.setItem('mediassist_users', JSON.stringify(users));

    const { password: _, ...userWithoutPassword } = newUser;
    App.currentUser = userWithoutPassword;
    localStorage.setItem('mediassist_user', JSON.stringify(userWithoutPassword));

    App.showApp();
    showToast(`Welcome to MediAssist AI, ${name}!`);
}

function handleLogout() {
    App.currentUser = null;
    localStorage.removeItem('mediassist_user');
    App.showAuth();
    showToast('Logged out successfully');
}

// Sidebar toggle for mobile
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

// Close sidebar when clicking outside on mobile
document.addEventListener('click', (e) => {
    const sidebar = document.getElementById('sidebar');
    const menuToggle = document.querySelector('.menu-toggle');

    if (sidebar && sidebar.classList.contains('open') &&
        !sidebar.contains(e.target) && !menuToggle?.contains(e.target)) {
        sidebar.classList.remove('open');
    }
});
