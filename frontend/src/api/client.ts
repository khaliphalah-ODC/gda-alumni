import axios from 'axios';

export const api = axios.create({ baseURL: import.meta.env?.VITE_API_URL || '/api', timeout: 30000, withCredentials: true, headers: { 'Content-Type': 'application/json', 'X-GDA-CSRF': '1' } });

export function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) return 'The portal server is unavailable or took too long to respond. Please try again shortly.';
    const details = error.response.data?.data; const fields = details && typeof details === 'object' ? Object.values(details).flat().filter((value): value is string => typeof value === 'string') : []; return fields.length ? fields.join('. ') : error.response.data?.message ?? 'Unable to complete the request. Please try again.';
  }
  return 'Unable to complete the request. Please try again.';
}

api.interceptors.response.use((response) => response, (error) => {
  if (axios.isAxiosError(error) && error.response?.status === 401 && error.config?.url !== '/auth/login') {
    window.dispatchEvent(new Event('gda:session-expired'));
  }
  return Promise.reject(error);
});
