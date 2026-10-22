<script setup lang="ts">
import { ref } from 'vue';
import { motion, useReducedMotion } from 'motion-v';
import PublicationImage from './PublicationImage.vue';
import type { AboutRecord } from '@/types/api';
defineProps<{ record: AboutRecord }>();
const expanded = ref(false), reduced = useReducedMotion();
</script>
<template>
  <article class="achievement-card flex h-full flex-col border border-outline-variant bg-white text-primary">
    <div class="achievement-scene flex-1">
      <motion.div class="achievement-faces" :animate="{ rotateY: reduced ? 0 : expanded ? 180 : 0 }" :transition="{ duration: reduced ? 0 : 0.4 }">
        <div class="achievement-face" :aria-hidden="expanded" :inert="expanded" :style="reduced && expanded ? { visibility: 'hidden' } : undefined">
          <PublicationImage :src="record.image" :alt="record.title" fit="contain" class="aspect-[4/3] w-full" />
          <div class="space-y-3 p-6"><time :datetime="record.milestoneDate || undefined" class="font-caption">{{ record.milestoneDate }}</time><h3 class="font-h2">{{ record.title }}</h3></div>
        </div>
        <div class="achievement-face achievement-back" :tabindex="expanded ? 0 : -1" :aria-hidden="!expanded" :inert="!expanded" :style="reduced ? { transform: 'none', visibility: expanded ? 'visible' : 'hidden' } : undefined">
          <div class="p-6"><h3 class="font-h2 mb-4">{{ record.title }}</h3><p class="font-body-md whitespace-pre-wrap">{{ record.content }}</p><RouterLink to="/about#about-heading-history" class="mt-6 inline-block font-label-sm underline">View school history</RouterLink></div>
        </div>
      </motion.div>
    </div>
    <button class="mx-6 mb-6 mt-4 min-h-11 border border-primary px-4 py-2 text-sm font-semibold" :aria-expanded="expanded" :aria-label="`${expanded ? 'Show overview' : 'Read milestone'}: ${record.title}`" @click="expanded = !expanded">{{ expanded ? 'Show overview' : 'Read milestone' }} <span aria-hidden="true">↻</span></button>
  </article>
</template>
