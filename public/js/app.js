const state = { user: null, posts: [], favorites: new Set(), page: 1, pages: 1, search: '', tag: '', showingFavorites: false };
const $ = (selector) => document.querySelector(selector);
const api = async (url, options = {}) => {
  const response = await fetch(url, { credentials: 'include', headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Something went wrong.');
  return data;
};
const showModal = (id) => $(`#${id}`).classList.remove('hidden');
const closeModals = () => document.querySelectorAll('.modal').forEach((modal) => modal.classList.add('hidden'));
const formatDate = (date) => new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(date));
const message = (id, text, isError = true) => { const element = $(`#${id}`); element.textContent = text; element.style.color = isError ? 'var(--coral)' : 'var(--ink)'; };

async function loadSession() {
  try {
    const data = await api('/api/auth/me');
    state.user = data.user;
    const favorites = await api('/api/posts/favorites');
    state.favorites = new Set((favorites.posts || []).map((post) => post._id));
  } catch {
    state.user = null;
    state.favorites.clear();
  }
  updateAccountUI();
}

function showSignInPrompt() {
  state.posts = [];
  state.showingFavorites = false;
  $('#tag-bar').innerHTML = '';
  $('#tag-bar').classList.add('hidden');
  $('#search-form').classList.add('hidden');
  $('#pagination').classList.add('hidden');
  $('#news-grid').innerHTML = '';
  $('#feed-status').classList.add('hidden');
  $('#access-panel').classList.remove('hidden');
}

function updateAccountUI() {
  const signedIn = Boolean(state.user);
  $('#auth-button').textContent = signedIn ? (state.user.role === 'admin' ? 'Admin desk' : 'My account') : 'Sign in';
  $('#favorites-button').classList.toggle('hidden', !signedIn);
  $('#account-button').classList.toggle('hidden', !signedIn || state.user.role === 'admin');
  $('#favorites-count').textContent = state.favorites.size;
  $('#account-button').textContent = state.user?.name || '';
  $('#search-form').classList.toggle('hidden', !signedIn);
  $('#tag-bar').classList.toggle('hidden', !signedIn);
  $('#access-panel').classList.toggle('hidden', signedIn);
  if (signedIn) renderPosts();
  else showSignInPrompt();
}

async function loadPosts() {
  if (!state.user) {
    showSignInPrompt();
    return;
  }
  $('#search-form').classList.remove('hidden');
  $('#tag-bar').classList.remove('hidden');
  $('#access-panel').classList.add('hidden');
  state.showingFavorites = false;
  $('#feed-status').textContent = 'Loading the latest stories...';
  try {
    const params = new URLSearchParams({ page: state.page, limit: 12 });
    if (state.search) params.set('search', state.search);
    if (state.tag) params.set('tag', state.tag);
    const data = await api(`/api/posts/getPosts?${params}`);
    state.posts = data.posts || [];
    state.pages = data.pagination?.pages || 1;
    renderTags();
    renderPosts();
    $('#pagination').classList.toggle('hidden', state.pages < 2);
    $('#page-label').textContent = `${state.page} / ${state.pages}`;
    $('#previous-page').disabled = state.page <= 1;
    $('#next-page').disabled = state.page >= state.pages;
  } catch (error) {
    $('#feed-status').textContent = error.message;
  }
}

async function loadFavorites() {
  if (!state.user) { showModal('auth-modal'); return; }
  try {
    const data = await api('/api/posts/favorites');
    state.posts = data.posts || [];
    state.showingFavorites = true;
    state.pages = 1;
    $('#tag-bar').innerHTML = '';
    $('#pagination').classList.add('hidden');
    renderPosts();
  } catch (error) {
    $('#feed-status').textContent = error.message;
  }
}

function renderTags() {
  const tags = [...new Set(state.posts.flatMap((post) => post.tag || []))].slice(0, 10);
  $('#tag-bar').innerHTML = ['all', ...tags].map((tag) => `<button class="tag-button ${state.tag === (tag === 'all' ? '' : tag) ? 'active' : ''}" data-tag="${tag === 'all' ? '' : tag}">${tag === 'all' ? 'All stories' : `#${tag}`}</button>`).join('');
}

function renderPosts() {
  const grid = $('#news-grid');
  $('#feed-status').classList.toggle('hidden', state.posts.length > 0);
  if (!state.posts.length) { grid.innerHTML = ''; return; }
  grid.innerHTML = state.posts.map((post) => {
    const favorite = state.favorites.has(post._id);
    const adminTools = state.user?.role === 'admin' ? `<span class="admin-tools"><button class="mini-button" data-edit="${post._id}">Edit</button><button class="mini-button" data-delete="${post._id}">Delete</button></span>` : '';
    return `<article class="news-card">
      <div class="card-meta"><span class="mono-label source">${escapeHtml(post.source || 'DevNews')}</span><span class="mono-label">${formatDate(post.createdAt)}</span></div>
      <h3>${escapeHtml(post.title)}</h3>
      <div class="card-footer"><div class="card-buttons"><a class="read-link" href="${safeUrl(post.link)}" target="_blank" rel="noopener" data-click="${post._id}">Read story ↗</a><button class="icon-button ${favorite ? 'active' : ''}" data-favorite="${post._id}" aria-label="${favorite ? 'Remove from saved' : 'Save story'}">${favorite ? '★' : '☆'}</button></div>${adminTools}</div>
    </article>`;
  }).join('');
}

function escapeHtml(value) { return String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char])); }
function safeUrl(value) { try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : '#'; } catch { return '#'; } }

