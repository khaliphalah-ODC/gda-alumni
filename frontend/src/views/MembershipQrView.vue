<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import QRCode from 'qrcode';
import DashboardLayout from '@/layouts/DashboardLayout.vue';
import ApiAlert from '@/components/ApiAlert.vue';
import { api, errorMessage } from '@/api/client';
import type { ApiResponse } from '@/types/api';

const url = ref(''), png = ref(''), svg = ref(''), busy = ref(false), error = ref(''), notice = ref('');
const isLocal = computed(() => url.value && ['localhost', '127.0.0.1', '[::1]'].includes(new URL(url.value).hostname));
const options = { errorCorrectionLevel: 'M' as const, margin: 4, width: 1024, color: { dark: '#000000', light: '#ffffff' } };
async function generate() {
  if (busy.value) return;
  busy.value = true; error.value = ''; notice.value = ''; png.value = ''; svg.value = ''; url.value = '';
  try {
    const response = await api.get<ApiResponse<{ url: string }>>('/membership/access');
    const target = new URL(response.data.data.url);
    if (!['https:', 'http:'].includes(target.protocol) || target.username || target.password || target.search || target.hash) throw new Error('Invalid membership URL');
    const [image, vector] = await Promise.all([QRCode.toDataURL(target.href, options), QRCode.toString(target.href, { ...options, type: 'svg' })]);
    url.value = target.href; png.value = image; svg.value = vector;
  } catch (cause) { error.value = errorMessage(cause); }
  finally { busy.value = false; }
}
async function copy() {
  error.value = ''; notice.value = '';
  try { await navigator.clipboard.writeText(url.value); notice.value = 'Membership link copied.'; }
  catch { error.value = 'Could not copy automatically. Select and copy the membership link below.'; }
}
function download(format: 'png' | 'svg') {
  const anchor = document.createElement('a');
  const objectUrl = format === 'svg' ? URL.createObjectURL(new Blob([svg.value], { type: 'image/svg+xml' })) : '';
  anchor.href = objectUrl || png.value; anchor.download = `gda-alumni-membership-qr.${format}`;
  document.body.append(anchor); anchor.click(); anchor.remove();
  if (objectUrl) setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
function print() { window.print(); }
onMounted(generate);
</script>

<template><DashboardLayout><section class="mx-auto max-w-4xl space-y-6 p-5 lg:p-10">
  <div class="flex flex-wrap items-center justify-between gap-4"><h1 class="text-h1">Membership QR code</h1><RouterLink to="/admin/membership" class="secondary-button">Membership applications</RouterLink></div>
  <p class="text-secondary">Share this code on school materials. Scanning it opens the same public membership form used by the website.</p>
  <ApiAlert :message="error"/><ApiAlert :message="notice" kind="success"/>
  <p v-if="busy" role="status">Generating membership QR code…</p>
  <section v-if="png" class="membership-qr-print space-y-5 border bg-white p-6 text-center">
    <h2 class="text-h2">Become an Alumni Member</h2><p>Gray D. Allison High School</p>
    <img :src="png" alt="QR code opening the public alumni membership application" class="mx-auto h-auto w-72 max-w-full" width="1024" height="1024">
    <p>Scan to apply for alumni membership.</p><a :href="url" class="block break-all text-primary underline" target="_blank" rel="noopener noreferrer">{{ url }}</a>
  </section>
  <template v-if="url"><label for="membership-public-url" class="field-label">Public membership link</label><input id="membership-public-url" :value="url" readonly class="field-input" @focus="($event.target as HTMLInputElement).select()">
    <div class="flex flex-wrap gap-3"><button class="primary-button" @click="download('png')">Download PNG</button><button class="secondary-button" @click="download('svg')">Download SVG</button><button class="secondary-button" @click="copy">Copy membership link</button><button class="secondary-button" @click="print">Print QR code</button></div>
    <p v-if="isLocal" class="text-sm text-secondary">This link uses a local development address. Configure the deployed website address before printing codes for applicants.</p>
  </template>
  <button class="secondary-button" :disabled="busy" @click="generate">{{ png ? 'Regenerate QR code' : 'Generate QR code' }}</button>
</section></DashboardLayout></template>

<style>
@media print {
  body:has(.membership-qr-print) * { visibility: hidden; }
  body .membership-qr-print, body .membership-qr-print * { visibility: visible; }
  body .membership-qr-print { position: absolute; left: 0; top: 0; width: 100%; border: 0; padding: 2cm; }
}
</style>
