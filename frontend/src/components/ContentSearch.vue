<script setup lang="ts">
defineProps<{ modelValue: string; label: string; busy: boolean }>();
defineEmits<{ 'update:modelValue': [value: string]; search: [] }>();
</script>
<template><form class="flex w-full flex-wrap gap-3" role="search" @submit.prevent="$emit('search')"><label class="relative min-w-0 flex-1"><span class="sr-only">{{ label }}</span><span aria-hidden="true" class="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-outline">search</span><input :value="modelValue" :aria-label="label" type="search" maxlength="150" class="w-full border border-outline-variant bg-background py-2 pl-10 pr-4 text-sm focus:border-primary" :placeholder="`${label}…`" @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"></label><button class="bg-primary-container px-5 py-2 text-sm font-semibold text-white" :disabled="busy">Search</button></form></template>
