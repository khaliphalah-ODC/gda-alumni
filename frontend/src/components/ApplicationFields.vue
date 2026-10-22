<script setup lang="ts">
import type { ApplicationForm } from '@/types/api';
import ApplicationVerificationFields from '@/components/ApplicationVerificationFields.vue';
defineProps<{ form: ApplicationForm; lockEmail?: boolean; registration?: boolean }>();
const year = new Date().getFullYear();
const years = Array.from({ length: year - 1899 }, (_, index) => year - index);
</script>
<template><div class="grid gap-6 md:grid-cols-2">
<div :class="registration ? 'md:col-span-2' : ''"><label for="member-name" class="field-label">Full name</label><input id="member-name" v-model.trim="form.fullName" class="field-input" minlength="2" maxlength="150" required autocomplete="name" placeholder="As it appears on your diploma"></div>
<div><label for="member-year" class="field-label">Graduation year</label><select v-if="registration" id="member-year" v-model.number="form.graduationYear" class="field-input" required><option value="" disabled>Select Year</option><option v-for="value in years" :key="value" :value="value">{{ value }}</option></select><input v-else id="member-year" v-model.number="form.graduationYear" class="field-input" type="number" min="1900" :max="year" placeholder="YYYY" required></div>
<div><label for="member-index" class="field-label">Student / index number (optional)</label><input id="member-index" v-model.trim="form.studentIndexNumber" class="field-input" maxlength="100" placeholder="GDA-XXXX-XX"></div>
<div><label for="member-email" class="field-label">Email address</label><input id="member-email" v-model.trim="form.email" class="field-input" type="email" maxlength="254" required :readonly="lockEmail" autocomplete="email" placeholder="name@example.com"></div>
<div><label for="member-phone" class="field-label">Phone number</label><input id="member-phone" v-model.trim="form.phone" class="field-input" type="tel" minlength="6" maxlength="30" required autocomplete="tel" placeholder="+231 00 000 000"></div>
<div class="md:col-span-2"><label for="member-location" class="field-label">Location / Address (optional)</label><input id="member-location" v-model.trim="form.location" class="field-input" maxlength="300" autocomplete="street-address" placeholder="Enter your current location or address"></div>
<details v-if="registration" class="md:col-span-2"><summary class="cursor-pointer text-sm font-semibold text-primary">Additional school verification details (optional)</summary><ApplicationVerificationFields :form="form" class="mt-6"/></details>
<ApplicationVerificationFields v-else :form="form" class="md:col-span-2"/>
</div></template>
