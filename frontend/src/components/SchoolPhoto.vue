<script setup lang="ts">
import type { SchoolPhoto } from '@/assets/school-photos';
withDefaults(defineProps<{ photo: SchoolPhoto; eager?: boolean; decorative?: boolean }>(), { eager: false, decorative: false });
</script>
<template>
  <img :src="photo.src" :alt="decorative ? '' : photo.alt" :width="photo.width" :height="photo.height"
    :loading="eager ? 'eager' : 'lazy'" :fetchpriority="eager ? 'high' : 'auto'" decoding="async"
    class="school-photo h-full w-full object-contain object-center" />
</template>
