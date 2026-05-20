// In local dev  : VITE_API_URL is empty → BASE = '/api' → Vite proxy → localhost:5000
// In production : VITE_API_URL = 'https://metro-rush-api.vercel.app' → BASE = 'https://metro-rush-api.vercel.app/api'
const BASE = (import.meta.env.VITE_API_URL || '') + '/api';

function getToken() {
  return localStorage.getItem('mr_token');
}

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body != null ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Cannot reach the server. Check your internet connection.');
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 405) throw new Error('Server configuration error. Please try again later.');
    if (res.status === 409) throw new Error(data.error || 'Username or email already taken.');
    if (res.status === 401) throw new Error(data.error || 'Invalid email or password.');
    if (res.status === 400) throw new Error(data.error || 'Please check your input and try again.');
    if (res.status >= 500) throw new Error('Server error. Please try again in a moment.');
    throw new Error(data.error || `Request failed (${res.status})`);
  }

  return data;
}

export const api = {
  auth: {
    register: (body) => request('POST', '/auth/register', body),
    login:    (body) => request('POST', '/auth/login', body),
  },
  users: {
    me: () => request('GET', '/users/me'),
  },
  scores: {
    save:        (body) => request('POST', '/scores', body),
    leaderboard: ()     => request('GET',  '/scores/leaderboard'),
    me:          ()     => request('GET',  '/scores/me'),
  },
};
