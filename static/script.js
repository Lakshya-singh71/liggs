/**
 * Liggs — Frontend Application Logic
 * Handles: UFO intro, auth, notes CRUD, autosave, search, export
 */

// ─── State ───────────────────────────────────────────────────────────────────
let currentNoteId = null;
let isDirty = false;
let autoSaveTimer = null;

// ─── Intro Animation ─────────────────────────────────────────────────────────
function generateStars() {
  const container = document.getElementById('stars');
  for (let i = 0; i < 180; i++) {
    const star = document.createElement('div');
    star.className = 'star';
    const size = Math.random() * 2.5 + 0.5;
    star.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      left: ${Math.random() * 100}%;
      top: ${Math.random() * 100}%;
      --dur: ${2 + Math.random() * 4}s;
      --delay: ${-Math.random() * 5}s;
      opacity: ${0.1 + Math.random() * 0.5};
    `;
    container.appendChild(star);
  }
}

function initIntro() {
  generateStars();
  // After intro animation completes, show the main app or auth
  setTimeout(() => {
    const introScreen = document.getElementById('intro-screen');
    introScreen.style.display = 'none';
    checkAuthAndShow();
  }, 4900); // matches CSS animation end
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
async function checkAuthAndShow() {
  const res = await fetch('/api/me');
  const data = await res.json();
  if (data.authenticated) {
    showApp(data.username);
  } else {
    showAuth();
  }
}

function showAuth() {
  document.getElementById('authModal').classList.remove('hidden');
}

function showApp(username) {
  document.getElementById('authModal').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('usernameDisplay').textContent = username;
  loadNotes();
}

function switchTab(tab) {
  document.getElementById('loginForm').classList.toggle('hidden', tab !== 'login');
  document.getElementById('registerForm').classList.toggle('hidden', tab !== 'register');
  document.getElementById('loginTab').classList.toggle('active', tab === 'login');
  document.getElementById('registerTab').classList.toggle('active', tab === 'register');
  clearAuthError();
}

function showAuthError(msg) {
  const el = document.getElementById('authError');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function clearAuthError() {
  document.getElementById('authError').classList.add('hidden');
}

async function doLogin() {
  clearAuthError();
  const username = document.getElementById('loginUser').value.trim();
  const password = document.getElementById('loginPass').value;
  if (!username || !password) return showAuthError('Please fill in all fields.');
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();
  if (res.ok) {
    showApp(data.username);
  } else {
    showAuthError(data.error || 'Login failed');
  }
}

async function doRegister() {
  clearAuthError();
  const username = document.getElementById('regUser').value.trim();
  const password = document.getElementById('regPass').value;
  if (!username || !password) return showAuthError('Please fill in all fields.');
  const res = await fetch('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();
  if (res.ok) {
    showApp(data.username);
  } else {
    showAuthError(data.error || 'Registration failed');
  }
}

async function doLogout() {
  await fetch('/api/logout', { method: 'POST' });
  currentNoteId = null;
  isDirty = false;
  document.getElementById('app').classList.add('hidden');
  document.getElementById('notesList').innerHTML = '';
  showEmptyState();
  showAuth();
}

// ─── Notes List ───────────────────────────────────────────────────────────────
async function loadNotes(query = '') {
  const url = query ? `/api/notes?q=${encodeURIComponent(query)}` : '/api/notes';
  const res = await fetch(url);
  if (!res.ok) return;
  const notes = await res.json();
  renderNotesList(notes);
}

function renderNotesList(notes) {
  const list = document.getElementById('notesList');
  if (!notes.length) {
    list.innerHTML = '<div class="notes-empty">No notes yet.<br/>Create your first note ↑</div>';
    return;
  }
  list.innerHTML = notes.map(n => `
    <div class="note-item ${n.id === currentNoteId ? 'active' : ''}"
         onclick="openNote(${n.id})" id="note-item-${n.id}">
      <div class="note-item-title">${escapeHtml(n.title || 'Untitled')}</div>
      <div class="note-item-preview">${escapeHtml(n.preview || '')}</div>
      <div class="note-item-date">${formatDate(n.updated_at)}</div>
    </div>
  `).join('');
}

// ─── Open / Create Note ───────────────────────────────────────────────────────
async function openNote(id) {
  if (isDirty && currentNoteId) await saveNote(true);
  const res = await fetch(`/api/notes/${id}`);
  if (!res.ok) return;
  const note = await res.json();
  currentNoteId = id;
  document.getElementById('noteTitle').value = note.title || '';
  document.getElementById('noteContent').value = note.content || '';
  document.getElementById('noteMeta').textContent =
    `Created: ${formatDate(note.created_at)} · Updated: ${formatDate(note.updated_at)}`;
  showEditor();
  updateActiveItem(id);
  markClean();
}

async function newNote() {
  if (isDirty && currentNoteId) await saveNote(true);
  const res = await fetch('/api/notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Untitled', content: '' })
  });
  const note = await res.json();
  currentNoteId = note.id;
  document.getElementById('noteTitle').value = '';
  document.getElementById('noteContent').value = '';
  document.getElementById('noteMeta').textContent = `Created: just now`;
  showEditor();
  await loadNotes();
  updateActiveItem(note.id);
  document.getElementById('noteTitle').focus();
  markClean();
}

// ─── Save / Delete ────────────────────────────────────────────────────────────
async function saveNote(silent = false) {
  if (!currentNoteId) return;
  const title = document.getElementById('noteTitle').value || 'Untitled';
  const content = document.getElementById('noteContent').value;
  const res = await fetch(`/api/notes/${currentNoteId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, content })
  });
  if (res.ok) {
    const note = await res.json();
    document.getElementById('noteMeta').textContent =
      `Created: ${formatDate(note.created_at)} · Updated: ${formatDate(note.updated_at)}`;
    markClean();
    if (!silent) await loadNotes();
    else {
      // update sidebar item without full reload
      const item = document.getElementById(`note-item-${currentNoteId}`);
      if (item) {
        item.querySelector('.note-item-title').textContent = title;
        item.querySelector('.note-item-date').textContent = formatDate(note.updated_at);
      }
    }
  }
}

