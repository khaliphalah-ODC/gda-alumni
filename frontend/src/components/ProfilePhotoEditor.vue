<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue';
import ApiAlert from './ApiAlert.vue';
import { uploadImage } from '@/api/image-upload';
import { api, errorMessage } from '@/api/client';
const props = defineProps<{ image: string | null; version: number; enabled: boolean; maxBytes: number; ready: boolean; canConfigure?: boolean; checking?: boolean; availabilityError?: string }>();
const emit = defineEmits<{ saved: []; refresh: [] }>();
const fileInput = ref<HTMLInputElement | null>(null);
const url = ref(''), file = ref<File | null>(null), preview = ref(''), remotePreview = ref(''), busy = ref(false), error = ref('');
watch(() => props.image, (value) => { url.value = value ?? ''; remotePreview.value = ''; }, { immediate: true });
onUnmounted(() => { if (preview.value) URL.revokeObjectURL(preview.value); });
function select(event: Event) {
  file.value = (event.target as HTMLInputElement).files?.[0] ?? null;
  if (preview.value) URL.revokeObjectURL(preview.value);
  error.value = ''; remotePreview.value = '';
  if (file.value && (file.value.size > props.maxBytes || !['image/jpeg', 'image/png', 'image/webp'].includes(file.value.type))) { error.value = 'Choose a JPEG, PNG or WebP within the upload size limit.'; file.value = null; if (fileInput.value) fileInput.value.value = ''; }
  preview.value = file.value ? URL.createObjectURL(file.value) : '';
}
function previewUrl() { try { const parsed = new URL(url.value); if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error(); remotePreview.value = url.value; error.value = ''; } catch { error.value = 'Enter a valid HTTPS image URL.'; } }
async function save(mode: 'upload' | 'url' | 'remove') {
  busy.value = true; error.value = '';
  try {
    if (mode === 'upload') {
      if (!file.value) return;
      await uploadImage<null>('/account/profile-image', file.value, props.version);
    } else if (mode === 'url') await api.patch('/account/profile-image-url', { url: url.value || null, version: props.version });
    else await api.delete('/account/profile-image', { data: { version: props.version } });
    file.value = null; if (fileInput.value) fileInput.value.value = ''; if (preview.value) URL.revokeObjectURL(preview.value); preview.value = ''; emit('saved');
  } catch (e) { error.value = errorMessage(e); } finally { busy.value = false; }
}
</script>
<template><section class="space-y-5 border bg-white p-6"><h2 class="text-h2">Profile picture</h2><ApiAlert :message="error"/><p v-if="!ready">Save your personal profile before adding a picture.</p><img v-if="preview || remotePreview || image" :src="remotePreview || preview || image || undefined" @error="error = 'Image preview could not load. Check the image or its external host.'" alt="Profile picture preview" class="h-28 w-28 rounded-full object-cover" referrerpolicy="no-referrer"><div v-else class="flex h-28 w-28 items-center justify-center rounded-full bg-slate-100"><span aria-hidden="true" class="material-symbols-outlined">person</span><span class="sr-only">Default profile picture</span></div><form class="space-y-3" @submit.prevent="save('upload')"><label for="profile-image-file" class="field-label">Upload image (JPEG, PNG or WebP, maximum {{ Math.floor(maxBytes / 1024 / 1024) }} MB)</label><input id="profile-image-file" ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp" :disabled="checking || !!availabilityError || !enabled || !ready || busy" class="block max-w-full" @change="select"><p v-if="checking" role="status" class="text-sm text-secondary">Checking image uploads…</p><p v-else-if="availabilityError" role="alert" class="text-sm text-error">Could not check image uploads. {{ availabilityError }}</p><div v-else-if="!enabled" class="space-y-2 text-sm text-secondary"><template v-if="canConfigure"><p>File uploads require server storage or Cloudinary to be configured, and image uploads enabled in Platform settings.</p><RouterLink to="/super-admin/settings" class="inline-block text-primary underline">Open platform upload settings</RouterLink></template><p v-else>File uploads are disabled. Contact the platform administrator to enable them.</p><p>You can still use an HTTPS image URL below.</p></div><div class="flex flex-wrap items-center gap-4"><button class="secondary-button" :disabled="checking || !!availabilityError || !file || !enabled || !ready || busy">Upload selected image</button><button type="button" class="text-sm text-primary underline" :disabled="busy || checking" @click="$emit('refresh')">Refresh upload availability</button></div></form><form class="space-y-3 border-t pt-4" @submit.prevent="save('url')"><label for="profile-image-url" class="field-label">HTTPS image URL</label><input id="profile-image-url" v-model.trim="url" type="url" pattern="https://.*" maxlength="2000" class="field-input" placeholder="https://…"><p class="text-sm text-secondary">Linked images depend on the external host remaining available.</p><div class="flex flex-wrap gap-3"><button type="button" class="secondary-button" :disabled="!url || busy" @click="previewUrl">Preview image URL</button><button class="primary-button" :disabled="!ready || busy">Save image URL</button><button type="button" class="secondary-button" :disabled="!ready || !image || busy" @click="save('remove')">Restore default picture</button></div></form><p v-if="busy" role="status">Saving profile picture…</p></section></template>
