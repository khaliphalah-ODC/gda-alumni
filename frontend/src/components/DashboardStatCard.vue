<script setup lang="ts">
import { motion, useReducedMotion } from 'motion-v';
const reduced = useReducedMotion();
defineProps<{ label: string; value: number | string; icon: string; note?: string; urgent?: boolean; compact?: boolean }>();
</script>
<template><motion.section :initial="reduced ? false : { opacity: 0, y: 8 }" :whileInView="{ opacity: 1, y: 0 }" :inViewOptions="{ once: true }" :whileHover="reduced ? undefined : { y: -2 }" :transition="{ duration: reduced ? 0 : 0.25 }" class="rounded border border-slate-200 bg-white p-5 transition-shadow hover:shadow-sm" :class="{ 'border-l-4 border-l-error': urgent }"><div class="mb-4 flex items-center justify-between"><span aria-hidden="true" class="material-symbols-outlined rounded bg-slate-50 p-2" :class="urgent ? 'text-error' : 'text-primary-container'">{{ icon }}</span></div><h2 class="text-caption font-bold uppercase tracking-wider text-slate-500">{{ label }}</h2><p class="mt-1 text-h2 text-primary-container">{{ typeof value === 'number' ? value.toLocaleString() : value }}</p><p v-if="note" :class="compact ? 'sr-only' : 'mt-2 text-caption text-secondary'">{{ note }}</p></motion.section></template>
