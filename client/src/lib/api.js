const API_BASE_URL = import.meta.env.VITE_API_URL || '';

function buildUrl(path) {
  if (!API_BASE_URL) return path;
  return new URL(path, API_BASE_URL).toString();
}

export async function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});

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
