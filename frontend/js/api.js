const API_BASE = '/api';

class ApiError extends Error {
  constructor(message, status, errors) {
    super(message);
    this.status = status;
    this.errors = errors || null;
  }
}

const UserStore = {
  get() {
    try {
      return JSON.parse(localStorage.getItem('shopx_user')) || null;
    } catch (e) {
      return null;
    }
  },
  set(user) {
    localStorage.setItem('shopx_user', JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem('shopx_user');
  },
};

const Auth = {
  user: UserStore.get(),
  isLoggedIn() {
    return !!this.user;
  },
  isAdmin() {
    return !!this.user && this.user.role === 'admin';
  },
  set(user) {
    this.user = user;
    UserStore.set(user);
  },
  clear() {
    this.user = null;
    UserStore.clear();
  },
};

async function apiRequest(path, options = {}) {
  const { method = 'GET', body, headers = {}, query } = options;
  let url = API_BASE + path;

  if (query) {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '' && v !== false) params.set(k, v);
    });
    const qs = params.toString();
    if (qs) url += (url.includes('?') ? '&' : '?') + qs;
  }

  const config = {
    method,
    credentials: 'include',
    headers: { Accept: 'application/json', ...headers },
  };

  if (body instanceof FormData) {
    config.body = body;
  } else if (body !== undefined) {
    config.headers['Content-Type'] = 'application/json';
    config.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(url, config);
  } catch (err) {
    throw new ApiError('Cannot reach the server. Check your connection and try again.', 0);
  }

  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    data = null;
  }

  if (!res.ok) {
    if (res.status === 401 && Auth.isLoggedIn() && !path.startsWith('/auth/')) {
      Auth.clear();
      window.dispatchEvent(new CustomEvent('shopx:loggedout'));
    }
    throw new ApiError((data && data.message) || `Request failed (${res.status})`, res.status, data && data.errors);
  }

  return data;
}

const api = {
  get: (path, query) => apiRequest(path, { query }),
  post: (path, body) => apiRequest(path, { method: 'POST', body }),
  patch: (path, body) => apiRequest(path, { method: 'PATCH', body }),
  del: (path) => apiRequest(path, { method: 'DELETE' }),
};

const AuthAPI = {
  async refresh() {
    try {
      const res = await api.get('/auth/me');
      Auth.set(res.data.user);
      return res.data.user;
    } catch (e) {
      Auth.clear();
      return null;
    }
  },
  async login(email, password) {
    const res = await api.post('/auth/login', { email, password });
    Auth.set(res.data.user);
    return res.data.user;
  },
  async register(payload) {
    const res = await api.post('/auth/register', payload);
    Auth.set(res.data.user);
    return res.data.user;
  },
  async google(credential) {
    const res = await api.post('/auth/google', { credential });
    Auth.set(res.data.user);
    return res.data.user;
  },
  async googleLink(credential) {
    const res = await api.post('/auth/google/link', { credential });
    Auth.set(res.data.user);
    return res.data.user;
  },
  async logout() {
    try {
      await api.post('/auth/logout');
    } finally {
      Auth.clear();
    }
  },
};
