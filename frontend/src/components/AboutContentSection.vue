<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { motion, useReducedMotion } from 'motion-v';
import PublicationImage from './PublicationImage.vue';
import MotionCard from './MotionCard.vue';
import PaginationControls from './PaginationControls.vue';
import { api, errorMessage } from '@/api/client';
import { aboutContentEndpoint, type AboutContentKind } from '@/utils/about-content';
import type { AboutRecord, ApiResponse, Pagination } from '@/types/api';

const props = defineProps<{ kind: AboutContentKind }>();
const reduced = useReducedMotion();
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
      <ol v-else-if="kind === 'history'" class="space-y-8 border-l-4 border-primary pl-6 md:pl-10">
        <li v-for="(record, index) in records" :key="record.id" class="relative">
          <motion.span aria-hidden="true" :initial="reduced ? false : { opacity: 0.5, scale: 0.85 }" :whileInView="{ opacity: 1, scale: 1 }" :inViewOptions="{ once: true }" :transition="{ duration: reduced ? 0 : 0.3 }" class="milestone-marker absolute -left-[35px] top-8 h-4 w-4 rounded-full border-4 border-white bg-primary md:-left-[51px]"></motion.span>
          <MotionCard :index="index" timeline :hover="false" class="border border-outline-variant bg-white p-6 md:p-8">
          <time :datetime="record.milestoneDate || undefined" class="font-label-sm text-primary">{{ record.milestoneDate }}</time>
          <h3 class="font-h2 mt-3 break-words text-primary">{{ record.title }}</h3>
          <PublicationImage v-if="record.image" :src="record.image" :alt="record.title" fit="contain" class="mt-6 aspect-video w-full" />
          <p class="font-body-md mt-4 whitespace-pre-wrap break-words text-on-surface-variant">{{ record.content }}</p>
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