async function submitAuth(event, type) {
  event.preventDefault();
  const form = event.currentTarget;
  const body = Object.fromEntries(new FormData(form));
  try {
    const data = await api(`/api/auth/${type}`, { method: 'POST', body: JSON.stringify(body) });
    if (type === 'login') {
      await loadSession();
      await loadPosts();
    }
    message('auth-message', data.message, false);
    if (type === 'register') {
      form.reset();
      document.querySelector('[data-auth-tab="login"]').click();
    } else setTimeout(closeModals, 500);
  } catch (error) { message('auth-message', error.message); }
}

function openAccount() {
  if (state.user.role === 'admin') { showModal('admin-modal'); return; }
  const form = $('#profile-form');
  form.name.value = state.user.name;
  form.email.value = state.user.email;
  showModal('account-modal');
}

async function toggleFavorite(postId) {
  if (!state.user) { showModal('auth-modal'); return; }
  try { await api(`/api/posts/favorites/${postId}`, { method: 'POST' }); await loadSession(); } catch (error) { window.alert(error.message); }
}

async function signOut() {
  try {
    await api('/api/auth/logout', { method: 'POST' });
    state.user = null;
    state.favorites.clear();
    state.posts = [];
    closeModals();
    updateAccountUI();
  } catch (error) {
    window.alert(error.message);
  }
}

async function handlePostSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const values = Object.fromEntries(new FormData(form));
  const body = { title: values.title, link: values.link, source: values.source, tags: values.tags.split(',').map((tag) => tag.trim()).filter(Boolean) };
  const editing = Boolean(values.postId);
  try {
    await api(editing ? `/api/posts/${values.postId}` : '/api/posts/create', { method: editing ? 'PATCH' : 'POST', body: JSON.stringify(body) });
    message('admin-message', editing ? 'Story updated.' : 'Story published.', false);
    form.reset();
    form.postId.value = '';
    $('#post-submit').textContent = 'Publish story';
    $('#cancel-edit').classList.add('hidden');
    await loadPosts();
  } catch (error) { message('admin-message', error.message); }
}

