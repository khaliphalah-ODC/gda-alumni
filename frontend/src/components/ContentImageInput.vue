<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue';
const props = defineProps<{ modelValue: string; uploadEnabled: boolean; maxBytes: number; busy: boolean; checking?: boolean; availabilityError?: string; unavailableReason?: string | null }>();
const emit = defineEmits<{ 'update:modelValue': [value: string]; file: [value: File | null]; refresh: [] }>();
const mode = ref<'url' | 'file'>('url'), preview = ref(''), error = ref('');
const fileInput = ref<HTMLInputElement | null>(null);
const visibleImage = computed(() => {
  if (preview.value) return preview.value;
  try { const url = new URL(props.modelValue); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.toString() : ''; } catch { return ''; }
});
function clearFile() { if (preview.value) URL.revokeObjectURL(preview.value); preview.value = ''; if (fileInput.value) fileInput.value.value = ''; emit('file', null); }
function choose(next: 'url' | 'file') { mode.value = next; error.value = ''; clearFile(); }
function changed(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (preview.value) URL.revokeObjectURL(preview.value); preview.value = ''; emit('file', null); error.value = '';
  if (!file) return;
  if (file.size > props.maxBytes || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { error.value = 'Choose a JPEG, PNG or WebP within the upload size limit.'; if (fileInput.value) fileInput.value.value = ''; return; }
  preview.value = URL.createObjectURL(file); emit('file', file);
}
onUnmounted(() => { if (preview.value) URL.revokeObjectURL(preview.value); });
</script>
<template><fieldset class="space-y-4 border border-outline-variant p-5"><legend class="px-2 text-sm font-semibold">Content image (optional)</legend><div class="flex flex-wrap gap-3" role="group" aria-label="Content image source"><button type="button" class="secondary-button" :aria-pressed="mode === 'url'" :disabled="busy" @click="choose('url')">Image URL</button><button type="button" class="secondary-button" :aria-pressed="mode === 'file'" :disabled="busy" @click="choose('file')">Upload image file</button></div><p v-if="checking" role="status" class="text-sm text-secondary">Checking image uploads…</p><p v-else-if="availabilityError" role="alert" class="text-sm text-error">Could not check image uploads. {{ availabilityError }}</p><p v-else-if="!uploadEnabled" class="text-sm text-secondary">{{ unavailableReason || 'File uploads are disabled. The platform administrator must configure storage and enable image uploads.' }} You can select a file to preview, or use an image URL.</p><button type="button" class="text-sm text-primary underline" :disabled="busy || checking" @click="$emit('refresh')">Refresh upload availability</button><div v-if="mode === 'url'"><label for="edit-image" class="field-label">Image URL (optional)</label><input id="edit-image" :value="modelValue" class="field-input" type="url" maxlength="2000" :disabled="busy" @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value.trim())"><p class="mt-2 text-xs text-secondary">Use an HTTP or HTTPS image URL. The image is saved when you save this content.</p></div><div v-else><label for="content-image-file" class="field-label">Content image file (JPEG, PNG or WebP, maximum {{ Math.floor(maxBytes / 1024 / 1024) }} MB)</label><input id="content-image-file" ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp" :disabled="busy" class="block max-w-full" @change="changed"><p class="mt-2 text-xs text-secondary">The image uploads after the content is saved. If upload fails, your saved content remains available and you can retry.</p></div><p v-if="error" role="alert" class="text-sm text-error">{{ error }}</p><img v-if="visibleImage" :src="visibleImage" alt="Content image preview" referrerpolicy="no-referrer" class="max-h-56 max-w-full object-contain" @error="error = 'Image preview could not load. Check the file or image host.'"><button v-if="modelValue || preview" type="button" class="text-sm text-primary underline" :disabled="busy" @click="clearFile(); $emit('update:modelValue', ''); error = ''">Remove content image</button></fieldset></template>
