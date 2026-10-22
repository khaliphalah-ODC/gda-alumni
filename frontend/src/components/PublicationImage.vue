<script setup lang="ts">
import { ref, watch } from 'vue';
const props = withDefaults(defineProps<{ src?: string | null; alt?: string; fit?: 'cover' | 'contain' }>(), { fit: 'cover' });
const failed = ref(false); watch(() => props.src, () => { failed.value = false; });
</script>
<template><div class="overflow-hidden bg-surface-container-high"><img v-if="src && !failed" :src="src" :alt="alt || ''" loading="lazy" decoding="async" referrerpolicy="no-referrer" class="h-full w-full object-center" :class="fit === 'contain' ? 'object-contain' : 'object-cover'" @error="failed = true"><div v-else class="flex h-full min-h-40 items-center justify-center text-primary/40" aria-hidden="true"><span class="material-symbols-outlined text-5xl">school</span></div></div></template>
