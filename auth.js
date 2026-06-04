/**
 * auth.js
 * Handles user registration, login, and session management for TaskFlow.
 */

const Auth = (() => {

  // ─── Tab Switching ────────────────────────────────────────────────────────────

  function initTabs() {
    const tabs = document.querySelectorAll('.auth-tab');
    const panels = document.querySelectorAll('.auth-panel');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.tab;

        tabs.forEach(t => t.classList.remove('active'));
        panels.forEach(p => p.classList.remove('active'));

        tab.classList.add('active');
        document.getElementById(`panel-${target}`).classList.add('active');

        // Clear errors when switching tabs
        Utils.clearErrors('login-error', 'signup-error');
      });
    });
  }

  // ─── Login ────────────────────────────────────────────────────────────────────

  function handleLogin(e) {
    e.preventDefault();
    Utils.clearErrors('login-error');

    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;

    if (!username || !password) {
      Utils.showError('login-error', 'Please enter your username and password.');
      return;
    }

    const user = Storage.getUser(username);
    if (!user || user.passwordHash !== Utils.hashPassword(password)) {
      Utils.showError('login-error', 'Invalid username or password.');
      shakeForm('login-form');
      return;
    }

    // Successful login
    Storage.setSession(user.username);
    window.location.href = 'dashboard.html';
  }

  // ─── Sign Up ──────────────────────────────────────────────────────────────────

  function handleSignup(e) {
    e.preventDefault();
    Utils.clearErrors('signup-error');

    const username = document.getElementById('signup-username').value.trim();
    const password = document.getElementById('signup-password').value;
    const confirm = document.getElementById('signup-confirm').value;

    // Validate username
    const usernameErr = Utils.validateUsername(username);
    if (usernameErr) {
      Utils.showError('signup-error', usernameErr);
      return;
    }

    // Validate password
    const passwordErr = Utils.validatePassword(password);
    if (passwordErr) {
      Utils.showError('signup-error', passwordErr);
      return;
    }

    // Confirm match
    if (password !== confirm) {
      Utils.showError('signup-error', 'Passwords do not match.');
      return;
    }

    // Check duplicate username
    if (Storage.userExists(username)) {
      Utils.showError('signup-error', 'Username already taken. Please choose another.');
      shakeForm('signup-form');
      return;
    }

    // Register user
    Storage.registerUser(username, Utils.hashPassword(password));
    Storage.setSession(username);
    window.location.href = 'dashboard.html';
  }

  // ─── Session Guard ────────────────────────────────────────────────────────────

  /** If already logged in, skip the auth page */
  function redirectIfLoggedIn() {
    if (Storage.getSession()) {
      window.location.href = 'dashboard.html';
    }
  }

  /** If NOT logged in, redirect to auth page */
  function requireAuth() {
    if (!Storage.getSession()) {
      window.location.href = 'index.html';
    }
  }

  // ─── Logout ───────────────────────────────────────────────────────────────────

  function logout() {
    Storage.clearSession();
    window.location.href = 'index.html';
  }

  // ─── UI Helpers ───────────────────────────────────────────────────────────────

  function shakeForm(formId) {
    const form = document.getElementById(formId);
    if (form) Utils.animateElement(form, 'shake', 500);
  }

  function togglePasswordVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    if (input.type === 'password') {
      input.type = 'text';
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
    } else {
      input.type = 'password';
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
    }
  }

  // ─── Init ─────────────────────────────────────────────────────────────────────

  function init() {
    redirectIfLoggedIn();
    initTabs();

    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');

    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    if (signupForm) signupForm.addEventListener('submit', handleSignup);

    // Password toggles
    document.querySelectorAll('.toggle-password').forEach(btn => {
      btn.addEventListener('click', () => {
        togglePasswordVisibility(btn.dataset.target, btn);
      });
    });

    // Apply saved theme
    const theme = Storage.getTheme();
    document.documentElement.setAttribute('data-theme', theme);
  }

  // ─── Public API ───────────────────────────────────────────────────────────────
  return { init, logout, requireAuth };
})();
