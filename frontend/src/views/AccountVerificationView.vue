<script setup lang="ts">
import { ref } from 'vue';
import PublicLayout from '@/layouts/PublicLayout.vue';
import ApiAlert from '@/components/ApiAlert.vue';
import PasswordInput from '@/components/PasswordInput.vue';
import { activationTokenFromFragment } from '@/utils/membership';
import { api, errorMessage } from '@/api/client';
const props = defineProps<{ adminActivation?: boolean }>();
const token = ref(activationTokenFromFragment(window.location.hash));
window.history.replaceState(window.history.state, '', window.location.pathname);
const password = ref(''), confirmation = ref(''), busy = ref(false), error = ref(''), success = ref('');
async function submit() { busy.value = true; error.value = ''; try { if (props.adminActivation) await api.post('/account/admin-activate', { token: token.value, password: password.value, confirmation: confirmation.value }); else await api.post('/account/email-change/verify', { token: token.value }); success.value = props.adminActivation ? 'Administrator account activated. You can log in.' : 'Email verified. Log in with your new address. Previous sessions have ended.'; token.value = ''; password.value = ''; confirmation.value = ''; } catch (e) { error.value = errorMessage(e); } finally { busy.value = false; } }
</script>
<template><PublicLayout><section class="mx-auto max-w-xl space-y-6 px-5 py-12"><h1 class="text-h1">{{ adminActivation ? 'Activate Admin account' : 'Verify email change' }}</h1><ApiAlert :message="error"/><ApiAlert :message="success" kind="success"/><RouterLink v-if="success" to="/login" class="primary-button">Log in</RouterLink><form v-else class="space-y-5 border bg-white p-6" @submit.prevent="submit"><p v-if="!token">Open the private link sent to your email. It may have expired or already been used.</p><p v-else>Confirm this action only if you requested it. The private link works once.</p><template v-if="adminActivation"><label for="admin-activation-password" class="field-label">Create password</label><PasswordInput id="admin-activation-password" v-model="password" required minlength="8" maxlength="72" autocomplete="new-password"/><label for="admin-activation-confirm" class="field-label">Confirm password</label><PasswordInput id="admin-activation-confirm" v-model="confirmation" required maxlength="72" autocomplete="new-password"/></template><button class="primary-button" :disabled="!token || busy">{{ busy ? 'Submitting…' : adminActivation ? 'Activate Admin account' : 'Verify new email' }}</button></form></section></PublicLayout></template>
