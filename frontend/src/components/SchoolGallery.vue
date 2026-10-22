<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { Swiper, SwiperSlide } from 'swiper/vue';
import { A11y, Navigation, Pagination } from 'swiper/modules';
import type { Swiper as SwiperInstance } from 'swiper';
import { motion, useReducedMotion } from 'motion-v';
import ContentCarousel from './ContentCarousel.vue';
import MotionCard from './MotionCard.vue';
import SchoolPhoto from './SchoolPhoto.vue';
import { galleryPhotos, type SchoolPhoto as Photo } from '@/assets/school-photos';

const categories = ['All photos', 'School life', 'Parade', 'Graduation'] as const;
const category = ref<(typeof categories)[number]>('All photos');
const photos = computed(() => galleryPhotos.filter(photo => category.value === 'All photos' || photo.category === category.value));
const dialog = ref<HTMLDialogElement>(), open = ref(false), selected = ref(0), reduced = useReducedMotion();
let slider: SwiperInstance | undefined, previousFocus: HTMLElement | null = null, previousOverflow = '';
async function preview(photo: Photo, event: MouseEvent) {
  previousFocus = event.currentTarget as HTMLElement;
  selected.value = photos.value.findIndex(item => item.id === photo.id);
  previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
  open.value = true;
  await nextTick(); dialog.value?.showModal();
  dialog.value?.querySelector<HTMLButtonElement>('[data-close]')?.focus();
  slider?.update();
}
function closed() {
  open.value = false; document.body.style.overflow = previousOverflow;
  previousFocus?.focus({ preventScroll: true });
}
function close() { dialog.value?.close(); }
function backdrop(event: MouseEvent) { if (event.target === dialog.value) close(); }
function keyboard(event: KeyboardEvent) {
  if (event.key === 'ArrowRight') { event.preventDefault(); slider?.slideNext(); }
  if (event.key === 'ArrowLeft') { event.preventDefault(); slider?.slidePrev(); }
}
watch(category, () => { selected.value = 0; });
onBeforeUnmount(() => { if (open.value) { dialog.value?.close(); document.body.style.overflow = previousOverflow; } });
</script>
<template>
  <section aria-label="School photo gallery" class="min-w-0">
    <div class="mb-8 flex flex-wrap gap-2" role="group" aria-label="Filter photographs"><button v-for="name in categories" :key="name" class="min-h-11 border border-outline-variant px-4 py-2 text-sm" :class="category === name ? 'bg-primary text-white' : 'bg-white text-primary'" :aria-pressed="category === name" @click="category = name">{{ name }}</button></div>
    <p class="sr-only" role="status">{{ photos.length }} photographs in {{ category.toLowerCase() }}</p>
    <ContentCarousel :items="photos" label="school gallery" :per-view="3"><template #default="{ item, index }">
      <MotionCard :index="index" class="h-full"><button class="group block h-full w-full border border-outline-variant bg-white text-left" :aria-label="`Preview ${item.caption}`" @click="preview(item, $event)"><div class="aspect-[4/3] bg-surface-container-high"><SchoolPhoto :photo="item" /></div><span class="flex items-center justify-between gap-4 p-6"><span class="font-label-sm text-primary">{{ item.caption }}</span><span aria-hidden="true" class="material-symbols-outlined text-primary">open_in_full</span></span></button></MotionCard>
    </template></ContentCarousel>
    <dialog ref="dialog" class="gallery-dialog" aria-label="School photograph preview" @close="closed" @keydown="keyboard" @click="backdrop">
      <motion.div v-if="open" :initial="reduced ? false : { opacity: 0, scale: 0.98 }" :animate="{ opacity: 1, scale: 1 }" :transition="{ duration: reduced ? 0 : 0.18 }" class="gallery-dialog-content">
        <div class="flex items-center justify-between gap-4 px-5 py-3"><h2 class="font-label-sm">School photograph preview</h2><button data-close class="carousel-control px-4!" aria-label="Close photograph preview" @click="close">Close <span aria-hidden="true">×</span></button></div>
        <Swiper :modules="[A11y, Navigation, Pagination]" :initial-slide="selected" :speed="reduced ? 0 : 300" :navigation="true" :pagination="{ type: 'fraction' }" class="lightbox-carousel content-carousel"
          :a11y="{ prevSlideMessage: 'Previous preview photograph', nextSlideMessage: 'Next preview photograph' }" @swiper="slider = $event">
          <SwiperSlide v-for="photo in photos" :key="photo.id"><figure><div class="preview-photo"><SchoolPhoto :photo="photo" /></div><figcaption class="px-6 py-4 text-center text-sm">{{ photo.caption }}</figcaption></figure></SwiperSlide>
        </Swiper>
      </motion.div>
    </dialog>
  </section>
</template>
