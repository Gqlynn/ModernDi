/**
 * 独立验证入口：不依赖九班/八班前端，验证成功后按班级进入对应版本。
 */
const TOKEN_KEY = 'mcd_session_token';
const STATIC_DATA = window.MCD_GATE_DATA;
const IS_STATIC = Boolean(STATIC_DATA && Array.isArray(STATIC_DATA.auth));

function getToken() {
  try {
    return window.localStorage.getItem(TOKEN_KEY) || '';
  } catch (error) {
    return '';
  }
}

function setToken(token) {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch (error) {
    /* ignore */
  }
}

async function authFetch(path, options = {}) {
  const headers = { Accept: 'application/json', ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json; charset=utf-8';
  let response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch (error) {
    throw new Error('无法连接服务器，请确认网站已启动。');
  }
  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }
  if (!response.ok) {
    const message = (payload && payload.error) || '验证失败，请稍后重试。';
    const error = new Error(message);
    error.payload = payload;
    throw error;
  }
  return payload;
}

function targetFor(user) {
  const eight = Number(user && user.class) === 8;
  if (IS_STATIC) return eight ? '8/' : '9/';
  return eight ? '/8/' : '/9/';
}

function goToVersion(user) {
  const target = targetFor(user);
  const hash = window.location.hash || '';
  window.location.replace(target + (hash.startsWith('#') ? hash : ''));
}

function encodeStaticToken(user) {
  const payload = {
    n: user.name,
    c: user.class,
    i: Math.floor(Date.now() / 1000),
    sw: user.can_switch ? 1 : 0,
  };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeStaticToken(token) {
  try {
    const base = String(token).replace(/-/g, '+').replace(/_/g, '/');
    const padded = base + '='.repeat((4 - (base.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(bytes));
    if (!payload || typeof payload.n !== 'string' || !payload.c) return null;
    return {
      name: payload.n,
      class: Number(payload.c) === 8 ? 8 : 9,
      can_switch: Boolean(payload.sw),
    };
  } catch (error) {
    return null;
  }
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function staticLogin(name, studentId) {
  const records = STATIC_DATA && Array.isArray(STATIC_DATA.auth) ? STATIC_DATA.auth : [];
  const digest = await sha256Hex(`${name}|${studentId}`);
  const record = records.find((item) => item && item.h === digest);
  if (!record) throw new Error('姓名与学号不匹配，请核对后重试。');
  const user = {
    name,
    class: Number(record.c) === 8 ? 8 : 9,
    can_switch: Boolean(record.s),
  };
  setToken(encodeStaticToken(user));
  goToVersion(user);
}

const form = document.querySelector('.gate-form');
const errorBox = document.querySelector('[data-gate-error]');
const submit = document.querySelector('.gate-submit');
const nameInput = document.querySelector('input[name="name"]');
const idInput = document.querySelector('input[name="student_id"]');

function showError(text) {
  errorBox.textContent = text;
  errorBox.hidden = !text;
}

function clearError() {
  showError('');
}

[nameInput, idInput].forEach((input) => {
  input.addEventListener('input', clearError);
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = nameInput.value.trim();
  const studentId = idInput.value.trim();
  if (!name) {
    showError('请输入姓名。');
    nameInput.focus();
    return;
  }
  if (!/^\d{8}$/.test(studentId)) {
    showError('学号应为 8 位数字。');
    idInput.focus();
    return;
  }

  submit.disabled = true;
  submit.textContent = '验证中…';
  clearError();
  try {
    if (IS_STATIC) {
      await staticLogin(name, studentId);
      return;
    }
    const data = await authFetch('/auth/login', {
      method: 'POST',
      body: { name, student_id: studentId },
    });
    if (data && data.token) setToken(data.token);
    goToVersion(data && data.user);
  } catch (error) {
    showError(error.message || '验证失败，请稍后重试。');
    idInput.focus();
    idInput.select();
  } finally {
    submit.disabled = false;
    submit.textContent = '进入词典';
  }
});

async function boot() {
  if (IS_STATIC) {
    const user = decodeStaticToken(getToken());
    if (user) {
      goToVersion(user);
      return;
    }
    setToken('');
    window.setTimeout(() => nameInput.focus(), 30);
    return;
  }
  try {
    const data = await authFetch('/auth/session');
    if (data && data.authenticated && data.user) {
      goToVersion(data.user);
      return;
    }
  } catch (error) {
    /* 会话检查失败时仍展示表单，提交时再提示 */
  }
  window.setTimeout(() => nameInput.focus(), 30);
}

boot();
