<script setup lang="ts">defineProps<{ message?: string; kind?: 'error' | 'success' }>();</script>
<template><p v-if="message" :role="kind === 'success' ? 'status' : 'alert'" :class="kind === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-error-container text-error'" class="rounded border px-4 py-3 text-sm">{{ message }}</p></template>
