<script setup lang="ts" generic="T extends { id: string }">
import { ref } from 'vue';
import { Swiper, SwiperSlide } from 'swiper/vue';
import { A11y, Keyboard, Navigation, Pagination } from 'swiper/modules';
import type { Swiper as SwiperInstance } from 'swiper';
import { useReducedMotion } from 'motion-v';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import 'swiper/css/a11y';

withDefaults(defineProps<{ items: readonly T[]; label: string; perView?: number }>(), { perView: 3 });
defineSlots<{ default(props: { item: T; index: number }): unknown }>();
const reduced = useReducedMotion();
const root = ref<HTMLElement>();
let slider: SwiperInstance | undefined;
function focusOut(event: FocusEvent) {
  if (!root.value?.contains(event.relatedTarget as Node | null)) slider?.keyboard?.disable();
}
</script>
<template>
  <div ref="root" class="content-carousel min-w-0" role="region" aria-roledescription="carousel" :aria-label="label"
    @focusin="slider?.keyboard?.enable()" @focusout="focusOut">
    <Swiper :key="items.map(item => item.id).join(',')" :modules="[A11y, Keyboard, Navigation, Pagination]"
      :slides-per-view="1" :space-between="24" :speed="reduced ? 0 : 380" :watch-overflow="true"
      :breakpoints="{ 640: { slidesPerView: Math.min(perView, 2) }, 1024: { slidesPerView: perView } }"
      :navigation="true" :pagination="{ clickable: true }" :keyboard="{ enabled: false, onlyInViewport: true, pageUpDown: false }"
      :a11y="{ prevSlideMessage: `Previous ${label}`, nextSlideMessage: `Next ${label}`, paginationBulletMessage: `Go to ${label} slide {{index}}` }"
      @swiper="slider = $event">
      <SwiperSlide v-for="(item, index) in items" :key="item.id"><slot :item="item" :index="index" /></SwiperSlide>
    </Swiper>
  </div>
</template>
