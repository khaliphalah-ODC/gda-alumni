<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import DashboardLayout from '@/layouts/DashboardLayout.vue';
import ApiAlert from '@/components/ApiAlert.vue';
import ContentImageInput from '@/components/ContentImageInput.vue';
import PaginationControls from '@/components/PaginationControls.vue';
import { api, errorMessage } from '@/api/client';
import { uploadImage } from '@/api/image-upload';
import { useMediaSettings } from '@/composables/useMediaSettings';
import type { ApiResponse, ManagedCollection, Pagination, ShowcasePost } from '@/types/api';
const props = defineProps<{ kind: 'gallery' | 'achievements' }>();
const achievement = computed(() => props.kind === 'achievements');
const title = computed(() => achievement.value ? 'Featured Achievements' : 'Manage Gallery');
const items = ref<ShowcasePost[]>([]), page = ref(1), pagination = ref<Pagination | null>(null), selected = ref<ShowcasePost | null>(null), deleting = ref<ShowcasePost | null>(null);
const editing = ref(false), busy = ref(false), loading = ref(false), error = ref(''), notice = ref(''), managed = ref(false), search = ref('');
const pendingImage = ref<File | null>(null), editorKey = ref(0);
const { media, checking, mediaError, refreshMedia } = useMediaSettings();
const blank = () => ({ title: '', content: '', category: achievement.value ? 'School achievement' : 'School life', image: '', imageAlt: '', imageCaption: '', imageWidth: 1200, imageHeight: 900, displayOrder: 0, summary: '', heading: '', milestoneDate: '', sourceUrl: '', sourceLabel: '' });
const form = reactive(blank());
async function load(next = 1) {
  loading.value = true; error.value = ''; page.value = next;
  try { const response = await api.get<ApiResponse<ManagedCollection>>(`/${props.kind}`, { params: { scope: 'manage', page: next, limit: 12, search: search.value || undefined } }); items.value = response.data.data.items; managed.value = response.data.data.managed; pagination.value = response.data.pagination; }
  catch (cause) { error.value = errorMessage(cause); } finally { loading.value = false; }
}
function edit(item?: ShowcasePost) {
  selected.value = item || null; editing.value = true; pendingImage.value = null; editorKey.value++; error.value = '';
  Object.assign(form, blank(), item ? { title: item.title, content: item.content, category: item.category || blank().category, image: item.image || '', imageAlt: item.imageAlt, imageCaption: item.imageCaption || '', imageWidth: item.imageWidth || 1200, imageHeight: item.imageHeight || 900, displayOrder: item.displayOrder, summary: item.summary || '', heading: item.heading || '', milestoneDate: item.milestoneDate || '', sourceUrl: item.sourceUrl || '', sourceLabel: item.sourceLabel || '' } : {});
}
async function save() {
  busy.value = true; error.value = ''; notice.value = '';
  try {
    const data = { title: form.title, content: form.content || form.imageAlt, category: form.category, image: pendingImage.value ? selected.value?.image || null : form.image || null, imageAlt: form.imageAlt, imageCaption: form.imageCaption || null, imageWidth: Number(form.imageWidth), imageHeight: Number(form.imageHeight), displayOrder: Number(form.displayOrder),
      ...(achievement.value ? { summary: form.summary, heading: form.heading, milestoneDate: form.milestoneDate, sourceUrl: form.sourceUrl, sourceLabel: form.sourceLabel } : {}) };
    const endpoint = `/${props.kind}`;
    selected.value = (selected.value ? await api.patch<ApiResponse<ShowcasePost>>(`${endpoint}/${selected.value.id}`, { ...data, version: selected.value.version }) : await api.post<ApiResponse<ShowcasePost>>(endpoint, data)).data.data;
    if (pendingImage.value) selected.value = (await uploadImage<ShowcasePost>(`${endpoint}/${selected.value.id}/image`, pendingImage.value, selected.value.version)).data.data;
    editing.value = false; pendingImage.value = null; notice.value = 'Draft saved. Review it, then publish to update the website.'; await load(page.value);
  } catch (cause) { error.value = errorMessage(cause); if (selected.value) notice.value = 'The draft is saved. You can retry the image upload.'; }
  finally { busy.value = false; }
}
async function publication(item: ShowcasePost) {
  busy.value = true; error.value = '';
  try { await api.patch(`/${props.kind}/${item.id}/${item.isPublished ? 'unpublish' : 'publish'}`, { version: item.version }); notice.value = item.isPublished ? 'Entry unpublished.' : 'Entry published.'; await load(page.value); }
  catch (cause) { error.value = errorMessage(cause); } finally { busy.value = false; }
}
async function remove() {
  if (!deleting.value) return; busy.value = true; error.value = '';
  try { await api.delete(`/${props.kind}/${deleting.value.id}`, { params: { version: deleting.value.version } }); deleting.value = null; await load(); }
  catch (cause) { error.value = errorMessage(cause); } finally { busy.value = false; }
}
watch(() => props.kind, () => { editing.value = false; selected.value = null; deleting.value = null; search.value = ''; void load(); }, { immediate: true });
</script>
<template><DashboardLayout><section class="mx-auto max-w-5xl space-y-6 p-5 lg:p-10"><header class="flex flex-wrap items-center justify-between gap-4"><h1 class="text-h1">{{ title }}</h1><button class="primary-button" :disabled="busy" @click="edit()">{{ achievement ? 'Add achievement' : 'Add photograph' }}</button></header><p>Manage photographs, descriptions, display order and publication. Editing a published entry returns it to draft.</p><p v-if="!managed" class="border p-4">The website currently uses its original curated collection. Publishing your first entry replaces that collection. Add the entries you want to keep before publishing.</p><ApiAlert :message="error"/><ApiAlert :message="notice" kind="success"/>
<form v-if="editing" class="space-y-5 border bg-white p-6" @submit.prevent="save"><h2 class="text-h2">{{ selected ? 'Edit entry' : 'New entry' }}</h2><label for="showcase-title" class="field-label">{{ achievement ? 'Card title' : 'Photograph title' }}</label><input id="showcase-title" v-model.trim="form.title" class="field-input" required minlength="3" maxlength="200"><label for="showcase-category" class="field-label">Category</label><input v-if="achievement" id="showcase-category" v-model.trim="form.category" class="field-input" required maxlength="100"><select v-else id="showcase-category" v-model="form.category" class="field-input"><option>School life</option><option>Parade</option><option>Graduation</option></select>
<template v-if="achievement"><label for="showcase-summary" class="field-label">Front description</label><textarea id="showcase-summary" v-model.trim="form.summary" class="field-input" required maxlength="1500"></textarea><label for="showcase-heading" class="field-label">Achievement heading</label><input id="showcase-heading" v-model.trim="form.heading" class="field-input" required maxlength="200"></template><label for="showcase-content" class="field-label">{{ achievement ? 'Achievement details' : 'Photograph description (optional)' }}</label><textarea id="showcase-content" v-model.trim="form.content" class="field-input" :required="achievement" rows="5" maxlength="20000"></textarea>
<ContentImageInput :key="editorKey" v-model="form.image" :upload-enabled="media.enabled" :checking="checking" :availability-error="mediaError" :unavailable-reason="media.unavailableReason" :max-bytes="media.maxBytes" :busy="busy" @refresh="refreshMedia" @file="pendingImage = $event"/><label for="showcase-alt" class="field-label">Image alternative text</label><input id="showcase-alt" v-model.trim="form.imageAlt" class="field-input" required minlength="3" maxlength="500"><label for="showcase-caption" class="field-label">Photo caption (optional)</label><input id="showcase-caption" v-model.trim="form.imageCaption" class="field-input" maxlength="500"><div class="grid gap-4 sm:grid-cols-3"><div><label for="showcase-width" class="field-label">Image width</label><input id="showcase-width" v-model.number="form.imageWidth" type="number" min="1" max="20000" required class="field-input"></div><div><label for="showcase-height" class="field-label">Image height</label><input id="showcase-height" v-model.number="form.imageHeight" type="number" min="1" max="20000" required class="field-input"></div><div><label for="showcase-order" class="field-label">Display order</label><input id="showcase-order" v-model.number="form.displayOrder" type="number" min="0" max="10000" required class="field-input"></div></div>
<template v-if="achievement"><label for="showcase-date" class="field-label">Achievement date (YYYY, YYYY-MM or YYYY-MM-DD)</label><input id="showcase-date" v-model.trim="form.milestoneDate" class="field-input" required maxlength="10"><label for="showcase-source" class="field-label">Source URL (HTTPS)</label><input id="showcase-source" v-model.trim="form.sourceUrl" type="url" class="field-input" required maxlength="2000"><label for="showcase-source-label" class="field-label">Source label</label><input id="showcase-source-label" v-model.trim="form.sourceLabel" class="field-input" required maxlength="300"></template><div class="flex gap-4"><button class="primary-button" :disabled="busy">{{ busy ? 'Saving…' : 'Save draft' }}</button><button type="button" class="secondary-button" :disabled="busy" @click="editing = false">Cancel</button></div></form>
<form class="flex items-end gap-4" @submit.prevent="load()"><div class="flex-1"><label for="showcase-search" class="field-label">Search entries</label><input id="showcase-search" v-model.trim="search" maxlength="150" class="field-input"></div><button class="secondary-button" :disabled="busy || loading">Search</button></form><p v-if="loading" role="status">Loading entries…</p><article v-for="item in items" :key="item.id" class="space-y-4 border bg-white p-6"><h2 class="text-h2">{{ item.title }}</h2><p>{{ item.category }} · {{ item.isPublished ? 'Published' : 'Draft' }} · Order {{ item.displayOrder }}</p><img v-if="item.image" :src="item.image" :alt="item.imageAlt" class="max-h-48 max-w-full object-contain"><p class="whitespace-pre-wrap">{{ item.content }}</p><div class="flex flex-wrap gap-4"><button class="secondary-button" :disabled="busy" @click="edit(item)">Edit</button><button class="primary-button" :disabled="busy" @click="publication(item)">{{ item.isPublished ? 'Unpublish' : 'Publish' }}</button><button class="text-error underline" :disabled="busy" @click="deleting = item">Delete</button></div></article><p v-if="!loading && !items.length">No matching entries.</p><section v-if="deleting" role="alert" class="space-y-4 border p-6"><h2 class="text-h2">Delete “{{ deleting.title }}”?</h2><button class="primary-button" :disabled="busy" @click="remove">Confirm deletion</button><button class="secondary-button" :disabled="busy" @click="deleting = null">Cancel</button></section><PaginationControls :page="page" :pagination="pagination" :busy="busy || loading" @change="load"/></section></DashboardLayout></template>
