<script setup lang="ts">
import { nextTick, ref } from 'vue';
import { motion, useReducedMotion } from 'motion-v';
import SchoolPhoto from './SchoolPhoto.vue';
import type { ExcellenceAchievement } from '@/assets/excellence';

withDefaults(defineProps<{ achievement: ExcellenceAchievement; index?: number }>(), { index: 0 });
const flipped = ref(false), reduced = useReducedMotion();
const exploreButton = ref<HTMLButtonElement>(), backButton = ref<HTMLButtonElement>();
async function flip(value: boolean) {
  flipped.value = value;
  await nextTick();
  // Let the browser apply inert/visibility changes before moving focus. This
  // matters when reduced motion hides the previously focused face immediately.
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  if (flipped.value === value) (value ? backButton.value : exploreButton.value)?.focus({ preventScroll: true });
}
</script>

<template>
  <motion.article class="excellence-card min-w-0 w-full max-w-md" :aria-label="achievement.category"
    :initial="reduced ? false : { opacity: 0, y: 24 }" :whileInView="{ opacity: 1, y: 0 }"
    :inViewOptions="{ once: true, amount: 0.12 }" :transition="{ duration: reduced ? 0 : 0.5, delay: reduced ? 0 : index * 0.12 }">
    <div class="excellence-card-lift">
      <div class="excellence-card-rotor" :class="{ 'is-flipped': flipped }">
        <div class="excellence-card-face excellence-card-front" :aria-hidden="flipped" :inert="flipped">
          <figure class="m-0"><div class="excellence-card-photo"><SchoolPhoto :photo="achievement.photo" /></div><figcaption class="border-b border-outline-variant px-5 py-2 text-xs text-secondary">{{ achievement.photo.caption }}</figcaption></figure>
          <div class="flex flex-1 flex-col items-start gap-3 p-5">
            <p class="text-xs font-bold uppercase tracking-widest text-primary-container">{{ achievement.category }}</p>
            <h3 class="excellence-card-heading text-primary">{{ achievement.title }}</h3>
            <p class="text-sm leading-relaxed text-on-surface-variant">{{ achievement.description }}</p>
            <button ref="exploreButton" type="button" class="excellence-card-action mt-auto" :aria-expanded="flipped" :aria-controls="`${achievement.id}-details`" :aria-label="`Explore achievement: ${achievement.title}`" @click="flip(true)">Explore Achievement <span aria-hidden="true" class="material-symbols-outlined">arrow_forward</span></button>
          </div>
        </div>
        <div :id="`${achievement.id}-details`" class="excellence-card-face excellence-card-back" :aria-hidden="!flipped" :inert="!flipped">
          <div class="flex h-full flex-col items-start gap-4 p-5">
            <div class="flex w-full flex-wrap items-center justify-between gap-4 border-b border-white/20 pb-3"><p class="text-xs font-bold uppercase tracking-widest text-slate-200">{{ achievement.category }}</p><span aria-hidden="true" class="material-symbols-outlined text-3xl">{{ index === 0 ? 'military_tech' : 'school' }}</span></div>
            <time :datetime="achievement.date" class="excellence-card-date">{{ achievement.dateLabel }}</time>
            <h3 class="excellence-card-heading">{{ achievement.heading }}</h3>
            <p class="text-sm leading-relaxed text-slate-100">{{ achievement.details }}</p>
            <a :href="achievement.source.url" target="_blank" rel="noopener noreferrer" class="excellence-card-source">{{ achievement.source.label }}<span class="sr-only"> (opens in a new tab)</span><span aria-hidden="true" class="material-symbols-outlined text-lg">open_in_new</span></a>
            <button ref="backButton" type="button" class="excellence-card-action excellence-card-action-light mt-auto" :aria-expanded="flipped" :aria-label="`Flip back: ${achievement.title}`" @click="flip(false)"><span aria-hidden="true" class="material-symbols-outlined">arrow_back</span>Flip Back</button>
          </div>
        </div>
      </div>
    </div>
  </motion.article>
</template>

<style scoped>
.excellence-card-heading { font-size: 20px; line-height: 1.3; font-weight: 600; overflow-wrap: anywhere; }
.excellence-card-lift { height: 100%; perspective: 1400px; transition: transform 300ms ease; }
.excellence-card-rotor { display: grid; height: 100%; transform-style: preserve-3d; transition: transform 600ms cubic-bezier(.22,.68,0,1); }
.excellence-card-rotor.is-flipped { transform: rotateY(180deg); }
.excellence-card-face { grid-area: 1 / 1; display: flex; flex-direction: column; min-width: 0; border: 1px solid #c3c6d1; border-radius: 8px; overflow: hidden; backface-visibility: hidden; -webkit-backface-visibility: hidden; background: white; box-shadow: 0 8px 24px #0319350a; }
.excellence-card-face[aria-hidden="true"] { pointer-events: none; }
.excellence-card-back { transform: rotateY(180deg); color: white; background: var(--color-primary, #031935); }
.excellence-card-photo { height: 192px; overflow: hidden; background: #e9edf1; }
.excellence-card-photo :deep(img) { transition: transform 600ms ease; }
.excellence-card-action { display: inline-flex; min-height: 44px; align-items: center; justify-content: center; gap: 12px; padding: 10px 12px; border: 1px solid currentColor; border-radius: 4px; color: #031935; font-size: 14px; font-weight: 600; text-align: left; }
.excellence-card-action:hover { background: #0319350a; }
.excellence-card-action-light { color: white; }
.excellence-card-action-light:hover { background: #ffffff15; }
.excellence-card-action:focus-visible, .excellence-card-source:focus-visible { outline: 3px solid #977400; outline-offset: 5px; }
.excellence-card-date { font-size: clamp(1.5rem, 4vw, 2rem); font-weight: 700; line-height: 1.2; letter-spacing: -.03em; }
.excellence-card-source { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; text-decoration: underline; text-underline-offset: 4px; overflow-wrap: anywhere; }
@media (hover: hover) and (prefers-reduced-motion: no-preference) {
  .excellence-card:hover .excellence-card-lift { transform: translateY(-5px); }
  .excellence-card:hover .excellence-card-photo :deep(img) { transform: scale(1.025); }
}
@media (prefers-reduced-motion: reduce) {
  /* The site's universal reduced-motion rule otherwise transitions inherited
     visibility too, temporarily preventing focus on the newly revealed face. */
  .excellence-card :deep(*) { transition: none !important; }
  .excellence-card-lift, .excellence-card-rotor, .excellence-card-photo :deep(img) { transition: none !important; transform: none; }
  .excellence-card-rotor.is-flipped, .excellence-card-back { transform: none; }
  .excellence-card-face[aria-hidden="true"] { visibility: hidden; }
}
</style>
