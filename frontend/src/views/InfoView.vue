<script setup lang="ts">
import SchoolPhoto from '@/components/SchoolPhoto.vue';
import { schoolPhotos } from '@/assets/school-photos';
import PublicLayout from '@/layouts/PublicLayout.vue';
import AboutContentSection from '@/components/AboutContentSection.vue';
</script>
<template><PublicLayout><div class="reference-ui max-w-7xl mx-auto px-6 py-12">
<!-- Hero Section -->
<section class="grid grid-cols-1 md:grid-cols-2 gap-12 items-center mb-24">
<div class="space-y-6">
<div class="inline-flex items-center gap-2 px-3 py-1 bg-primary-container text-white text-xs font-bold uppercase tracking-widest">
                    Gray D. Allison High School
                </div>
<h1 class="font-h1 text-h1 text-primary leading-tight">Legacy of Discipline and Excellence.</h1>
<p class="font-body-lg text-body-lg text-on-surface-variant max-w-xl">
                    Located within the Barclay Training Center in Monrovia, Gray D. Allison High School stands as a premier educational institution under the direct supervision of the Ministry of National Defense, Republic of Liberia.
                </p>
<div class="p-6 border-l-4 border-primary bg-surface-container-low">
<p class="font-body-md text-body-md italic text-primary">
                        Academic excellence, discipline and community connection.
                    </p>
</div>
</div>
<div class="relative h-[500px] overflow-hidden bg-slate-200">
<SchoolPhoto :photo="schoolPhotos.flagParade" />
</div>
</section>
<!-- Ministry Oversight Section -->
<section class="mb-24 py-12 px-8 bg-primary text-white text-center">
<div class="max-w-3xl mx-auto space-y-4">
<span aria-hidden="true" class="material-symbols-outlined text-4xl mb-2" data-icon="shield" style="font-variation-settings: 'FILL' 1;">shield</span>
<h2 class="font-h2 text-h2 uppercase tracking-wide">Ministry of National Defense Supervision</h2>
<p class="font-body-md text-body-md text-slate-300">
                    As an integral part of the Ministry of National Defense educational framework, Gray D. Allison High School maintains the highest standards of military-grade discipline combined with academic rigor. Our governance ensures a stable and focused environment for the children of military personnel and the wider Liberian community.
                </p>
</div>
</section>
<!-- Mission & Vision Cards -->
<section class="grid grid-cols-1 md:grid-cols-2 gap-8 mb-24">
<div class="p-10 border border-outline-variant bg-white shadow-sm flex flex-col gap-6">
<div class="w-12 h-12 flex items-center justify-center bg-primary-container text-white">
<span aria-hidden="true" class="material-symbols-outlined" data-icon="target">target</span>
</div>
<h3 class="font-h2 text-h2 text-primary">Our Mission</h3>
<p class="font-body-md text-body-md text-on-surface-variant">
                    To provide a high-quality educational experience that fosters academic excellence, leadership development, and unwavering discipline, preparing students for professional success and responsible citizenship in Liberia and the global community.
                </p>
</div>
<div class="p-10 border border-outline-variant bg-white shadow-sm flex flex-col gap-6">
<div class="w-12 h-12 flex items-center justify-center bg-primary-container text-white">
<span aria-hidden="true" class="material-symbols-outlined" data-icon="visibility">visibility</span>
</div>
<h3 class="font-h2 text-h2 text-primary">Our Vision</h3>
<p class="font-body-md text-body-md text-on-surface-variant">
                    To be the leading institutional high school in West Africa, recognized for producing disciplined leaders who excel in scientific, technological, and humanitarian fields, while upholding the values of national service and integrity.
                </p>
</div>
</section>
<AboutContentSection kind="history" />
<AboutContentSection kind="school" />
<AboutContentSection kind="alumni" /><section class="mb-12 flex flex-wrap items-center justify-between gap-6 border border-outline-variant bg-white p-8"><div><h2 class="font-h2 text-primary">Our school in photographs</h2><p class="font-body-md mt-2 text-secondary">Explore school life, graduation and the marching band.</p></div><RouterLink to="/gallery" class="secondary-button">View photo gallery</RouterLink></section>
</div></PublicLayout></template>
