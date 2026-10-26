<script setup lang="ts">
import AchievementFlipCard from './AchievementFlipCard.vue';
import { excellenceAchievements } from '@/assets/excellence';
import type { ExcellenceAchievement } from '@/assets/excellence';
import { computed } from 'vue';
import { useManagedCollection } from '@/composables/useManagedCollection';
import ApiAlert from './ApiAlert.vue';
const collection = useManagedCollection('achievements');
const achievements = computed<readonly ExcellenceAchievement[]>(() => !collection.resolved.value ? [] : !collection.managed.value ? excellenceAchievements : collection.items.value.map(item => ({
  id: item.id, category: item.category || 'School achievement', title: item.title, description: item.summary || '', heading: item.heading || item.title,
  date: item.milestoneDate || '', dateLabel: !item.milestoneDate || item.milestoneDate.length === 4 ? item.milestoneDate || '' : new Date(`${item.milestoneDate.slice(0, 7)}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
  details: item.content, source: { url: item.sourceUrl || '', label: item.sourceLabel || 'Source' },
  photo: { id: item.id, src: item.image!, width: item.imageWidth || 1200, height: item.imageHeight || 900, alt: item.imageAlt, caption: item.imageCaption || item.title, category: item.category || 'School achievement' },
})));
</script>

<template>
  <section aria-labelledby="excellence-heading" class="border-y border-outline-variant bg-surface-container-low py-16 sm:py-24">
    <div class="mx-auto max-w-7xl px-6">
      <header class="mb-10 max-w-3xl space-y-5"><p class="font-label-sm uppercase tracking-[0.2em] text-primary-container">THE GRAY D. ALLISON LEGACY</p><h2 id="excellence-heading" class="font-h1 text-primary">Excellence in Discipline &amp; Academics</h2><p class="font-body-lg text-on-surface-variant">Celebrating the discipline, determination, teamwork, and academic achievements that contribute to the legacy of Gray D. Allison High School.</p></header>
      <p v-if="collection.loading.value" role="status">Loading achievements…</p><ApiAlert :message="collection.error.value"/><button v-if="collection.error.value" class="secondary-button" @click="collection.load">Retry achievements</button><p v-if="collection.resolved.value && !achievements.length && !collection.error.value">No featured achievements are published.</p>
      <div class="mx-auto grid max-w-[920px] justify-items-center items-stretch gap-6 lg:grid-cols-2"><AchievementFlipCard v-for="(achievement, index) in achievements" :key="achievement.id" :achievement="achievement" :index="index" /></div>
      <div class="mt-10 flex flex-wrap items-center justify-between gap-6 border-t border-outline-variant pt-8"><RouterLink to="/about#about-heading-history" class="primary-button">Explore School History &amp; Achievements<span aria-hidden="true" class="material-symbols-outlined">arrow_forward</span></RouterLink><RouterLink to="/gallery" class="inline-flex min-h-11 items-center gap-2 font-label-sm text-primary underline">View school photo gallery<span aria-hidden="true" class="material-symbols-outlined">photo_library</span></RouterLink></div>
    </div>
  </section>
</template>
