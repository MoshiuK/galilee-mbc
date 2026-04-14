import { create } from 'zustand';
import api from '../api/client';

export const useAuthStore = create((set, get) => ({
  token: localStorage.getItem('pbx_token') || null,
  user: JSON.parse(localStorage.getItem('pbx_user') || 'null'),
  loading: false,
  error: null,

  login: async ({ email, password, tenantSlug }) => {
    set({ loading: true, error: null });
    try {
      const endpoint = tenantSlug ? '/auth/login' : '/auth/platform-login';
      const body = tenantSlug ? { email, password, tenantSlug } : { email, password };
      const { data } = await api.post(endpoint, body);

      localStorage.setItem('pbx_token', data.token);
      localStorage.setItem('pbx_user', JSON.stringify(data.user));

      set({ token: data.token, user: data.user, loading: false });
      return data;
    } catch (err) {
      const msg = err.response?.data?.error || 'Login failed';
      set({ loading: false, error: msg });
      throw new Error(msg);
    }
  },

  logout: () => {
    localStorage.removeItem('pbx_token');
    localStorage.removeItem('pbx_user');
    set({ token: null, user: null });
  },

  fetchProfile: async () => {
    try {
      const { data } = await api.get('/auth/me');
      localStorage.setItem('pbx_user', JSON.stringify(data));
      set({ user: data });
    } catch {
      // ignore
    }
  },

  get isPlatformAdmin() {
    return get().user?.scope === 'platform';
  },

  get isTenantAdmin() {
    const u = get().user;
    return u?.role === 'admin' || u?.role === 'manager';
  },
}));
