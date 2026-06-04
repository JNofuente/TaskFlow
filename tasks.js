/**
 * tasks.js
 * Core task management: CRUD, filtering, sorting, drag-and-drop, search, export/import.
 * Includes Trash bin: soft-delete → recover or permanently destroy.
 */

const Tasks = (() => {

  // ─── State ────────────────────────────────────────────────────────────────────

  let currentUser   = null;
  let allTasks      = [];
  let trashedTasks  = [];        // soft-deleted tasks live here
  let activeFilter  = 'all';
  let activeSort    = 'dueDate';
  let searchQuery   = '';
  let editingTaskId = null;
  let dragSrcId     = null;
  let trashOpen     = false;     // whether the trash drawer is visible

  // ─── Init ─────────────────────────────────────────────────────────────────────

  function init() {
    Auth.requireAuth();
    const session = Storage.getSession();
    currentUser = session.username;

    document.querySelectorAll('.user-name').forEach(el => (el.textContent = currentUser));

    allTasks     = Storage.getTasks(currentUser);
    trashedTasks = Storage.getTrash(currentUser);

    const theme = Storage.getTheme();
    document.documentElement.setAttribute('data-theme', theme);
    updateThemeToggle(theme);

    bindEvents();
    renderStats();
    renderTasks();
    updateTrashBadge();
  }

  // ─── Event Binding ────────────────────────────────────────────────────────────

  function bindEvents() {
    document.getElementById('btn-logout').addEventListener('click', Auth.logout);
    document.getElementById('btn-theme').addEventListener('click', toggleTheme);

    // Task modal open/close
    document.getElementById('btn-new-task').addEventListener('click', openCreateModal);
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
      if (e.target === document.getElementById('modal-overlay')) closeModal();
    });
    document.getElementById('btn-cancel').addEventListener('click', closeModal);
    document.querySelector('.modal-close').addEventListener('click', closeModal);

    // Task form
    document.getElementById('task-form').addEventListener('submit', handleFormSubmit);

    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeFilter = btn.dataset.filter;
        renderTasks();
      });
    });

    // Sort
    document.getElementById('sort-select').addEventListener('change', (e) => {
      activeSort = e.target.value;
      renderTasks();
    });

    // Search
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', Utils.debounce((e) => {
      searchQuery = e.target.value.toLowerCase().trim();
      renderTasks();
    }, 250));
    document.getElementById('btn-clear-search').addEventListener('click', () => {
      searchInput.value = '';
      searchQuery = '';
      renderTasks();
    });

    // Export / Import
    document.getElementById('btn-export').addEventListener('click', exportTasks);
    document.getElementById('btn-import').addEventListener('click', () => document.getElementById('import-file').click());
    document.getElementById('import-file').addEventListener('change', importTasks);

    // ── Trash drawer ──
    document.getElementById('btn-open-trash').addEventListener('click', openTrash);
    document.getElementById('btn-close-trash').addEventListener('click', closeTrash);
    document.getElementById('trash-overlay').addEventListener('click', (e) => {
      if (e.target === document.getElementById('trash-overlay')) closeTrash();
    });
    document.getElementById('btn-empty-trash').addEventListener('click', confirmEmptyTrash);

    // Keyboard: Escape closes modals / trash
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeModal();
        closeTrash();
      }
    });
  }

  // ─── Task CRUD ────────────────────────────────────────────────────────────────

  function handleFormSubmit(e) {
    e.preventDefault();

    const title       = document.getElementById('task-title').value.trim();
    const description = document.getElementById('task-desc').value.trim();
    const dueDate     = document.getElementById('task-due').value;
    const priority    = document.getElementById('task-priority').value;

    if (!title) {
      Utils.showError('form-error', 'Task title is required.');
      return;
    }

    if (editingTaskId) {
      allTasks = allTasks.map(t =>
        t.id === editingTaskId
          ? { ...t, title, description, dueDate, priority, updatedAt: new Date().toISOString() }
          : t
      );
      showToast('Task updated successfully!', 'success');
    } else {
      const newTask = {
        id: Utils.generateId(),
        title, description, dueDate, priority,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      allTasks.unshift(newTask);
      showToast('Task created!', 'success');
    }

    persist();
    closeModal();
    renderStats();
    renderTasks();
  }

  /**
   * Soft-delete: move task to trash instead of erasing it.
   * Records deletedAt timestamp so we can show "deleted X ago".
   */
  function deleteTask(id) {
    const card = document.querySelector(`[data-id="${id}"]`);
    const task = allTasks.find(t => t.id === id);
    if (!task) return;

    if (card) card.classList.add('task-exit');

    setTimeout(() => {
      // Move to trash
      trashedTasks.unshift({ ...task, deletedAt: new Date().toISOString() });
      allTasks = allTasks.filter(t => t.id !== id);

      persist();
      persistTrash();
      renderStats();
      renderTasks();
      updateTrashBadge();

      // If trash drawer is open, refresh it live
      if (trashOpen) renderTrashItems();

      showToast('Task moved to Trash.', 'info', () => {
        // Undo action inside toast
        restoreTask(task.id, true);
      }, 'Undo');
    }, 300);
  }

  function toggleStatus(id) {
    allTasks = allTasks.map(t => {
      if (t.id === id) {
        const newStatus = t.status === 'completed' ? 'pending' : 'completed';
        return { ...t, status: newStatus, updatedAt: new Date().toISOString() };
      }
      return t;
    });
    persist();
    renderStats();
    renderTasks();
  }

  function openEditModal(id) {
    const task = allTasks.find(t => t.id === id);
    if (!task) return;

    editingTaskId = id;
    document.getElementById('modal-title').textContent = 'Edit Task';
    document.getElementById('btn-submit').textContent  = 'Save Changes';
    document.getElementById('task-title').value        = task.title;
    document.getElementById('task-desc').value         = task.description || '';
    document.getElementById('task-due').value          = task.dueDate || '';
    document.getElementById('task-priority').value     = task.priority;
    Utils.clearErrors('form-error');
    openModal();
  }

  // ─── Modal ────────────────────────────────────────────────────────────────────

  function openCreateModal() {
    editingTaskId = null;
    document.getElementById('modal-title').textContent = 'New Task';
    document.getElementById('btn-submit').textContent  = 'Create Task';
    document.getElementById('task-form').reset();
    document.getElementById('task-due').min = Utils.todayISO();
    Utils.clearErrors('form-error');
    openModal();
  }

  function openModal() {
    document.getElementById('modal-overlay').classList.add('active');
    setTimeout(() => document.getElementById('task-title').focus(), 100);
  }

  function closeModal() {
    document.getElementById('modal-overlay').classList.remove('active');
    editingTaskId = null;
  }

  // ─── Trash Drawer ─────────────────────────────────────────────────────────────

  function openTrash() {
    trashOpen = true;
    document.getElementById('trash-overlay').classList.add('active');
    renderTrashItems();
  }

  function closeTrash() {
    trashOpen = false;
    document.getElementById('trash-overlay').classList.remove('active');
  }

  /**
   * Restore a task from trash back to the active list.
   * @param {string} id  - task id
   * @param {boolean} silent - if true, skip toast (used by undo)
   */
  function restoreTask(id, silent = false) {
    const task = trashedTasks.find(t => t.id === id);
    if (!task) return;

    // Strip the deletedAt stamp and push back to front of active list
    const { deletedAt, ...restored } = task;
    allTasks.unshift({ ...restored, updatedAt: new Date().toISOString() });
    trashedTasks = trashedTasks.filter(t => t.id !== id);

    persist();
    persistTrash();
    renderStats();
    renderTasks();
    updateTrashBadge();
    if (trashOpen) renderTrashItems();
    if (!silent) showToast('Task restored!', 'success');
  }

  /** Permanently destroy a single trashed task — no recovery possible */
  function destroyTask(id) {
    const item = document.querySelector(`[data-trash-id="${id}"]`);
    if (item) {
      item.classList.add('trash-item-exit');
      setTimeout(() => {
        trashedTasks = trashedTasks.filter(t => t.id !== id);
        persistTrash();
        updateTrashBadge();
        renderTrashItems();
        showToast('Permanently deleted.', 'info');
      }, 280);
    } else {
      trashedTasks = trashedTasks.filter(t => t.id !== id);
      persistTrash();
      updateTrashBadge();
      renderTrashItems();
    }
  }

  /** Confirm before wiping the entire trash */
  function confirmEmptyTrash() {
    if (trashedTasks.length === 0) {
      showToast('Trash is already empty.', 'info');
      return;
    }

    const overlay = document.getElementById('confirm-overlay');
    document.getElementById('confirm-task-title').textContent = `all ${trashedTasks.length} trashed task(s)`;
    overlay.classList.add('active');

    document.getElementById('btn-confirm-delete').onclick = () => {
      overlay.classList.remove('active');
      trashedTasks = [];
      persistTrash();
      updateTrashBadge();
      renderTrashItems();
      showToast('Trash emptied.', 'info');
    };
    document.getElementById('btn-confirm-cancel').onclick = () => {
      overlay.classList.remove('active');
    };
  }

  /** Render the list of trashed task cards inside the drawer */
  function renderTrashItems() {
    const list      = document.getElementById('trash-list');
    const emptyMsg  = document.getElementById('trash-empty');
    const emptyBtn  = document.getElementById('btn-empty-trash');

    list.innerHTML = '';

    if (trashedTasks.length === 0) {
      emptyMsg.style.display = 'flex';
      list.style.display     = 'none';
      emptyBtn.disabled      = true;
      emptyBtn.style.opacity = '0.4';
      return;
    }

    emptyMsg.style.display = 'none';
    list.style.display     = 'flex';
    emptyBtn.disabled      = false;
    emptyBtn.style.opacity = '1';

    trashedTasks.forEach((task, idx) => {
      const item = document.createElement('div');
      item.className = 'trash-item';
      item.setAttribute('data-trash-id', task.id);
      item.style.animationDelay = `${idx * 35}ms`;

      const deletedAgo = timeAgo(task.deletedAt);

      item.innerHTML = `
        <div class="trash-item-accent priority-${task.priority}"></div>
        <div class="trash-item-body">
          <div class="trash-item-header">
            <div class="trash-item-meta">
              <span class="priority-badge priority-${task.priority}">${task.priority}</span>
              ${task.dueDate ? `<span class="due-date">${Utils.formatDate(task.dueDate)}</span>` : ''}
            </div>
            <span class="trash-deleted-ago">${deletedAgo}</span>
          </div>
          <h4 class="trash-item-title">${Utils.escapeHtml(task.title)}</h4>
          ${task.description ? `<p class="trash-item-desc">${Utils.escapeHtml(task.description)}</p>` : ''}
          <div class="trash-item-actions">
            <button class="btn-restore" onclick="Tasks.restoreTask('${task.id}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                <path d="M3 3v5h5"/>
              </svg>
              Restore
            </button>
            <button class="btn-destroy" onclick="Tasks.destroyTask('${task.id}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
              Delete Forever
            </button>
          </div>
        </div>
      `;

      list.appendChild(item);
    });
  }

  /** Show the trash count badge on the sidebar button */
  function updateTrashBadge() {
    const badge = document.getElementById('trash-badge');
    if (!badge) return;
    badge.textContent = trashedTasks.length;
    badge.style.display = trashedTasks.length > 0 ? 'inline-flex' : 'none';
  }

  /** Human-readable "X minutes ago" string */
  function timeAgo(isoString) {
    if (!isoString) return '';
    const diff = Date.now() - new Date(isoString).getTime();
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days  = Math.floor(diff / 86400000);
    if (mins  < 1)  return 'just now';
    if (mins  < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  }

  // ─── Filtering & Sorting ──────────────────────────────────────────────────────

  function getFilteredSortedTasks() {
    let tasks = [...allTasks];

    switch (activeFilter) {
      case 'completed': tasks = tasks.filter(t => t.status === 'completed'); break;
      case 'pending':   tasks = tasks.filter(t => t.status === 'pending');   break;
      case 'high':      tasks = tasks.filter(t => t.priority === 'high');    break;
      case 'overdue':
        tasks = tasks.filter(t => t.status === 'pending' && Utils.isOverdue(t.dueDate));
        break;
    }

    if (searchQuery) {
      tasks = tasks.filter(t =>
        t.title.toLowerCase().includes(searchQuery) ||
        (t.description || '').toLowerCase().includes(searchQuery)
      );
    }

    switch (activeSort) {
      case 'dueDate':
        tasks.sort((a, b) => {
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate) - new Date(b.dueDate);
        });
        break;
      case 'priority':
        tasks.sort((a, b) => Utils.priorityWeight(b.priority) - Utils.priorityWeight(a.priority));
        break;
      case 'createdAt':
        tasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        break;
      case 'title':
        tasks.sort((a, b) => a.title.localeCompare(b.title));
        break;
    }

    return tasks;
  }

  // ─── Rendering ────────────────────────────────────────────────────────────────

  function renderTasks() {
    const list       = document.getElementById('task-list');
    const emptyState = document.getElementById('empty-state');
    const tasks      = getFilteredSortedTasks();

    list.innerHTML = '';

    if (tasks.length === 0) {
      emptyState.style.display = 'flex';
      list.style.display       = 'none';
      updateEmptyMessage();
      return;
    }

    emptyState.style.display = 'none';
    list.style.display       = 'grid';

    tasks.forEach((task, index) => {
      const card = createTaskCard(task);
      card.style.animationDelay = `${index * 40}ms`;
      list.appendChild(card);
    });
  }

  function createTaskCard(task) {
    const isOverdue = task.status === 'pending' && Utils.isOverdue(task.dueDate);
    const days = Utils.daysUntilDue(task.dueDate);

    let dueBadge = '';
    if (task.dueDate) {
      if (task.status === 'completed') {
        dueBadge = `<span class="due-badge done">✓ Done</span>`;
      } else if (isOverdue) {
        dueBadge = `<span class="due-badge overdue">⚠ Overdue</span>`;
      } else if (days === 0) {
        dueBadge = `<span class="due-badge today">Today</span>`;
      } else if (days === 1) {
        dueBadge = `<span class="due-badge soon">Tomorrow</span>`;
      } else if (days <= 3) {
        dueBadge = `<span class="due-badge soon">${days}d left</span>`;
      }
    }

    const card = document.createElement('div');
    card.className = `task-card priority-${task.priority} ${task.status === 'completed' ? 'completed' : ''} task-enter`;
    card.setAttribute('data-id', task.id);
    card.setAttribute('draggable', 'true');

    card.innerHTML = `
      <div class="task-card-accent"></div>
      <div class="task-card-body">
        <div class="task-card-header">
          <div class="task-check-wrap">
            <button class="task-check ${task.status === 'completed' ? 'checked' : ''}"
                    onclick="Tasks.toggleStatus('${task.id}')"
                    title="${task.status === 'completed' ? 'Mark Pending' : 'Mark Complete'}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </button>
          </div>
          <div class="task-title-wrap">
            <h3 class="task-title">${Utils.escapeHtml(task.title)}</h3>
            <div class="task-meta">
              <span class="priority-badge priority-${task.priority}">${task.priority}</span>
              ${task.dueDate ? `<span class="due-date">${Utils.formatDate(task.dueDate)}</span>` : ''}
              ${dueBadge}
            </div>
          </div>
          <div class="task-actions">
            <button class="task-btn edit-btn" onclick="Tasks.openEditModal('${task.id}')" title="Edit">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="task-btn delete-btn" onclick="Tasks.confirmDelete('${task.id}')" title="Move to Trash">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
            </button>
            <div class="drag-handle" title="Drag to reorder">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
                <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
                <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
              </svg>
            </div>
          </div>
        </div>
        ${task.description ? `<p class="task-description">${Utils.escapeHtml(task.description)}</p>` : ''}
      </div>
    `;

    card.addEventListener('dragstart', onDragStart);
    card.addEventListener('dragover',  onDragOver);
    card.addEventListener('dragleave', onDragLeave);
    card.addEventListener('drop',      onDrop);
    card.addEventListener('dragend',   onDragEnd);

    return card;
  }

  function renderStats() {
    const total     = allTasks.length;
    const completed = allTasks.filter(t => t.status === 'completed').length;
    const pending   = total - completed;
    const overdue   = allTasks.filter(t => t.status === 'pending' && Utils.isOverdue(t.dueDate)).length;
    const pct       = total === 0 ? 0 : Math.round((completed / total) * 100);

    document.getElementById('stat-total').textContent         = total;
    document.getElementById('stat-completed').textContent     = completed;
    document.getElementById('stat-pending').textContent       = pending;
    document.getElementById('stat-overdue').textContent       = overdue;
    document.getElementById('progress-bar-fill').style.width  = `${pct}%`;
    document.getElementById('progress-label').textContent     = `${pct}% complete`;
  }

  function updateEmptyMessage() {
    const msg = document.getElementById('empty-message');
    if (!msg) return;
    if (searchQuery)              msg.textContent = `No tasks match "${searchQuery}"`;
    else if (activeFilter === 'completed') msg.textContent = 'No completed tasks yet.';
    else if (activeFilter === 'pending')   msg.textContent = 'No pending tasks. Great work!';
    else if (activeFilter === 'high')      msg.textContent = 'No high priority tasks.';
    else if (activeFilter === 'overdue')   msg.textContent = 'No overdue tasks. You\'re on track!';
    else                                   msg.textContent = 'No tasks yet. Create your first task!';
  }

  // ─── Drag & Drop ──────────────────────────────────────────────────────────────

  function onDragStart(e) {
    dragSrcId = this.dataset.id;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  }

  function onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    this.classList.add('drag-over');
  }

  function onDragLeave() { this.classList.remove('drag-over'); }

  function onDrop(e) {
    e.preventDefault();
    this.classList.remove('drag-over');
    const dropId = this.dataset.id;
    if (dragSrcId === dropId) return;

    const srcIdx = allTasks.findIndex(t => t.id === dragSrcId);
    const dstIdx = allTasks.findIndex(t => t.id === dropId);
    if (srcIdx < 0 || dstIdx < 0) return;

    const [moved] = allTasks.splice(srcIdx, 1);
    allTasks.splice(dstIdx, 0, moved);
    persist();
    renderTasks();
  }

  function onDragEnd() {
    document.querySelectorAll('.task-card').forEach(c => c.classList.remove('dragging', 'drag-over'));
  }

  // ─── Delete Confirmation (move to trash) ─────────────────────────────────────

  function confirmDelete(id) {
    const task = allTasks.find(t => t.id === id);
    if (!task) return;

    const overlay = document.getElementById('confirm-overlay');
    document.getElementById('confirm-task-title').textContent = `"${task.title}"`;
    overlay.classList.add('active');

    document.getElementById('btn-confirm-delete').onclick = () => {
      overlay.classList.remove('active');
      deleteTask(id);
    };
    document.getElementById('btn-confirm-cancel').onclick = () => {
      overlay.classList.remove('active');
    };
  }

  // ─── Theme ────────────────────────────────────────────────────────────────────

  function toggleTheme() {
    const current = Storage.getTheme();
    const next    = current === 'dark' ? 'light' : 'dark';
    Storage.setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    updateThemeToggle(next);
  }

  function updateThemeToggle(theme) {
    const btn = document.getElementById('btn-theme');
    if (!btn) return;
    btn.title = theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode';
    btn.innerHTML = theme === 'dark'
      ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
  }

  // ─── Export / Import ──────────────────────────────────────────────────────────

  function exportTasks() {
    if (allTasks.length === 0) { showToast('No tasks to export.', 'info'); return; }
    const data = { user: currentUser, exportedAt: new Date().toISOString(), tasks: allTasks };
    Utils.downloadJSON(data, `taskflow_${currentUser}_${Utils.todayISO()}.json`);
    showToast('Tasks exported!', 'success');
  }

  function importTasks(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = JSON.parse(evt.target.result);
        if (!Array.isArray(data.tasks)) throw new Error('Invalid format');
        const imported = data.tasks.map(t => ({
          ...t,
          id: Utils.generateId(),
          importedAt: new Date().toISOString(),
        }));
        allTasks = [...allTasks, ...imported];
        persist();
        renderStats();
        renderTasks();
        showToast(`Imported ${imported.length} task(s)!`, 'success');
      } catch {
        showToast('Invalid file format.', 'error');
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  }

  // ─── Persist ─────────────────────────────────────────────────────────────────

  function persist()      { Storage.saveTasks(currentUser, allTasks); }
  function persistTrash() { Storage.saveTrash(currentUser, trashedTasks); }

  // ─── Toast (with optional action button) ─────────────────────────────────────

  function showToast(message, type = 'info', actionFn = null, actionLabel = '') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const actionHTML = actionFn
      ? `<button class="toast-action" onclick="(${actionFn.toString()})(); this.closest('.toast').remove();">${Utils.escapeHtml(actionLabel)}</button>`
      : '';

    toast.innerHTML = `
      <span>${Utils.escapeHtml(message)}</span>
      ${actionHTML}
      <button class="toast-dismiss" onclick="this.parentElement.remove()">✕</button>
    `;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 400);
    }, 4500);
  }

  // ─── Public API ───────────────────────────────────────────────────────────────
  return { init, toggleStatus, openEditModal, confirmDelete, restoreTask, destroyTask };
})();