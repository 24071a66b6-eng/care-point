(() => {
  const TOKEN_KEY = 'carepoint_session_token';

  async function request(path, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set('Accept', 'application/json');
    if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (token) headers.set('Authorization', `Bearer ${token}`);

    let response;
    try {
      response = await fetch(`/api${path}`, { ...options, headers });
    } catch (error) {
      throw new Error('Unable to reach CarePoint. Check your connection and try again.');
    }

    if (response.status === 401 && !path.startsWith('/auth/')) {
      sessionStorage.removeItem(TOKEN_KEY);
      window.dispatchEvent(new Event('carepoint:unauthorized'));
    }
    if (response.status === 204) return null;
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(result?.error?.message || `Request failed (${response.status}).`);
      error.status = response.status;
      error.code = result?.error?.code;
      error.details = result?.error?.details;
      throw error;
    }
    return result;
  }

  window.CarePointAPI = {
    tokenKey: TOKEN_KEY,
    get: (path, options = {}) => request(path, options),
    post: (path, data) => request(path, { method: 'POST', body: JSON.stringify(data) }),
    patch: (path, data) => request(path, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (path) => request(path, { method: 'DELETE' }),
    login: (email, password) => request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    })
  };
})();
