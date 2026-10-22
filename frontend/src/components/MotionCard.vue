<script setup lang="ts">
import { motion, useReducedMotion } from 'motion-v';
import { onMounted, onBeforeUnmount, ref } from 'vue';
withDefaults(defineProps<{ index?: number; timeline?: boolean; hover?: boolean }>(), { index: 0, timeline: false, hover: true });
const reduced = useReducedMotion();
const desktop = ref(window.matchMedia('(min-width: 768px)').matches);
let media: MediaQueryList | undefined;
function updateDesktop() { desktop.value = !!media?.matches; }
onMounted(() => { media = window.matchMedia('(min-width: 768px)'); updateDesktop(); media.addEventListener('change', updateDesktop); });
onBeforeUnmount(() => media?.removeEventListener('change', updateDesktop));
</script>
<template>
  <motion.div class="motion-card min-w-0" :class="{ 'timeline-motion': timeline }"
    :initial="reduced ? false : { opacity: 0, y: timeline && desktop ? 0 : 12, x: timeline && desktop ? (index % 2 ? 12 : -12) : 0 }" :whileInView="{ opacity: 1, y: 0, x: 0 }"
    :inViewOptions="{ once: true, amount: 0.08 }"
    :transition="{ duration: reduced ? 0 : 0.35, delay: reduced ? 0 : Math.min(index, 5) * 0.04 }"
    :whileHover="!reduced && hover ? { y: -3, scale: 1.005 } : undefined">
    <slot />
  </motion.div>
</template>
