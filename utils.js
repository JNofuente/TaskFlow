/**
 * utils.js
 * Shared utility/helper functions for TaskFlow.
 */

const Utils = (() => {

  // ─── ID Generation ────────────────────────────────────────────────────────────

  /** Generate a unique ID using timestamp + random suffix */
  function generateId() {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ─── Password Hashing (simple, client-side only) ──────────────────────────────

  /** Simple djb2-style hash — NOT production-secure, fine for this demo */
  function hashPassword(password) {
    let hash = 5381;
    for (let i = 0; i < password.length; i++) {
      hash = (hash * 33) ^ password.charCodeAt(i);
    }
    return (hash >>> 0).toString(16);
  }

  // ─── Date Helpers ─────────────────────────────────────────────────────────────

  /** Format ISO date string to "Jan 15, 2025" */
  function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  /** Return true if date is in the past (overdue) */
  function isOverdue(dateStr) {
    if (!dateStr) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dateStr + 'T00:00:00');
    return due < today;
  }

  /** Days until due date (negative = overdue) */
  function daysUntilDue(dateStr) {
    if (!dateStr) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dateStr + 'T00:00:00');
    return Math.round((due - today) / (1000 * 60 * 60 * 24));
  }

  /** Get today's date as YYYY-MM-DD (for min attribute in date inputs) */
  function todayISO() {
    return new Date().toISOString().split('T')[0];
  }

  // ─── Validation ───────────────────────────────────────────────────────────────

  /** Validate username: 3-20 chars, alphanumeric + underscore */
  function validateUsername(username) {
    if (!username || username.trim().length < 3) return 'Username must be at least 3 characters.';
    if (username.trim().length > 20) return 'Username must be 20 characters or fewer.';
    if (!/^[a-zA-Z0-9_]+$/.test(username.trim())) return 'Username can only contain letters, numbers, and underscores.';
    return null;
  }

  /** Validate password: min 6 chars */
  function validatePassword(password) {
    if (!password || password.length < 6) return 'Password must be at least 6 characters.';
    return null;
  }

  // ─── DOM Helpers ──────────────────────────────────────────────────────────────

  /** Show an error message in an element by ID */
  function showError(elementId, message) {
    const el = document.getElementById(elementId);
    if (el) {
      el.textContent = message;
      el.style.display = message ? 'block' : 'none';
    }
  }

  /** Clear all error messages */
  function clearErrors(...elementIds) {
    elementIds.forEach(id => showError(id, ''));
  }

  /** Animate an element by temporarily adding a CSS class */
  function animateElement(el, className, duration = 600) {
    el.classList.add(className);
    setTimeout(() => el.classList.remove(className), duration);
  }

  /** Escape HTML to prevent XSS */
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str || ''));
    return div.innerHTML;
  }

  /** Debounce a function */
  function debounce(fn, delay = 300) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  // ─── Priority Helpers ─────────────────────────────────────────────────────────

  const PRIORITY_WEIGHT = { high: 3, medium: 2, low: 1 };

  function priorityWeight(priority) {
    return PRIORITY_WEIGHT[priority] || 0;
  }

  // ─── Export / Import ─────────────────────────────────────────────────────────

  /** Trigger a browser download of a JSON blob */
  function downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ─── Public API ───────────────────────────────────────────────────────────────
  return {
    generateId, hashPassword,
    formatDate, isOverdue, daysUntilDue, todayISO,
    validateUsername, validatePassword,
    showError, clearErrors, animateElement, escapeHtml, debounce,
    priorityWeight, downloadJSON,
  };
})();
