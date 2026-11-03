// Обёртка над fetch для REST API: JSON, язык (X-Lang), CSRF-токен, единый формат ошибок.
const csrfMeta = document.querySelector('meta[name="csrf-token"]');
let csrfToken = csrfMeta?.getAttribute('content') || '';

export function setCsrf(token) {
  if (!token) return;
  csrfToken = token;
  csrfMeta?.setAttribute('content', token);
}

export class ApiError extends Error {
  constructor(status, message, details = null, code = null) {
    super(message);
    this.status = status;
    this.details = details;
    this.code = code;
  }
}

async function request(path, { method = 'GET', body, query, signal, retry = true } = {}) {
  const url = new URL(`/api${path}`, location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
    }
  }
  const headers = { Accept: 'application/json', 'X-Lang': document.documentElement.lang || 'ru' };
  const options = { method, headers, credentials: 'same-origin', signal };
  if (method !== 'GET' && method !== 'HEAD') headers['X-CSRF-Token'] = csrfToken;
  if (body instanceof FormData) options.body = body;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }
  if (!response.ok) {
    const err = data?.error || {};
    // Сессия обновилась (например, после входа в другой вкладке) — берём свежий CSRF-токен и повторяем один раз
    if (response.status === 403 && err.code === 'CSRF' && retry) {
      const me = await request('/auth/me', { retry: false });
      setCsrf(me.csrfToken);
      return request(path, { method, body, query, signal, retry: false });
    }
    throw new ApiError(response.status, err.message || response.statusText, err.details || null, err.code || null);
  }
  return data;
}

export const api = {
  get: (path, query, opts = {}) => request(path, { ...opts, query }),
  post: (path, body, opts = {}) => request(path, { ...opts, method: 'POST', body }),
  put: (path, body, opts = {}) => request(path, { ...opts, method: 'PUT', body }),
  patch: (path, body, opts = {}) => request(path, { ...opts, method: 'PATCH', body }),
  del: (path, body, opts = {}) => request(path, { ...opts, method: 'DELETE', body }),
};

export default api;
