<script setup lang="ts">
import { ref } from 'vue';
import PublicLayout from '@/layouts/PublicLayout.vue';
import ApiAlert from '@/components/ApiAlert.vue';
import PasswordInput from '@/components/PasswordInput.vue';
import { api, errorMessage } from '@/api/client';
import { activationTokenFromFragment } from '@/utils/membership';
const props = defineProps<{ reset?: boolean }>();
const token = ref(props.reset ? activationTokenFromFragment(window.location.hash) : '');
if (props.reset) window.history.replaceState(window.history.state, '', window.location.pathname);
const email = ref(''), password = ref(''), confirmation = ref(''), busy = ref(false), error = ref(''), notice = ref('');
async function submit() {
  busy.value = true; error.value = ''; notice.value = '';
  try {
    if (props.reset) {
      if (password.value !== confirmation.value) { error.value = 'Passwords must match.'; return; }
      await api.post('/auth/reset-password', { token: token.value, newPassword: password.value, confirmation: confirmation.value });
      notice.value = 'Password reset. Previous sessions have ended. Log in with your new password.';
      token.value = ''; password.value = ''; confirmation.value = '';
    } else {
      const result = await api.post('/auth/forgot-password', { email: email.value.trim().toLowerCase() });
      notice.value = result.data.message;
    }
  } catch (cause) { error.value = errorMessage(cause); }
  finally { busy.value = false; }
}
</script>
<template><PublicLayout><section class="mx-auto max-w-xl space-y-6 px-5 py-12"><h1 class="text-h1">{{ reset ? 'Reset your password' : 'Forgot your password?' }}</h1><ApiAlert :message="error"/><ApiAlert :message="notice" kind="success"/>
  <form v-if="!reset || !notice" class="space-y-5 border bg-white p-6" @submit.prevent="submit">
    <template v-if="reset"><p v-if="!token">Open the private reset link from your email. Links expire after 30 minutes and work once.</p><template v-else><p>Choose a new password with at least eight characters, including letters and a number or symbol.</p><label for="reset-password" class="field-label">New password</label><PasswordInput id="reset-password" v-model="password" required minlength="8" maxlength="72" autocomplete="new-password"/><label for="reset-confirmation" class="field-label">Confirm new password</label><PasswordInput id="reset-confirmation" v-model="confirmation" required minlength="8" maxlength="72" autocomplete="new-password"/></template></template>
    <template v-else><p>Enter the email address for your activated portal account. If it is eligible, we will email a private reset link.</p><label for="recovery-email" class="field-label">Email address</label><input id="recovery-email" v-model.trim="email" type="email" required maxlength="254" autocomplete="email" class="field-input"></template>
    <button class="primary-button" :disabled="busy || (reset && !token)">{{ busy ? 'Submitting…' : reset ? 'Reset password' : 'Send reset link' }}</button>
  </form>
  <nav class="flex flex-wrap gap-5" aria-label="Password recovery links"><RouterLink to="/login" class="underline">Back to login</RouterLink><RouterLink v-if="reset" to="/forgot-password" class="underline">Request a new reset link</RouterLink></nav>
</section></PublicLayout></template>
