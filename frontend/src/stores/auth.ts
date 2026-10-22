import { computed, reactive } from 'vue';
import { api } from '@/api/client';
import type { ApiResponse, User } from '@/types/api';

const state = reactive<{ user: User | null; ready: boolean }>({ user: null, ready: false });

let refreshing: Promise<User | null> | null = null;
function refresh(): Promise<User | null> {
  if (refreshing) return refreshing;
  refreshing = loadSession().finally(() => { refreshing = null; });
  return refreshing;
}

async function loadSession() {
  try { state.user = (await api.get<ApiResponse<User>>('/auth/me')).data.data; }
  catch { state.user = null; }
  finally { state.ready = true; }
  return state.user;
}

async function logout() { await api.post('/auth/logout'); state.user = null; state.ready = true; }

window.addEventListener('gda:session-expired', () => { state.user = null; state.ready = true; });

export function useAuth() {
  return { user: computed(() => state.user), ready: computed(() => state.ready), isAdmin: computed(() => state.user?.role === 'ADMIN'), refresh, logout };
}
