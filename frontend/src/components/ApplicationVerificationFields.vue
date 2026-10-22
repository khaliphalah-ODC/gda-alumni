<script setup lang="ts">
import type { ApplicationForm } from '@/types/api';
defineProps<{ form: ApplicationForm }>();
const fields = [
 { key: 'previousName', id: 'member-previous', label: 'Previous name (optional)', max: 150 },
 { key: 'lastClassAttended', id: 'member-class', label: 'Last class attended (optional)', max: 100 },
] as const;
</script>
<template><div class="grid gap-6 md:grid-cols-2"><div v-for="field in fields" :key="field.key"><label :for="field.id" class="field-label">{{ field.label }}</label><input :id="field.id" v-model.trim="form[field.key]" class="field-input" :maxlength="field.max"></div><div class="md:col-span-2"><label for="member-verification" class="field-label">Additional verification information (optional)</label><textarea id="member-verification" v-model.trim="form.verificationInformation" class="field-input" rows="4" maxlength="2000"></textarea></div></div></template>
