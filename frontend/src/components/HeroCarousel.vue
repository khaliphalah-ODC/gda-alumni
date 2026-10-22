<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Swiper, SwiperSlide } from 'swiper/vue';
import { A11y, Autoplay, EffectFade, Keyboard } from 'swiper/modules';
import type { Swiper as SwiperInstance } from 'swiper';
import { useReducedMotion } from 'motion-v';
import SchoolPhoto from './SchoolPhoto.vue';
import { heroPhotos } from '@/assets/school-photos';
import 'swiper/css';
import 'swiper/css/effect-fade';
import 'swiper/css/a11y';

const reduced = useReducedMotion(), active = ref(0), playing = ref(false), root = ref<HTMLElement>();
let slider: SwiperInstance | undefined, observer: IntersectionObserver | undefined;
function stop() { slider?.autoplay?.stop(); playing.value = false; }
function select(index: number) { stop(); slider?.slideTo(index); }
function step(delta: number) { select((active.value + delta + heroPhotos.length) % heroPhotos.length); }
function toggle() {
  if (playing.value) stop();
  else if (!reduced.value && slider && !document.hidden) { playing.value = true; slider.autoplay.start(); }
}
function focusIn(event: FocusEvent) {
  // The explicit play control can start playback without immediately pausing it.
  if (!(event.target instanceof Element && event.target.closest('[data-play]'))) stop();
}
function visibility() { if (document.hidden) stop(); }
function pauseHover() { if (playing.value) slider?.autoplay.pause(); }
function resumeHover() { if (playing.value && !reduced.value && !document.hidden) slider?.autoplay.resume(); }
watch(reduced, (value) => { if (value) stop(); });
onMounted(() => {
  document.addEventListener('visibilitychange', visibility);
  observer = new IntersectionObserver(([entry]) => { if (!entry?.isIntersecting) stop(); }, { threshold: 0.1 });
  if (root.value) observer.observe(root.value);
});
onBeforeUnmount(() => { observer?.disconnect(); document.removeEventListener('visibilitychange', visibility); stop(); });
</script>
<template>
  <section ref="root" class="hero-carousel relative flex min-h-[600px] items-center overflow-hidden bg-primary"
    aria-label="School photographs" aria-roledescription="carousel" @focusin="focusIn" @mouseenter="pauseHover" @mouseleave="resumeHover"
    @keydown.left.prevent="step(-1)" @keydown.right.prevent="step(1)">
    <Swiper class="hero-photographs absolute! inset-0! h-full w-full" :modules="[A11y, Autoplay, EffectFade, Keyboard]"
      effect="fade" :fade-effect="{ crossFade: true }" :speed="reduced ? 0 : 650" :allow-touch-move="true"
      :autoplay="{ enabled: false, delay: 6500, disableOnInteraction: true, pauseOnMouseEnter: true }"
      :a11y="{ containerMessage: 'School photograph slideshow' }"
      @swiper="slider = $event" @slideChange="active = $event.activeIndex" @touchStart="stop">
      <SwiperSlide v-for="(photo, index) in heroPhotos" :key="photo.id" class="bg-primary"><SchoolPhoto :photo="photo" :eager="index === 0" /></SwiperSlide>
    </Swiper>
    <div aria-hidden="true" class="hero-shade pointer-events-none absolute inset-0 z-1"></div>
    <div class="hero-copy pointer-events-none relative z-2 w-full pb-20"><slot /></div>
    <div class="absolute inset-x-0 bottom-0 z-3 border-t border-white/15 bg-primary/90 text-white">
      <div class="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-4">
        <p class="text-xs text-slate-200" aria-live="off">{{ heroPhotos[active]?.caption }} <span class="ml-2 text-slate-400">{{ active + 1 }} / {{ heroPhotos.length }}</span></p>
        <div class="flex items-center gap-2">
          <button class="carousel-control" aria-label="Previous school photograph" @click="step(-1)"><span aria-hidden="true">←</span></button>
          <div class="flex gap-1" role="group" aria-label="Choose a school photograph"><button v-for="(photo, index) in heroPhotos" :key="photo.id" class="hero-dot" :aria-label="`Show ${photo.caption}`" :aria-pressed="active === index" @click="select(index)"><span :class="active === index ? 'bg-white' : 'bg-white/40'"></span></button></div>
          <button class="carousel-control" aria-label="Next school photograph" @click="step(1)"><span aria-hidden="true">→</span></button>
          <button data-play class="carousel-control px-3! text-xs" :disabled="!!reduced" :aria-pressed="playing" :aria-label="reduced ? 'Slideshow paused for reduced motion' : playing ? 'Pause slideshow' : 'Play slideshow'" @click="toggle">{{ playing ? 'Pause' : 'Play' }}</button>
        </div>
      </div>
    </div>
  </section>
</template>
