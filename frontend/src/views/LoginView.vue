<script setup lang="ts">
import { APP_NAME } from '@/config/branding';

import SchoolPhoto from '@/components/SchoolPhoto.vue';
import { schoolPhotos } from '@/assets/school-photos';
import PasswordInput from '@/components/PasswordInput.vue';
import { reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import PublicLayout from '@/layouts/PublicLayout.vue';
import ApiAlert from '@/components/ApiAlert.vue';
import { loginCredentials, loginDestination } from '@/utils/login';
import { api, errorMessage } from '@/api/client';
import { useAuth } from '@/stores/auth';
import type { ApiResponse, User } from '@/types/api';
const form = reactive({ email: '', password: '' }), busy = ref(false), error = ref('');
const router = useRouter(), route = useRoute(); const { refresh } = useAuth();
async function submit() {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    const response = await api.post<ApiResponse<User>>('/auth/login', loginCredentials(form));
    if (!await refresh()) { error.value = 'Your sign-in could not be confirmed. Please try again.'; return; }
    await router.push(loginDestination(route.query.redirect, response.data.data.role));
  } catch (e) { error.value = errorMessage(e); }
  finally {
    form.password = '';
    busy.value = false;
  }
}
</script>
<template><PublicLayout hide-header><div class="reference-ui form-reference relative isolate bg-surface-container-low px-4 py-8 md:p-8"><div class="pointer-events-none fixed inset-0 -z-10 opacity-10"><SchoolPhoto :photo="schoolPhotos.band" decorative /></div><section class="mx-auto w-full max-w-[440px]"><header class="mb-8 text-center"><span aria-hidden="true" class="material-symbols-outlined mb-4 inline-flex h-20 w-20 items-center justify-center rounded-full bg-primary-container text-4xl text-white shadow-sm">school</span><h1 class="text-h1 text-primary">{{ APP_NAME }}</h1><p class="mt-2 text-on-surface-variant">Secure alumni and school information portal</p></header><section class="border border-outline-variant bg-white p-8 shadow-sm md:p-10"><h2 class="text-h2 text-primary">Portal Login</h2><p class="mt-1 mb-6 text-xs uppercase tracking-widest text-secondary">Secure Institutional Access</p><p v-if="route.query.changed === 'password'" role="status" class="mb-5">Password updated. Log in with your new password.</p><form class="space-y-6" @submit.prevent="submit"><ApiAlert :message="error"/><div><label for="email" class="field-label">Email address</label><div class="relative"><span aria-hidden="true" class="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xl text-outline">mail</span><input id="email" v-model.trim="form.email" :disabled="busy" type="email" class="field-input pl-10" required maxlength="254" autocomplete="username" placeholder="alumni@example.com"></div></div><div><div class="mb-2 flex flex-wrap items-center justify-between gap-2"><label for="password" class="text-sm font-semibold text-on-surface-variant">Password</label><RouterLink to="/forgot-password" class="text-xs font-semibold underline">Forgot your password?</RouterLink></div><div class="relative"><span aria-hidden="true" class="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-xl text-outline">lock</span><PasswordInput id="password" v-model="form.password" :disabled="busy" class="pl-10" required maxlength="72" autocomplete="current-password" placeholder="••••••••"/></div></div><p class="text-xs leading-5 text-secondary">For approved, activated alumni and authorized administrators. Your session follows the school’s configured sign-in policy.</p><button class="primary-button w-full" :disabled="busy">{{ busy ? 'Signing in…' : 'Log in' }}<span aria-hidden="true" class="material-symbols-outlined text-lg">login</span></button></form><div class="my-8 flex items-center gap-3"><span class="h-px flex-1 bg-outline-variant"></span><span class="text-xs uppercase tracking-wider text-secondary">New to the community?</span><span class="h-px flex-1 bg-outline-variant"></span></div><RouterLink to="/register" class="secondary-button w-full text-center">Register as a New Alumnus<span aria-hidden="true" class="material-symbols-outlined text-lg">person_add</span></RouterLink><RouterLink to="/membership/status" class="mt-5 block text-center text-sm underline">Check an existing application</RouterLink></section><div class="mt-6 flex justify-center gap-6 text-xs text-secondary"><RouterLink to="/help" class="hover:underline">Support Center</RouterLink><RouterLink to="/" class="hover:underline">Return to school website</RouterLink></div></section></div></PublicLayout></template>
