<script setup lang="ts">
import PublicLayout from '@/layouts/PublicLayout.vue';
import SchoolGallery from '@/components/SchoolGallery.vue';
</script>
<template><PublicLayout><div class="reference-ui mx-auto max-w-7xl px-6 py-12"><header class="mb-12 max-w-3xl space-y-4"><span class="font-label-sm uppercase tracking-widest text-primary-container">Our community</span><h1 class="font-h1 text-primary">School Photo Gallery</h1><p class="font-body-lg text-secondary">A glimpse of school life, music and graduation from the Gray D. Allison community.</p></header><SchoolGallery /><RouterLink to="/about" class="mt-10 inline-block font-label-sm text-primary underline">Explore our school history</RouterLink></div></PublicLayout></template>
