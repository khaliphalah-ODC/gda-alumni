import { onMounted, onScopeDispose, ref } from 'vue';
import { api, errorMessage } from '@/api/client';
import type { AccountSettings, ApiResponse } from '@/types/api';

export function useMediaSettings() {
  const media = ref<AccountSettings['media']>({ enabled: false, maxBytes: 5242880 });
  const checking = ref(true), mediaError = ref('');
  let controller: AbortController | undefined;
  async function refreshMedia() {
    controller?.abort();
    const current = new AbortController(); controller = current;
    checking.value = true; mediaError.value = '';
    try {
      const response = await api.get<ApiResponse<AccountSettings>>('/account/me', { signal: current.signal });
      if (!current.signal.aborted) media.value = response.data.data.media;
    } catch (cause) { if (!current.signal.aborted) mediaError.value = errorMessage(cause); }
    finally { if (!current.signal.aborted) checking.value = false; }
  }
  function focused() { if (!checking.value) void refreshMedia(); }
  onMounted(() => { void refreshMedia(); window.addEventListener('focus', focused); });
  onScopeDispose(() => { controller?.abort(); window.removeEventListener('focus', focused); });
  return { media, checking, mediaError, refreshMedia };
}