document.addEventListener('click', async (event) => {
  const tag = event.target.closest('[data-tag]');
  if (tag) { state.tag = tag.dataset.tag; state.page = 1; await loadPosts(); }
  const favorite = event.target.closest('[data-favorite]');
  if (favorite) await toggleFavorite(favorite.dataset.favorite);
  const edit = event.target.closest('[data-edit]');
  if (edit) {
    const post = state.posts.find((item) => item._id === edit.dataset.edit);
    if (!post) return;
    const form = $('#post-form'); form.postId.value = post._id; form.title.value = post.title; form.link.value = post.link; form.source.value = post.source || ''; form.tags.value = (post.tag || []).join(', ');
    $('#post-submit').textContent = 'Save changes'; $('#cancel-edit').classList.remove('hidden'); showModal('admin-modal');
  }
  const remove = event.target.closest('[data-delete]');
  if (remove && window.confirm('Delete this story?')) {
    try { await api(`/api/posts/${remove.dataset.delete}`, { method: 'DELETE' }); await loadPosts(); } catch (error) { window.alert(error.message); }
  }
  const clickLink = event.target.closest('[data-click]');
  if (clickLink) api(`/api/posts/${clickLink.dataset.click}/click`, { method: 'POST' }).catch(() => {});
});
document.querySelectorAll('[data-close-modal]').forEach((button) => button.addEventListener('click', closeModals));
$('#auth-button').addEventListener('click', () => state.user ? openAccount() : showModal('auth-modal'));
$('#access-button').addEventListener('click', () => showModal('auth-modal'));
$('#favorites-button').addEventListener('click', () => {
  if (state.showingFavorites) { state.page = 1; loadPosts(); return; }
  state.tag = ''; state.search = ''; $('#search-input').value = ''; loadFavorites();
});
$('#search-form').addEventListener('submit', async (event) => { event.preventDefault(); state.search = $('#search-input').value.trim(); state.page = 1; await loadPosts(); });
$('#previous-page').addEventListener('click', async () => { state.page -= 1; await loadPosts(); window.scrollTo({ top: 350, behavior: 'smooth' }); });
$('#next-page').addEventListener('click', async () => { state.page += 1; await loadPosts(); window.scrollTo({ top: 350, behavior: 'smooth' }); });
document.querySelectorAll('[data-auth-tab]').forEach((tab) => tab.addEventListener('click', () => {
  document.querySelectorAll('[data-auth-tab]').forEach((item) => item.classList.toggle('active', item === tab));
  $('#login-form').classList.toggle('hidden', tab.dataset.authTab !== 'login');
  $('#register-form').classList.toggle('hidden', tab.dataset.authTab !== 'register');
  $('#auth-title').textContent = tab.dataset.authTab === 'login' ? 'Sign in to DevNews' : 'Join DevNews';
  message('auth-message', '');
}));
$('#login-form').addEventListener('submit', (event) => submitAuth(event, 'login'));
$('#register-form').addEventListener('submit', (event) => submitAuth(event, 'register'));
$('#profile-form').addEventListener('submit', async (event) => { event.preventDefault(); try { const data = await api('/api/auth/profile', { method: 'PATCH', body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) }); state.user = data.user; updateAccountUI(); message('account-message', data.message, false); } catch (error) { message('account-message', error.message); } });
$('#password-form').addEventListener('submit', async (event) => { event.preventDefault(); try { const data = await api('/api/auth/password', { method: 'PATCH', body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) }); event.currentTarget.reset(); message('account-message', data.message, false); } catch (error) { message('account-message', error.message); } });
$('#logout-button').addEventListener('click', signOut);
$('#admin-logout-button').addEventListener('click', signOut);
$('#delete-account-button').addEventListener('click', async () => { if (!window.confirm('Delete your account permanently?')) return; try { await api('/api/auth/account', { method: 'DELETE' }); state.user = null; state.favorites.clear(); closeModals(); updateAccountUI(); } catch (error) { message('account-message', error.message); } });
$('#post-form').addEventListener('submit', handlePostSubmit);
$('#cancel-edit').addEventListener('click', () => { $('#post-form').reset(); $('#post-form').postId.value = ''; $('#post-submit').textContent = 'Publish story'; $('#cancel-edit').classList.add('hidden'); });
loadSession().then(loadPosts);
