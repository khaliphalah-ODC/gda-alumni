import { onMounted, onScopeDispose, ref } from 'vue';
import { api, errorMessage } from '@/api/client';
import type { ApiResponse, ManagedCollection, ShowcasePost } from '@/types/api';

export function useManagedCollection(kind: 'gallery' | 'achievements') {
  const items = ref<ShowcasePost[]>([]), managed = ref(false), loading = ref(true), resolved = ref(false), error = ref('');
  let controller: AbortController | undefined;
  async function load() {
    controller?.abort(); const current = new AbortController(); controller = current;
    loading.value = true; error.value = '';
    try {
      const response = await api.get<ApiResponse<ManagedCollection>>(`/${kind}`, { signal: current.signal, params: { scope: 'public', limit: 100 } });
      if (current.signal.aborted) return;
      // Old fixture/API responses use arrays. Only an explicit managed=true
      // switches away from the original curated collection, including when empty.
      managed.value = response.data.data?.managed === true;
      items.value = response.data.data?.items ?? [];
      resolved.value = true;
    } catch (cause) { if (!current.signal.aborted) error.value = errorMessage(cause); }
    finally { if (!current.signal.aborted) loading.value = false; }
  }
  onMounted(load); onScopeDispose(() => controller?.abort());
  return { items, managed, loading, resolved, error, load };
}
