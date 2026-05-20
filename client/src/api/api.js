// In local dev  : VITE_API_URL is empty → BASE = '/api' → Vite proxy → localhost:5000
// In production : VITE_API_URL = 'https://your-api.onrender.com' → BASE = 'https://your-api.onrender.com/api'
const BASE = (import.meta.env.VITE_API_URL || '') + '/api';

function getToken() {
  return localStorage.getItem('mr_token');
}

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
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
