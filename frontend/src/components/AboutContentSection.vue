<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import PublicationImage from './PublicationImage.vue';
import MotionCard from './MotionCard.vue';
import PaginationControls from './PaginationControls.vue';
import { api, errorMessage } from '@/api/client';
import { aboutContentEndpoint, type AboutContentKind } from '@/utils/about-content';
import type { AboutRecord, ApiResponse, Pagination } from '@/types/api';

const props = defineProps<{ kind: AboutContentKind }>();
const expandedHistory = ref<Record<string, boolean>>({});
const records = ref<AboutRecord[]>([]), pagination = ref<Pagination | null>(null);
const page = ref(1), loading = ref(true), error = ref('');
const title = computed(() => ({ history: 'Our School History', school: 'School Leadership', alumni: 'Alumni Leadership' }[props.kind]));
let sequence = 0;
async function load(nextPage = 1) {
  const current = ++sequence;
  loading.value = true; error.value = '';
  try {
    const response = await api.get<ApiResponse<AboutRecord[]>>(aboutContentEndpoint(props.kind), { params: { scope: 'public', page: nextPage, limit: 12, ...(props.kind === 'history' ? { historyOrder: 'chronological' } : {}) } });
    if (current !== sequence) return;
    records.value = response.data.data; pagination.value = response.data.pagination; page.value = nextPage;
  } catch (cause) { if (current === sequence) error.value = errorMessage(cause); }
  finally { if (current === sequence) loading.value = false; }
}
watch(() => props.kind, () => { void load(); }, { immediate: true });
</script>

<template>
  <section class="mb-24" :aria-labelledby="`about-heading-${kind}`">
    <div v-if="kind === 'history'" class="mb-12 text-center">
      <h2 :id="`about-heading-${kind}`" class="font-h2 text-primary uppercase">{{ title }}</h2>
      <div class="mx-auto mt-4 h-1 w-24 bg-primary"></div>
    </div>
    <div v-else class="mb-10 flex items-end gap-8">
      <div><h2 :id="`about-heading-${kind}`" class="font-h2 text-primary uppercase">{{ title }}</h2><p class="font-body-md mt-2 text-on-surface-variant">{{ kind === 'school' ? 'Meet the school’s leadership team.' : 'Meet the alumni association’s leadership team.' }}</p></div>
      <div class="mb-3 hidden h-px flex-1 bg-outline-variant md:block"></div>
    </div>
    <p v-if="loading" role="status" class="border border-outline-variant bg-white p-8">Loading {{ title.toLowerCase() }}…</p>
    <div v-else-if="error" class="space-y-4 border border-outline-variant bg-white p-8">
      <p role="alert" class="text-error">{{ error }}</p><button class="secondary-button" @click="load(page)">Retry {{ title.toLowerCase() }}</button>
    </div>
    <template v-else>
      <div v-if="!records.length" class="border border-outline-variant bg-white p-8 md:p-12">
        <p class="font-body-md max-w-3xl text-on-surface-variant">{{ kind === 'history' ? 'School history milestones will appear here once verified and published by the school.' : `Verified ${kind === 'school' ? 'school' : 'alumni'} leadership information will appear here once published.` }}</p>
        <RouterLink to="/contact" class="font-label-sm mt-6 inline-block text-primary underline">School contact information</RouterLink>
      </div>
      <ol v-else-if="kind === 'history'" class="relative mx-auto grid max-w-4xl grid-cols-2 items-start gap-x-6 gap-y-3 before:pointer-events-none before:absolute before:inset-y-0 before:left-1/2 before:w-0.5 before:-translate-x-1/2 before:bg-primary before:content-[''] sm:gap-x-8 sm:gap-y-5">
        <li v-for="(record, index) in records" :key="record.id" class="min-w-0">
          <MotionCard :index="index" :hover="false" class="min-w-0 border border-outline-variant border-t-2 border-t-primary bg-white p-3 sm:p-5">
          <time :datetime="record.milestoneDate || undefined" class="block break-words text-xs font-semibold text-primary sm:text-sm">{{ record.milestoneDate }}</time>
          <h3 class="mt-2 break-words text-base font-bold leading-snug text-primary sm:text-xl">{{ record.title }}</h3>
          <PublicationImage v-if="record.image" :src="record.image" :alt="record.title" fit="contain" class="mt-3 h-24 w-full sm:h-32" />
          <p :id="`history-description-${record.id}`" class="mt-3 whitespace-pre-wrap break-words text-[13px] leading-5 text-on-surface-variant sm:text-sm" :class="{ 'line-clamp-3': !expandedHistory[record.id] }">{{ record.content }}</p>
          <button class="mt-2 min-h-11 max-w-full break-words text-left text-xs font-semibold text-primary underline underline-offset-4 sm:text-sm" :aria-expanded="!!expandedHistory[record.id]" :aria-controls="`history-description-${record.id}`" :aria-label="`${expandedHistory[record.id] ? 'Show less' : 'Read more'}: ${record.title}`" @click="expandedHistory[record.id] = !expandedHistory[record.id]">{{ expandedHistory[record.id] ? 'Show less' : 'Read more' }}</button>
          </MotionCard></li>
      </ol>
      <div v-else class="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        <MotionCard v-for="(record, index) in records" :key="record.id" :index="index"><article class="h-full min-w-0 border border-outline-variant bg-white p-8 text-center">
          <PublicationImage :src="record.image" :alt="record.title" class="mx-auto h-40 w-40 rounded-full" />
          <h3 class="font-h2 mt-6 break-words text-primary">{{ record.title }}</h3>
          <p class="font-label-sm mt-2 break-words text-primary">{{ record.position }}</p>
          <p class="font-body-md mt-4 whitespace-pre-wrap break-words text-on-surface-variant">{{ record.content }}</p>
        </article></MotionCard>
      </div>
    </template>
    <div v-if="pagination && pagination.totalPages > 1" class="mt-8"><PaginationControls :page="page" :pagination="pagination" :busy="loading" @change="load" /></div>
  </section>
</template>