async function deleteNote() {
  if (!currentNoteId) return;
  if (!confirm('Delete this note permanently?')) return;
  await fetch(`/api/notes/${currentNoteId}`, { method: 'DELETE' });
  currentNoteId = null;
  isDirty = false;
  showEmptyState();
  await loadNotes();
}

// ─── Export ───────────────────────────────────────────────────────────────────
function exportNote() {
  if (!currentNoteId) return;
  window.location.href = `/api/notes/${currentNoteId}/export`;
}

// ─── Search ───────────────────────────────────────────────────────────────────
let searchDebounce = null;
function searchNotes() {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    const q = document.getElementById('searchInput').value;
    loadNotes(q);
  }, 300);
}

// ─── Dirty / Autosave ─────────────────────────────────────────────────────────
function markDirty() {
  isDirty = true;
  document.getElementById('saveStatus').textContent = '● unsaved';
  document.getElementById('saveStatus').className = 'save-status dirty';
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    if (isDirty) saveNote(true);
  }, 2000); // autosave after 2s of inactivity
}

function markClean() {
  isDirty = false;
  document.getElementById('saveStatus').textContent = '● saved';
  document.getElementById('saveStatus').className = 'save-status';
}

// ─── UI Helpers ───────────────────────────────────────────────────────────────
function showEditor() {
  document.getElementById('emptyState').classList.add('hidden');
  document.getElementById('noteEditor').classList.remove('hidden');
}

function showEmptyState() {
  document.getElementById('emptyState').classList.remove('hidden');
  document.getElementById('noteEditor').classList.add('hidden');
}

function updateActiveItem(id) {
  document.querySelectorAll('.note-item').forEach(el => el.classList.remove('active'));
  const item = document.getElementById(`note-item-${id}`);
  if (item) item.classList.add('active');
}

function formatDate(dtStr) {
  if (!dtStr) return '';
  const d = new Date(dtStr.replace(' ', 'T'));
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// ─── Keyboard Shortcuts ───────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    saveNote();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
    e.preventDefault();
    newNote();
  }
});

// ─── Allow Enter key in auth forms ────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    if (document.activeElement.closest('#loginForm')) doLogin();
    if (document.activeElement.closest('#registerForm')) doRegister();
  }
});

// ─── Boot ─────────────────────────────────────────────────────────────────────
initIntro();