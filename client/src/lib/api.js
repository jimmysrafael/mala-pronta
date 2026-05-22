const API_BASE_URL = import.meta.env.VITE_API_URL || '';

function buildUrl(path) {
  if (!API_BASE_URL) return path;
  return new URL(path, API_BASE_URL).toString();
}

function getVisitorId() {
  if (typeof window === 'undefined') return '';

  const storageKey = 'malapronta_visitor_id';
  const existing = window.localStorage.getItem(storageKey);
  if (existing) return existing;

  const generated = `visitor_${crypto.randomUUID()}`;
  window.localStorage.setItem(storageKey, generated);
  return generated;
}

export async function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const visitorId = getVisitorId();

  if (visitorId && !headers.has('X-Visitor-Id')) {
    headers.set('X-Visitor-Id', visitorId);
  }

  if (
    options.body &&
    !headers.has('Content-Type') &&
    !(options.body instanceof FormData)
  ) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(buildUrl(path), {
    ...options,
    headers,
  });

  return response;
}

export function getApiBaseUrl() {
  return API_BASE_URL;
}

export function getClientVisitorId() {
  return getVisitorId();
}
