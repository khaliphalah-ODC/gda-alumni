<script setup lang="ts">
import PasswordInput from '@/components/PasswordInput.vue';
import { reactive, ref } from 'vue';
import PublicLayout from '@/layouts/PublicLayout.vue';
import ApiAlert from '@/components/ApiAlert.vue';
import ApplicationFields from '@/components/ApplicationFields.vue';
import { applicationPayload } from '@/utils/membership';
import { api, errorMessage } from '@/api/client';
import type { ApiResponse, ApplicationForm } from '@/types/api';
const credentials = reactive({ reference: '', secret: '' });
const result = ref<{ reference: string; status: string; submittedAt: string; reviewedAt: string | null; rejectionReason: string | null; activated: boolean } | null>(null);
const form = reactive<ApplicationForm>({ fullName: '', email: '', phone: '', location: '', previousName: '', graduationYear: '', studentIndexNumber: '', lastClassAttended: '', verificationInformation: '' });
const busy = ref(false), editing = ref(false), error = ref(''), notice = ref('');
async function check() { busy.value = true; error.value = ''; result.value = null; editing.value = false; try { result.value = (await api.post<ApiResponse<NonNullable<typeof result.value>>>('/membership/status', credentials)).data.data; } catch (e) { error.value = errorMessage(e); } finally { busy.value = false; } }
async function correct() { busy.value = true; error.value = ''; try { await api.patch('/membership/application', { ...credentials, application: applicationPayload(form) }); notice.value = 'Your pending application has been corrected.'; editing.value = false; } catch (e) { error.value = errorMessage(e); } finally { busy.value = false; } }
</script>
<template><PublicLayout><section class="mx-auto max-w-3xl space-y-6 px-5 py-12"><h1 class="text-h1">Membership application status</h1><p>Use the reference and private secret from your receipt. Neither credential is stored in this browser.</p><form class="space-y-4 border bg-white p-6" @submit.prevent="check"><label for="reference" class="field-label">Application reference</label><input id="reference" v-model.trim="credentials.reference" class="field-input" required pattern="GDA-[A-F0-9]{24}" autocomplete="off"><label for="tracking-secret" class="field-label">Private tracking secret</label><PasswordInput id="tracking-secret" v-model.trim="credentials.secret" class="field-input" required pattern="[a-f0-9]{64}" autocomplete="off"/><button class="primary-button" :disabled="busy">{{ busy ? 'Checking…' : 'Check status' }}</button></form><ApiAlert :message="error"/><ApiAlert :message="notice" kind="success"/>
<section v-if="result" class="space-y-4 border bg-white p-6" aria-live="polite"><h2 class="text-h2">{{ result.status }}</h2><p>Submitted {{ new Date(result.submittedAt).toLocaleString() }}</p><p v-if="result.reviewedAt">Reviewed {{ new Date(result.reviewedAt).toLocaleString() }}</p><p v-if="result.rejectionReason">Registrar explanation: {{ result.rejectionReason }}</p><p v-if="result.status === 'APPROVED'">{{ result.activated ? 'Your account is activated. You can log in.' : 'Membership is approved. Use the private activation invitation provided by the registrar to create your password.' }}</p><RouterLink v-if="result.activated" to="/login" class="primary-button">Log in</RouterLink><RouterLink v-if="result.status === 'REJECTED'" to="/register" class="underline">Submit a corrected new application</RouterLink><button v-if="result.status === 'PENDING'" class="secondary-button" @click="editing = !editing">Correct pending application</button></section>
<form v-if="editing" class="space-y-5 border bg-white p-6" @submit.prevent="correct"><h2 class="text-h2">Re-enter your complete corrected information</h2><p>Email must match the original application. Approved verification records cannot be edited.</p><ApplicationFields :form="form"/><button class="primary-button" :disabled="busy">Save correction</button></form>
</section></PublicLayout></template>
