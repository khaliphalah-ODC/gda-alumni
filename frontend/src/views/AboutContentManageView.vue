<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router';
import DashboardLayout from '@/layouts/DashboardLayout.vue';
import ApiAlert from '@/components/ApiAlert.vue';
import ContentImageInput from '@/components/ContentImageInput.vue';
import PublicationImage from '@/components/PublicationImage.vue';
import PaginationControls from '@/components/PaginationControls.vue';
import { uploadImage } from '@/api/image-upload';
import { useMediaSettings } from '@/composables/useMediaSettings';
import { api, errorMessage } from '@/api/client';
import { aboutContentEndpoint, aboutContentLabel, type AboutContentKind } from '@/utils/about-content';
import type { AboutRecord, ApiResponse, Pagination } from '@/types/api';

const props = defineProps<{ kind: AboutContentKind }>();
const history = computed(() => props.kind === 'history');
const records = ref<AboutRecord[]>([]), pagination = ref<Pagination | null>(null);
const selected = ref<AboutRecord | null>(null), deleting = ref<AboutRecord | null>(null);
const page = ref(1), search = ref(''), publication = ref('all');
const loading = ref(false), busy = ref(false), editing = ref(false), error = ref(''), notice = ref('');
const pendingImage = ref<File | null>(null), editorKey = ref(0);
const { media, checking, mediaError, refreshMedia } = useMediaSettings();
const form = reactive({ title: '', content: '', image: '', milestoneDate: '', position: '', displayOrder: 0 });
let loadSequence = 0;
onBeforeRouteLeave((to) => !busy.value || to.path === '/login' || to.path === '/');
onBeforeRouteUpdate(() => !busy.value);


async function load(nextPage = 1) {
  const sequence = ++loadSequence;
  page.value = nextPage; loading.value = true; error.value = '';
  try {
    const response = await api.get<ApiResponse<AboutRecord[]>>(aboutContentEndpoint(props.kind), {
      params: { page: nextPage, limit: 12, scope: 'manage', publication: publication.value, search: search.value || undefined },
    });
    if (sequence !== loadSequence) return;
    records.value = response.data.data; pagination.value = response.data.pagination;
  } catch (cause) { if (sequence === loadSequence) error.value = errorMessage(cause); }
  finally { if (sequence === loadSequence) loading.value = false; }
}
function edit(record?: AboutRecord) {
  editorKey.value++; pendingImage.value = null; error.value = ''; notice.value = '';
  selected.value = record ?? null; deleting.value = null; editing.value = true;
  Object.assign(form, {
    title: record?.title ?? '', content: record?.content ?? '', image: record?.image ?? '',
    milestoneDate: record?.milestoneDate ?? '', position: record?.position ?? '', displayOrder: record?.displayOrder ?? 0,
  });
}
async function save() {
  busy.value = true; error.value = ''; notice.value = '';
  try {
    const endpoint = aboutContentEndpoint(props.kind);
    const data = {
      title: form.title, content: form.content, displayOrder: form.displayOrder,
      image: pendingImage.value ? (selected.value?.image ?? null) : (form.image || null),
      ...(history.value ? { milestoneDate: form.milestoneDate } : { position: form.position }),
    };
    selected.value = (selected.value
      ? await api.patch<ApiResponse<AboutRecord>>(`${endpoint}/${selected.value.id}`, { ...data, version: selected.value.version })
      : await api.post<ApiResponse<AboutRecord>>(endpoint, data)).data.data;
    if (pendingImage.value) {
      try {
        selected.value = (await uploadImage<AboutRecord>(`${endpoint}/${selected.value.id}/image`, pendingImage.value, selected.value.version)).data.data;
      } catch (cause) {
        await load(page.value);
        notice.value = 'Draft saved. The photo has not been saved; retry or use an image URL.';
        error.value = `Image upload failed. ${errorMessage(cause)}`;
        return;
      }
    }
    editing.value = false; selected.value = null; pendingImage.value = null;
    notice.value = 'Draft saved. Review it, then publish it on the About page.';
    await load(page.value);
  } catch (cause) { error.value = errorMessage(cause); }
  finally { busy.value = false; }
}
async function publicationAction(record: AboutRecord) {
  busy.value = true; error.value = ''; notice.value = '';
  try {
    await api.patch(`${aboutContentEndpoint(props.kind)}/${record.id}/${record.isPublished ? 'unpublish' : 'publish'}`, { version: record.version });
    notice.value = record.isPublished ? 'Record unpublished and hidden from the About page.' : 'Record published on the About page.';
    await load(page.value);
  } catch (cause) { error.value = errorMessage(cause); }
  finally { busy.value = false; }
}
async function remove() {
  if (!deleting.value) return;
  busy.value = true; error.value = ''; notice.value = '';
  try {
    await api.delete(`${aboutContentEndpoint(props.kind)}/${deleting.value.id}`, { params: { version: deleting.value.version } });
    deleting.value = null; notice.value = 'Record deleted.';
    await load(page.value);
    if (!records.value.length && page.value > 1) await load(page.value - 1);
  } catch (cause) { error.value = errorMessage(cause); }
  finally { busy.value = false; }
}
watch(() => props.kind, () => {
  editing.value = false; selected.value = null; deleting.value = null; pendingImage.value = null;
  records.value = []; pagination.value = null; search.value = ''; publication.value = 'all'; notice.value = '';
  void load();
}, { immediate: true });
</script>

