<script setup lang="ts">
import type { RequestStatus } from '@/types/api';
import { requestLabel } from '@/utils/requests';
defineProps<{ status: RequestStatus }>();
</script>
<template><span class="inline-block rounded px-3 py-1 text-caption font-bold" :class="status === 'REJECTED' ? 'bg-red-50 text-error' : status === 'COMPLETED' || status === 'READY_FOR_PICKUP' ? 'bg-green-50 text-green-700' : status === 'SUBMITTED' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'">{{ requestLabel(status) }}</span></template>
