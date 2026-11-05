<script setup lang="ts">
import PasswordInput from '@/components/PasswordInput.vue';
import { onMounted, ref } from 'vue';
import PublicLayout from '@/layouts/PublicLayout.vue';
import ApiAlert from '@/components/ApiAlert.vue';
import { activationTokenFromFragment } from '@/utils/membership';
import { api, errorMessage } from '@/api/client';
const token = ref(activationTokenFromFragment(window.location.hash));
// Remove the credential from browser history immediately; fragments never go to the server.
window.history.replaceState(window.history.state, '', window.location.pathname);
const valid = ref(false), validating = ref(true), expiresAt = ref('');
onMounted(async () => {
  try {
    if (!token.value) { error.value = 'Open the personal activation invitation sent to your email. Ask the school to resend an expired or missing invitation.'; return; }
    const response = await api.post('/membership/activation/validate', { token: token.value });
    expiresAt.value = response.data.data.expiresAt; valid.value = true;
  } catch (e) { error.value = errorMessage(e); } finally { validating.value = false; }
});
const password = ref(''), confirmation = ref(''), busy = ref(false), error = ref(''), success = ref(false);
async function activate() { error.value = ''; if (password.value !== confirmation.value) { error.value = 'Passwords must match'; return; } if (new TextEncoder().encode(password.value).length > 72) { error.value = 'Password must not exceed 72 UTF-8 bytes'; return; } busy.value = true; try { await api.post('/membership/activate', { token: token.value, password: password.value }); success.value = true; token.value = ''; password.value = ''; confirmation.value = ''; } catch (e) { error.value = errorMessage(e); } finally { busy.value = false; } }
</script>
<template><PublicLayout><section class="mx-auto max-w-xl space-y-6 px-5 py-12"><h1 class="text-h1">Activate alumni account</h1><ApiAlert :message="error"/><section v-if="success" class="space-y-4 border bg-white p-6"><p>Your approved account is activated and your profile is ready to complete.</p><RouterLink to="/login" class="primary-button">Log in</RouterLink></section><p v-else-if="validating" role="status">Checking your invitation…</p><form v-else-if="valid" class="space-y-5 border bg-white p-6" @submit.prevent="activate"><p>Activation invitations expire after 48 hours and work once. This invitation expires {{ new Date(expiresAt).toLocaleString() }}. Use at least 12 characters for your password.</p><label for="activation-password" class="field-label">Create password</label><PasswordInput id="activation-password" v-model="password" class="field-input" minlength="12" maxlength="72" required autocomplete="new-password"/><label for="activation-confirm" class="field-label">Confirm password</label><PasswordInput id="activation-confirm" v-model="confirmation" class="field-input" required autocomplete="new-password"/><button class="primary-button" :disabled="busy">{{ busy ? 'Activating…' : 'Activate account' }}</button></form></section></PublicLayout></template>
