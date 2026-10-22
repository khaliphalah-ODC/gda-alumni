<script setup lang="ts">
import AchievementFlipCard from './AchievementFlipCard.vue';
import { excellenceAchievements } from '@/assets/excellence';
</script>

<template>
  <section aria-labelledby="excellence-heading" class="border-y border-outline-variant bg-surface-container-low py-16 sm:py-24">
    <div class="mx-auto max-w-7xl px-6">
      <header class="mb-10 max-w-3xl space-y-5"><p class="font-label-sm uppercase tracking-[0.2em] text-primary-container">THE GRAY D. ALLISON LEGACY</p><h2 id="excellence-heading" class="font-h1 text-primary">Excellence in Discipline &amp; Academics</h2><p class="font-body-lg text-on-surface-variant">Celebrating the discipline, determination, teamwork, and academic achievements that contribute to the legacy of Gray D. Allison High School.</p></header>
      <div class="grid items-stretch gap-8 lg:grid-cols-2"><AchievementFlipCard v-for="(achievement, index) in excellenceAchievements" :key="achievement.id" :achievement="achievement" :index="index" /></div>
      <div class="mt-10 flex flex-wrap items-center justify-between gap-6 border-t border-outline-variant pt-8"><RouterLink to="/about#about-heading-history" class="primary-button">Explore School History &amp; Achievements<span aria-hidden="true" class="material-symbols-outlined">arrow_forward</span></RouterLink><RouterLink to="/gallery" class="inline-flex min-h-11 items-center gap-2 font-label-sm text-primary underline">View school photo gallery<span aria-hidden="true" class="material-symbols-outlined">photo_library</span></RouterLink></div>
    </div>
  </section>
</template>
