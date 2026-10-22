<script setup lang="ts">
import type { Pagination } from '@/types/api';
defineProps<{ page: number; pagination: Pagination | null; busy?: boolean }>();
defineEmits<{ change: [page: number] }>();
</script>
<template><nav class="flex flex-wrap items-center gap-4" aria-label="Pagination"><button class="secondary-button" :disabled="busy || page <= 1" @click="$emit('change', page - 1)">Previous</button><span class="text-sm">Page {{ page }} of {{ Math.max(1, pagination?.totalPages ?? 1) }} · {{ pagination?.total ?? 0 }} results</span><button class="secondary-button" :disabled="busy || !pagination || page >= pagination.totalPages" @click="$emit('change', page + 1)">Next</button></nav></template>