<template>
  <DashboardLayout>
    <section class="mx-auto max-w-6xl space-y-6 p-5 lg:p-10">
      <header class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="text-h1">Manage {{ aboutContentLabel(kind).toLowerCase() }}</h1>
          <p class="mt-2 max-w-2xl text-secondary">Save drafts, verify the information, then publish. Saving changes to a published record returns it to draft for review.</p>
        </div>
        <button class="primary-button" :disabled="busy || editing" @click="edit()">{{ history ? 'Add milestone' : 'Add leader' }}</button>
      </header>
      <nav v-if="!history" class="flex flex-wrap gap-3" aria-label="Leadership groups">
        <RouterLink v-for="group in (['school', 'alumni'] as const)" :key="group" :to="`/admin/content/leadership/${group}`" :aria-current="kind === group ? 'page' : undefined" :class="kind === group ? 'primary-button' : 'secondary-button'">{{ aboutContentLabel(group) }}</RouterLink>
      </nav>
      <ApiAlert :message="error" />
      <ApiAlert :message="notice" kind="success" />
      <form v-if="editing" class="space-y-5 border border-outline-variant bg-white p-6" @submit.prevent="save">
        <h2 class="text-h2">{{ selected ? 'Edit record' : 'New draft' }}</h2>
        <fieldset :disabled="busy" class="space-y-5">
          <div>
            <label for="about-title" class="field-label">{{ history ? 'Title' : 'Full name' }}</label>
            <input id="about-title" v-model.trim="form.title" class="field-input" required minlength="2" :maxlength="history ? 200 : 150">
          </div>
          <div v-if="history">
            <label for="about-date" class="field-label">Year or date</label>
            <input id="about-date" v-model.trim="form.milestoneDate" class="field-input" required maxlength="10" pattern="[1-9][0-9]{3}(-[0-9]{2}-[0-9]{2})?" placeholder="1980 or 1980-05-20" aria-describedby="about-date-help">
            <p id="about-date-help" class="mt-2 text-sm text-secondary">Enter a year, or a full date in YYYY-MM-DD format.</p>
          </div>
          <div v-else>
            <label for="about-position" class="field-label">Position</label>
            <input id="about-position" v-model.trim="form.position" class="field-input" required minlength="2" maxlength="150">
          </div>
          <div>
            <label for="about-content" class="field-label">{{ history ? 'Description' : 'Short biography' }}</label>
            <textarea id="about-content" v-model.trim="form.content" class="field-input" rows="5" required :maxlength="history ? 20000 : 2000"></textarea>
          </div>
          <ContentImageInput :key="editorKey" v-model="form.image" :upload-enabled="media.enabled" :checking="checking" :availability-error="mediaError" @refresh="refreshMedia" :max-bytes="media.maxBytes" :busy="busy" @file="pendingImage = $event" />
          <div>
            <label for="about-order" class="field-label">Display order</label>
            <input id="about-order" v-model.number="form.displayOrder" class="field-input" type="number" required min="0" max="1000000" step="1" aria-describedby="about-order-help">
            <p id="about-order-help" class="mt-2 text-sm text-secondary">Lower numbers appear first within this section.</p>
          </div>
          <div class="flex flex-wrap gap-3">
            <button class="primary-button">{{ busy ? 'Saving…' : 'Save draft' }}</button>
            <button type="button" class="secondary-button" @click="editing = false; selected = null; pendingImage = null">Cancel</button>
          </div>
        </fieldset>
      </form>
      <form class="grid items-end gap-4 border border-outline-variant bg-white p-5 sm:grid-cols-[minmax(0,1fr)_auto_auto]" @submit.prevent="load()">
        <div class="min-w-0 flex-1">
          <label for="about-search" class="field-label">{{ history ? 'Search milestones' : 'Search leaders' }}</label>
          <input id="about-search" v-model.trim="search" class="field-input" maxlength="150">
        </div>
        <div>
          <label for="about-publication" class="field-label">Publication status</label>
          <select id="about-publication" v-model="publication" class="field-input"><option value="all">All</option><option value="draft">Draft</option><option value="published">Published</option></select>
        </div>
        <button class="secondary-button" :disabled="loading || busy">Search</button>
      </form>
      <p v-if="loading" role="status">Loading records…</p>
      <div v-else-if="!error || records.length" class="space-y-4">
        <article v-for="record in records" :key="record.id" class="space-y-4 border border-outline-variant bg-white p-6">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div><h2 class="text-h2">{{ record.title }}</h2><p class="mt-2 text-sm text-secondary">{{ history ? record.milestoneDate : record.position }} · Order {{ record.displayOrder }}</p></div>
            <span class="text-sm font-semibold">{{ record.isPublished ? 'Published' : 'Draft' }}</span>
          </div>
          <PublicationImage v-if="record.image" :src="record.image" :alt="record.title" class="h-40 w-40" :class="history ? '' : 'rounded-full'" />
          <p class="whitespace-pre-wrap break-words text-secondary">{{ record.content }}</p>
          <div class="flex flex-wrap gap-3">
            <button class="secondary-button" :disabled="busy || editing" @click="edit(record)">Edit</button>
            <button class="primary-button" :disabled="busy || editing" @click="publicationAction(record)">{{ record.isPublished ? 'Unpublish' : 'Publish' }}</button>
            <button class="text-error underline" :disabled="busy || editing" @click="deleting = record">Delete</button>
          </div>
        </article>
        <p v-if="!records.length">{{ history ? 'No matching milestones. Add a milestone to start the school timeline.' : 'No matching leaders in this group. Add a leader to get started.' }}</p>
      </div>
      <section v-if="deleting" class="space-y-4 border border-red-200 bg-white p-6" role="alert">
        <h2 class="font-semibold">Delete “{{ deleting.title }}”?</h2><p>This permanently deletes the record and removes it from the About page.</p>
        <div class="flex flex-wrap gap-3"><button class="primary-button" :disabled="busy" @click="remove">Confirm deletion</button><button class="secondary-button" :disabled="busy" @click="deleting = null">Cancel deletion</button></div>
      </section>
      <PaginationControls :page="page" :pagination="pagination" :busy="loading || busy" @change="load" />
      <RouterLink to="/about" class="inline-block underline">View the About page</RouterLink>
    </section>
  </DashboardLayout>
</template>
