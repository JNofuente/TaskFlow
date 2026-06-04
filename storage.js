/**
 * storage.js
 * Handles all localStorage operations for TaskFlow.
 * Provides a clean API for reading/writing users and tasks.
 */

const Storage = (() => {
  const KEYS = {
    USERS: 'taskflow_users',
    SESSION: 'taskflow_session',
    THEME: 'taskflow_theme',
    TASK_ORDER: 'taskflow_order_',
  };

  // ─── User Storage ────────────────────────────────────────────────────────────

  /** Get all registered users object: { username: { passwordHash, createdAt } } */
  function getUsers() {
    return JSON.parse(localStorage.getItem(KEYS.USERS) || '{}');
  }

  /** Persist updated users object */
  function saveUsers(users) {
    localStorage.setItem(KEYS.USERS, JSON.stringify(users));
  }

  /** Check if a username already exists */
  function userExists(username) {
    return username.toLowerCase() in getUsers();
  }

  /** Register a new user */
  function registerUser(username, passwordHash) {
    const users = getUsers();
    users[username.toLowerCase()] = {
      username,
      passwordHash,
      createdAt: new Date().toISOString(),
    };
    saveUsers(users);
  }

  /** Retrieve a single user record */
  function getUser(username) {
    return getUsers()[username.toLowerCase()] || null;
  }

  // ─── Session Storage ──────────────────────────────────────────────────────────

  /** Save the current logged-in user to session */
  function setSession(username) {
    localStorage.setItem(KEYS.SESSION, JSON.stringify({ username, loginAt: new Date().toISOString() }));
  }

  /** Get the active session user, or null */
  function getSession() {
    return JSON.parse(localStorage.getItem(KEYS.SESSION) || 'null');
  }

  /** Clear the session (logout) */
  function clearSession() {
    localStorage.removeItem(KEYS.SESSION);
  }

  // ─── Task Storage ─────────────────────────────────────────────────────────────

  /** Get the localStorage key for a user's tasks */
  function taskKey(username) {
    return `taskflow_tasks_${username.toLowerCase()}`;
  }

  /** Get all tasks for a specific user */
  function getTasks(username) {
    return JSON.parse(localStorage.getItem(taskKey(username)) || '[]');
  }

  /** Persist the full tasks array for a user */
  function saveTasks(username, tasks) {
    localStorage.setItem(taskKey(username), JSON.stringify(tasks));
  }

  /** Get the task order array for drag-and-drop */
  function getTaskOrder(username) {
    return JSON.parse(localStorage.getItem(KEYS.TASK_ORDER + username.toLowerCase()) || '[]');
  }

  /** Save task order for a user */
  function saveTaskOrder(username, order) {
    localStorage.setItem(KEYS.TASK_ORDER + username.toLowerCase(), JSON.stringify(order));
  }

  // ─── Trash Storage ────────────────────────────────────────────────────────────

  /** Get the localStorage key for a user's trash */
  function trashKey(username) {
    return `taskflow_trash_${username.toLowerCase()}`;
  }

  /** Get all trashed tasks for a specific user */
  function getTrash(username) {
    return JSON.parse(localStorage.getItem(trashKey(username)) || '[]');
  }

  /** Persist the full trash array for a user */
  function saveTrash(username, tasks) {
    localStorage.setItem(trashKey(username), JSON.stringify(tasks));
  }

  /** Permanently wipe all trashed tasks for a user */
  function clearTrash(username) {
    localStorage.removeItem(trashKey(username));
  }

  // ─── Theme Storage ────────────────────────────────────────────────────────────

  function getTheme() {
    return localStorage.getItem(KEYS.THEME) || 'dark';
  }

  function setTheme(theme) {
    localStorage.setItem(KEYS.THEME, theme);
  }

  // ─── Public API ───────────────────────────────────────────────────────────────
  return {
    getUsers, saveUsers, userExists, registerUser, getUser,
    setSession, getSession, clearSession,
    getTasks, saveTasks,
    getTaskOrder, saveTaskOrder,
    getTrash, saveTrash, clearTrash,
    getTheme, setTheme,
  };
})();