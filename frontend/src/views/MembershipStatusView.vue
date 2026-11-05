<script setup lang="ts">
import PasswordInput from '@/components/PasswordInput.vue';
import { computed, reactive, ref } from 'vue';
import PublicLayout from '@/layouts/PublicLayout.vue';
import ApiAlert from '@/components/ApiAlert.vue';
import ApplicationFields from '@/components/ApplicationFields.vue';
import { applicationPayload } from '@/utils/membership';
import { membershipProgress, type TrackedMembership } from '@/utils/membership-progress';
import { api, errorMessage } from '@/api/client';
import type { ApiResponse, ApplicationForm } from '@/types/api';
const credentials = reactive({ trackingCode: '', email: '', verificationToken: '' });
const challengeId = ref(''), code = ref(''), recovery = ref(false), legacy = ref(false);
const old = reactive({ reference: '', secret: '' });
const result = ref<TrackedMembership | null>(null);
const progress = computed(() => result.value ? membershipProgress(result.value) : []);
const form = reactive<ApplicationForm>({ fullName: '', email: '', phone: '', location: '', previousName: '', graduationYear: '', studentIndexNumber: '', lastClassAttended: '', verificationInformation: '' });
const busy = ref(false), editing = ref(false), error = ref(''), notice = ref('');
const proof = () => legacy.value ? { ...old } : { trackingCode: credentials.trackingCode, verificationToken: credentials.verificationToken };
async function check() {
  result.value = (await api.post<ApiResponse<TrackedMembership>>('/membership/status', proof())).data.data;
}
async function requestCode() {
  busy.value = true; error.value = ''; notice.value = ''; result.value = null; editing.value = false;
  try {
    const response = await api.post<ApiResponse<{ challengeId: string; message: string }>>('/membership/tracking/request', { email: credentials.email, ...(recovery.value ? {} : { trackingCode: credentials.trackingCode }) });
    challengeId.value = response.data.data.challengeId; notice.value = response.data.data.message; code.value = '';
  } catch (e) { error.value = errorMessage(e); } finally { busy.value = false; }
}
async function verify() {
  busy.value = true; error.value = ''; editing.value = false;
  try {
    const response = await api.post<ApiResponse<{ trackingCode: string; verificationToken: string }>>('/membership/tracking/verify', { challengeId: challengeId.value, code: code.value });
    Object.assign(credentials, response.data.data); code.value = ''; notice.value = 'Email verified. Your private tracking session lasts 30 minutes.';
    await check(); challengeId.value = '';
  } catch (e) { error.value = errorMessage(e); } finally { busy.value = false; }
}
async function checkLegacy() { busy.value = true; error.value = ''; try { await check(); } catch (e) { legacy.value = false; error.value = errorMessage(e); } finally { busy.value = false; } }
async function refresh() { busy.value = true; error.value = ''; try { await check(); } catch (e) { error.value = errorMessage(e); } finally { busy.value = false; } }
async function correct() { busy.value = true; error.value = ''; try { await api.patch('/membership/application', { ...proof(), application: applicationPayload(form) }); notice.value = 'Your pending application has been corrected.'; editing.value = false; await check(); } catch (e) { error.value = errorMessage(e); } finally { busy.value = false; } }
function restart() { result.value = null; credentials.verificationToken = ''; challengeId.value = ''; code.value = ''; editing.value = false; error.value = ''; notice.value = ''; }
</script>
<template><PublicLayout><section class="mx-auto max-w-3xl space-y-6 px-5 py-12"><h1 class="text-h1">Track your membership application</h1><p>Your 12-digit tracking code identifies your application. Verify your registered email to view its private status. An activation invitation is sent separately after approval.</p>
<ApiAlert :message="error"/><ApiAlert :message="notice" kind="success"/>
<template v-if="!result"><form v-if="!legacy && !challengeId" class="space-y-4 border bg-white p-6" @submit.prevent="requestCode"><label class="flex items-center gap-3"><input v-model="recovery" type="checkbox">I lost my tracking code</label><template v-if="!recovery"><label for="tracking-code" class="field-label">Application Tracking Code</label><input id="tracking-code" v-model.trim="credentials.trackingCode" inputmode="numeric" pattern="[0-9]{12}" minlength="12" maxlength="12" class="field-input" required autocomplete="off" aria-describedby="code-help"><p id="code-help" class="text-sm text-secondary">Enter the 12 digits from your application confirmation.</p></template><label for="tracking-email" class="field-label">Application email address</label><input id="tracking-email" v-model.trim="credentials.email" type="email" required maxlength="254" class="field-input" autocomplete="email"><p v-if="recovery" class="text-sm">Verify your email to recover the code for your most recent application. Existing receipts continue to work below.</p><button class="primary-button" :disabled="busy">{{ busy ? 'Requesting verification…' : 'Track Application' }}</button></form>
<form v-if="challengeId" class="space-y-4 border bg-white p-6" @submit.prevent="verify"><h2 class="text-h2">Verify your email</h2><p>Enter the six-digit code sent to the application email. It expires in 10 minutes and works once. If no email arrives, check spam or contact the school to check delivery.</p><label for="email-code" class="field-label">Email verification code</label><input id="email-code" v-model.trim="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required autocomplete="one-time-code" class="field-input"><div class="flex flex-wrap gap-3"><button class="primary-button" :disabled="busy">{{ busy ? 'Verifying…' : 'Verify and view status' }}</button><button type="button" class="secondary-button" :disabled="busy" @click="restart">Request another code</button></div></form>
<details v-if="!challengeId" class="border bg-white p-5"><summary class="cursor-pointer font-semibold">Have an older two-part receipt?</summary><form class="mt-4 space-y-4" @submit.prevent="legacy = true; checkLegacy()"><p>Previously issued references and private tracking secrets remain valid. You can also recover a numeric code through email verification above.</p><label for="reference" class="field-label">Original application reference</label><input id="reference" v-model.trim="old.reference" class="field-input" required pattern="GDA-[A-F0-9]{24}" autocomplete="off"><label for="tracking-secret" class="field-label">Original private tracking secret</label><PasswordInput id="tracking-secret" v-model.trim="old.secret" class="field-input" required pattern="[a-f0-9]{64}" autocomplete="off"/><button class="secondary-button" :disabled="busy">Check older receipt</button></form></details></template>
<section v-if="result" class="space-y-5 border bg-white p-6" aria-live="polite"><h2 class="text-h2">{{ result.status }}</h2><p class="break-words">Application tracking code: <strong>{{ result.trackingCode }}</strong></p><p>Submitted {{ new Date(result.submittedAt).toLocaleString() }}</p><ol aria-label="Application progress" class="space-y-4 border-l-2 border-slate-200 pl-5"><li v-for="step in progress" :key="step.label" :aria-current="step.current ? 'step' : undefined"><span class="font-semibold">{{ step.label }}</span><span class="ml-2 text-sm">{{ step.complete ? 'Complete' : step.current ? 'Awaiting completion' : 'Upcoming' }}</span></li></ol><p v-if="result.reviewedAt">Reviewed {{ new Date(result.reviewedAt).toLocaleString() }}</p><p v-if="result.rejectionReason">School explanation: {{ result.rejectionReason }}</p><template v-if="result.status === 'APPROVED' && !result.activated"><p v-if="result.invitationStatus === 'SENT'">Your invitation was submitted to the email provider. Check your inbox and spam folder; inbox delivery is not confirmed here.</p><p v-else-if="result.invitationStatus === 'DEVELOPMENT'">The invitation was captured by a local mail catcher. No external inbox delivery occurred.</p><p v-else-if="['FAILED','UNKNOWN','CANCELLED'].includes(result.invitationStatus)">An activation invitation is not currently confirmed as sent. Contact the school to check delivery and request a replacement.</p><p v-else>Your membership is approved. Your activation invitation is awaiting email submission.</p></template><p v-if="result.activated">Your account is activated. You can log in.</p><div class="flex flex-wrap gap-3"><RouterLink v-if="result.activated" to="/login" class="primary-button">Log in</RouterLink><RouterLink v-if="result.status === 'REJECTED'" to="/register" class="underline">Submit a corrected new application</RouterLink><button v-if="result.status === 'PENDING'" class="secondary-button" :disabled="busy" @click="editing = !editing">Correct pending application</button><button class="secondary-button" :disabled="busy" @click="refresh">Refresh status</button><button class="secondary-button" :disabled="busy" @click="restart(); legacy = false">End tracking session</button></div></section>
<form v-if="editing" class="space-y-5 border bg-white p-6" @submit.prevent="correct"><h2 class="text-h2">Re-enter your complete corrected information</h2><p>Email must match the original application. Approved verification records cannot be edited.</p><ApplicationFields :form="form"/><button class="primary-button" :disabled="busy">Save correction</button></form>
</section></PublicLayout></template>
