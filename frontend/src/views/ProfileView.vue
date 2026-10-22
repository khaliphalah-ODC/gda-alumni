<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import axios from 'axios';
import DashboardLayout from '@/layouts/DashboardLayout.vue';
import ApiAlert from '@/components/ApiAlert.vue';
import ProfilePhotoEditor from '@/components/ProfilePhotoEditor.vue';
import { useMediaSettings } from '@/composables/useMediaSettings';
import { useAuth } from '@/stores/auth';
import { api, errorMessage } from '@/api/client';
import type { AlumniProfile, ApiResponse } from '@/types/api';
const form = reactive({ fullName: '', graduationYear: '' as number | '', occupation: '', location: '', phone: '', bio: '' });
const photo = ref<string | null>(null), imageVersion = ref(0), profileReady = ref(false);
const { media, checking, mediaError, refreshMedia } = useMediaSettings();
const { refresh } = useAuth();
function photoMetadata(profile: AlumniProfile) { photo.value = profile.profileImage; imageVersion.value = profile.imageVersion; profileReady.value = true; }
async function imageSaved() {
  try { photoMetadata((await api.get<ApiResponse<AlumniProfile>>('/alumni/profile')).data.data); await refresh(); notice.value = 'Profile picture saved.'; }
  catch (cause) { error.value = errorMessage(cause); }
}
const loading = ref(true), busy = ref(false), error = ref(''), notice = ref('');
function fill(profile: AlumniProfile) { photoMetadata(profile); Object.assign(form, { fullName: profile.fullName, graduationYear: profile.graduationYear ?? '', occupation: profile.occupation ?? '', location: profile.location ?? '', phone: profile.phone ?? '', bio: profile.bio ?? '' }); }
onMounted(async () => { try { fill((await api.get<ApiResponse<AlumniProfile>>('/alumni/profile')).data.data); } catch (e) { if (!axios.isAxiosError(e) || e.response?.status !== 404) error.value = errorMessage(e); } finally { loading.value = false; } });
async function save() { busy.value = true; error.value = ''; notice.value = ''; try { const response = await api.patch<ApiResponse<AlumniProfile>>('/alumni/profile', { ...form, graduationYear: form.graduationYear === '' ? null : Number(form.graduationYear) }); fill(response.data.data); notice.value = 'Profile saved. Your approved verification record is unchanged.'; } catch (e) { error.value = errorMessage(e); } finally { busy.value = false; } }
</script>
<template><DashboardLayout><section class="mx-auto max-w-3xl space-y-6 p-5 lg:p-10"><h1 class="text-h1">My alumni profile</h1><p>Your profile is visible to approved, activated alumni and administrators. Your email and phone are excluded from directory responses. Profile edits do not alter your approved membership application.</p><ApiAlert :message="error"/><ApiAlert :message="notice" kind="success"/><p v-if="loading" role="status">Loading profile…</p><form v-else class="space-y-5 border bg-white p-6" @submit.prevent="save"><div class="grid gap-5 sm:grid-cols-2"><div><label for="profile-name" class="field-label">Full name</label><input id="profile-name" v-model.trim="form.fullName" class="field-input" minlength="2" maxlength="150" required autocomplete="name"></div><div><label for="profile-year" class="field-label">Graduation year</label><input id="profile-year" v-model.number="form.graduationYear" type="number" min="1900" :max="new Date().getFullYear()" class="field-input"></div><div><label for="profile-job" class="field-label">Occupation</label><input id="profile-job" v-model.trim="form.occupation" class="field-input" maxlength="500"></div><div><label for="profile-location" class="field-label">Current location</label><input id="profile-location" v-model.trim="form.location" class="field-input" maxlength="500"></div><div><label for="profile-phone" class="field-label">Private phone</label><input id="profile-phone" v-model.trim="form.phone" class="field-input" type="tel" minlength="6" maxlength="30"></div></div><label for="profile-bio" class="field-label">Biography</label><textarea id="profile-bio" v-model.trim="form.bio" class="field-input" rows="5" maxlength="2000"></textarea><button class="primary-button" :disabled="busy">{{ busy ? 'Saving…' : 'Save profile' }}</button></form><ProfilePhotoEditor v-if="!loading" :image="photo" :version="imageVersion" :enabled="media.enabled" :max-bytes="media.maxBytes" :ready="profileReady" :checking="checking" :availability-error="mediaError" @refresh="refreshMedia" @saved="imageSaved" /></section></DashboardLayout></template>
