/**
 * 前端入口：先验证身份（姓名 + 学号），通过后初始化报头搜索、路由与全站组件。
 */
import { initBackToTop, bindSearchBox, clearError } from './components.js';
import { defineRoute, navigate, start } from './router.js';
import { escapeHtml, qs } from './utils.js';
import { getUser, loadSession, logout } from './auth.js';
import { initAbbrTooltip, loadAbbreviations } from './abbr.js';
import { initQrModal } from './qr.js';
import homeView from './views/home.js';
import browseView from './views/browse.js';
import entryView from './views/entry.js';
import searchView from './views/search.js';
import articlesView from './views/articles.js';
import articleView from './views/article.js';
import adminView from './views/admin.js';
import articleFormView from './views/articleForm.js';
import aboutView from './views/about.js';
import notFoundView from './views/notFound.js';

defineRoute('/', homeView);
defineRoute('/browse', browseView);
defineRoute('/entry/:id', entryView);
defineRoute('/search', searchView);
defineRoute('/articles', articlesView);
defineRoute('/article/:id', articleView);
defineRoute('/admin', adminView);
defineRoute('/new-article', articleFormView);
defineRoute('/edit-article/:id', articleFormView);
defineRoute('/about', aboutView);

const NAV_BY_PREFIX = [
  { prefix: '/browse', nav: '/browse' },
  { prefix: '/entry', nav: '/browse' },
  { prefix: '/articles', nav: '/articles' },
  { prefix: '/article', nav: '/articles' },
  { prefix: '/new-article', nav: '/articles' },
  { prefix: '/edit-article', nav: '/articles' },
  { prefix: '/search', nav: '/search' },
  { prefix: '/admin', nav: '/admin' },
  { prefix: '/about', nav: '/about' },
];

let chromeReady = false;

function updateActiveNav(path) {
  const matched = NAV_BY_PREFIX.find((item) => path === item.prefix || path.startsWith(`${item.prefix}/`));
  document.querySelectorAll('.site-nav a[data-nav]').forEach((link) => {
    const isActive = matched ? link.dataset.nav === matched.nav : false;
    link.classList.toggle('is-active', isActive);
    if (isActive) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
}

function syncToolbarSearch(path, query) {
  const input = document.getElementById('global-search-input');
  if (!input) return;
  if (path === '/search') {
    input.value = query && query.q ? query.q : '';
  } else if (document.activeElement !== input) {
    input.value = '';
  }
}

function initToolbar() {
  const form = document.getElementById('global-search');
  if (form) {
    bindSearchBox(form, {
      onSubmit(keyword) {
        navigate(`/search?q=${encodeURIComponent(keyword)}`);
      },
    });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target;
    const tagName = target && target.tagName ? target.tagName.toLowerCase() : '';
    const isEditable =
      tagName === 'input' ||
      tagName === 'textarea' ||
      tagName === 'select' ||
      (target && target.isContentEditable);
    if (isEditable) return;
    if (document.body.classList.contains('dialog-open')) return;
    const input = document.getElementById('global-search-input');
    if (input) {
      event.preventDefault();
      input.focus();
      input.select();
    }
  });
}

function initRouteWatcher() {
  start({
    mount: qs('#app'),
    notFound: notFoundView,
    onRouteChange(parsed) {
      clearError();
      updateActiveNav(parsed.path);
      syncToolbarSearch(parsed.path, parsed.query);
      if (document.body.classList.contains('dialog-open')) {
        document.body.classList.remove('dialog-open');
      }
    },
  });
}

function renderVersionSwitch() {
  const holder = document.querySelector('[data-version-switch]');
  if (!holder) return;
  const user = getUser();
  if (!user || !user.can_switch) {
    holder.hidden = true;
    return;
  }
  holder.hidden = false;
  const current = Number(
    document.body.dataset.version ||
      (window.location.pathname.startsWith('/8/') ? 8 : 9)
  );
  holder.querySelectorAll('a[data-version-link]').forEach((link) => {
    const target = Number(link.dataset.versionLink);
    const active = target === current;
    link.classList.toggle('is-active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
    if (!link.dataset.switchBound) {
      link.dataset.switchBound = '1';
      link.addEventListener('click', (event) => {
        if (link.classList.contains('is-active')) event.preventDefault();
      });
    }
  });
}

/** 顶栏显示同学姓名与「退出验证」。 */
function renderAuthActions() {
  renderVersionSwitch();
  const holder = document.getElementById('auth-actions');
  if (!holder) return;
  const user = getUser();
  if (!user) {
    holder.innerHTML = '';
    return;
  }
  holder.innerHTML = `<span class="auth-user">欢迎，<strong>${escapeHtml(
    user.name
  )}</strong></span><button type="button" class="auth-logout" id="auth-logout">退出验证</button>`;
  const logoutButton = document.getElementById('auth-logout');
  if (logoutButton) logoutButton.addEventListener('click', handleLogout);
}

async function handleLogout() {
  try {
    await logout();
  } catch (error) {
    /* 本地状态已在 auth.logout 清理 */
  }
  window.location.replace('../');
}

/** 首次验证通过后初始化主站外壳（只执行一次）。 */
function initChrome() {
  if (chromeReady) return;
  chromeReady = true;
  initToolbar();
  initBackToTop();
  initRouteWatcher();
  renderAuthActions();
  initQrModal();

  // 会话过期时由 api.js 派发，回到独立验证入口
  window.addEventListener('mcd:auth-required', () => {
    if (!getUser()) return;
    window.location.replace('../');
  });
}

async function boot() {
  let session = null;
  try {
    session = await loadSession();
  } catch (error) {
    window.location.replace('../');
    return;
  }

  if (!session.authenticated) {
    window.location.replace('../');
    return;
  }

  const sessionUser = session.user || {};
  const userClass = Number(sessionUser.class || 9);
  if (userClass !== 8 && !sessionUser.can_switch) {
    window.location.replace('../9/');
    return;
  }

  await loadAbbreviations();
  initChrome();
  initAbbrTooltip();
}

boot();
