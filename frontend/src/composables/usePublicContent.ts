import { onScopeDispose, ref, toValue, watch, type MaybeRefOrGetter } from 'vue';
import { api, errorMessage } from '@/api/client';
import { contentEndpoint, type ContentKind } from '@/utils/content';
import type { ApiResponse, Pagination, Post } from '@/types/api';

export function usePublicContent(kind: MaybeRefOrGetter<ContentKind>, limit = 9, extraParams?: MaybeRefOrGetter<Record<string, string | undefined>>) {
  const posts = ref<Post[]>([]), pagination = ref<Pagination | null>(null);
  const page = ref(1), search = ref(''), loading = ref(false), error = ref('');
  let controller: AbortController | undefined;
  async function load(nextPage = 1) {
    controller?.abort();
    const current = new AbortController(); controller = current;
    page.value = nextPage; loading.value = true; error.value = ''; posts.value = []; pagination.value = null;
    try {
      const response = await api.get<ApiResponse<Post[]>>(contentEndpoint(toValue(kind)), {
        signal: current.signal, params: { ...toValue(extraParams), page: nextPage, limit, search: search.value || undefined, scope: 'public' },
      });
      if (current.signal.aborted) return;
      posts.value = response.data.data; pagination.value = response.data.pagination;
    } catch (cause) { if (!current.signal.aborted) error.value = errorMessage(cause); }
    finally { if (!current.signal.aborted) loading.value = false; }
  }
  watch(() => toValue(kind), () => { search.value = ''; void load(); }, { immediate: true });
  if (extraParams) watch(() => toValue(extraParams), () => { void load(); }, { deep: true });
  onScopeDispose(() => controller?.abort());
  return { posts, pagination, page, search, loading, error, load };
}
