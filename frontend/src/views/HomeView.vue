<script setup lang="ts">
import { onMounted, onScopeDispose, reactive, ref } from 'vue';
import PublicLayout from '@/layouts/PublicLayout.vue';
import HeroCarousel from '@/components/HeroCarousel.vue';
import SchoolPhoto from '@/components/SchoolPhoto.vue';
import ContentCarousel from '@/components/ContentCarousel.vue';
import MotionCard from '@/components/MotionCard.vue';
import AchievementCard from '@/components/AchievementCard.vue';
import ExcellenceShowcase from '@/components/ExcellenceShowcase.vue';
import PublicationImage from '@/components/PublicationImage.vue';
import { schoolPhotos } from '@/assets/school-photos';
import type { AboutRecord } from '@/types/api';
import ApiAlert from '@/components/ApiAlert.vue';
import { api, errorMessage } from '@/api/client';
import { contentEndpoint, type ContentKind } from '@/utils/content';
import type { ApiResponse, Post } from '@/types/api';
const announcements = ref<Post[]>([]), stories = ref<Post[]>([]), events = ref<Post[]>([]), loading = ref(true);
const milestones = ref<AboutRecord[]>([]), milestoneError = ref('');
const errors = reactive<Record<ContentKind, string>>({ announcements: '', stories: '', events: '' });
const portalLinks = [{to:'/alumni',title:'Connect',label:'Alumni directory'},{to:'/membership/status',title:'Track',label:'Membership status'},{to:'/announcements',title:'Discover',label:'School updates'},{to:'/login',title:'Access',label:'Your dashboard'}];
function datePart(value: string, part: 'day' | 'month') { return new Date(value).toLocaleDateString('en-GB', part === 'day' ? { day: '2-digit' } : { month: 'short' }); }
async function load() {
 if (loading.value && loaded) return;
 loaded = true; loading.value = true;
 controller?.abort(); const current = new AbortController(); controller = current;
 const kinds: ContentKind[] = ['announcements', 'stories', 'events'];
 const targets = [announcements, stories, events];
 await Promise.allSettled([...kinds.map(async (kind, index) => {
  errors[kind] = '';
  try { targets[index]!.value = (await api.get<ApiResponse<Post[]>>(contentEndpoint(kind), {signal:current.signal,params:{scope:'public',limit:kind === 'stories' ? 6 : kind === 'events' ? 8 : 3}})).data.data; }
  catch (error) { if (!current.signal.aborted) errors[kind] = errorMessage(error); }
 }), (async () => {
   milestoneError.value = '';
   try { milestones.value = (await api.get<ApiResponse<AboutRecord[]>>('/history', { signal: current.signal, params: { scope: 'public', limit: 6, historyOrder: 'chronological' } })).data.data; }
   catch (error) { if (!current.signal.aborted) milestoneError.value = errorMessage(error); }
 })()]);
 if (!current.signal.aborted) loading.value = false;
}
onScopeDispose(() => controller?.abort());
let loaded = false;
let controller: AbortController | undefined;
onMounted(load);
</script>
<template><PublicLayout><div class="reference-ui">
<!-- Hero Section -->
<HeroCarousel>
<div class="relative max-w-7xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-12 items-center">
<div class="space-y-8">
<h1 class="font-h1 text-white text-[48px] md:text-[56px] leading-[1.1]">
                        Gray D. Allison Alumni and Information Management System
                    </h1>
<p class="font-body-lg text-slate-300 max-w-lg">
                        The official gateway for the Gray D. Allison High School community. Securely manage academic records, connect with fellow alumni, and stay updated with school developments under the Ministry of National Defense.
                    </p>
<div class="flex flex-col sm:flex-row gap-4">
<RouterLink to="/register" class="bg-primary-fixed text-on-primary-fixed px-8 py-4 font-label-sm rounded-lg flex items-center justify-center gap-2 hover:bg-white transition-all">
                            JOIN ALUMNI NETWORK
                            <span aria-hidden="true" class="material-symbols-outlined">chevron_right</span>
</RouterLink>
<RouterLink to="/requests/new" class="border border-white/30 bg-white/10 backdrop-blur-md text-white px-8 py-4 font-label-sm rounded-lg hover:bg-white/20 transition-all">
                            REQUEST DOCUMENT
                        </RouterLink>
</div>
</div>
<div class="hidden md:block">
<div class="bg-primary/65 border border-white/20 p-8 rounded-xl backdrop-blur-xl">
<div class="grid grid-cols-2 gap-6">
<RouterLink v-for="item in portalLinks" :key="item.to" :to="item.to" class="space-y-2 hover:opacity-80"><p class="text-on-primary-container font-h1 text-[32px]">{{ item.title }}</p><p class="text-slate-200 font-caption uppercase tracking-widest">{{ item.label }}</p></RouterLink>
</div>
</div>
</div>
</div>
</HeroCarousel>
<!-- Institutional About Preview -->
<section class="py-24 bg-white">
<div class="max-w-7xl mx-auto px-6">
<div class="grid md:grid-cols-2 gap-16 items-center">
<div class="relative">
<div class="absolute -top-4 -left-4 w-24 h-24 bg-primary-container/10 -z-10"></div>
<div class="aspect-[3/2] overflow-hidden rounded-lg border border-outline-variant bg-surface-container-high shadow-2xl"><SchoolPhoto :photo="schoolPhotos.schoolGroup" /></div>
</div>
<div class="space-y-6">
<div class="flex items-center gap-4">
<div class="h-[2px] w-12 bg-primary"></div>
<span class="font-label-sm text-primary uppercase tracking-[0.2em]">Institutional Profile</span>
</div>
<h2 class="font-h1 text-primary">A Legacy of Discipline and Excellence</h2>
<p class="font-body-md text-on-surface-variant">
                            Gray D. Allison High School brings its alumni community together through academic records, school updates and shared experiences. This portal supports graduates as they stay connected with the school and one another.
                        </p>
<p class="font-body-md text-on-surface-variant">
                            The Alumni &amp; Information Management System (AIMS) is our digital leap forward, ensuring that every graduate remains connected to their alma mater and has seamless access to their essential academic credentials.
                        </p>
<RouterLink to="/about" class="text-primary font-label-sm border-b-2 border-primary pb-1 hover:text-on-primary-container hover:border-on-primary-container transition-colors">LEARN MORE ABOUT OUR MISSION</RouterLink>
</div>
</div>
</div>
</section>
<ExcellenceShowcase />
<!-- Services Bento Grid -->
<section class="py-24 bg-surface-container-low">
<div class="max-w-7xl mx-auto px-6">
<div class="text-center mb-16 space-y-4">
<h2 class="font-h1 text-primary">Credential Services</h2>
<p class="font-body-md text-on-surface-variant max-w-2xl mx-auto">Request academic documents through your approved and activated alumni account.</p>
</div>
<div class="grid md:grid-cols-3 gap-6">
<!-- Certificate Card -->
<div class="md:col-span-2 bg-white p-8 border border-outline-variant rounded-lg flex flex-col justify-between hover:shadow-lg transition-all">
<div class="space-y-4">
<span aria-hidden="true" class="material-symbols-outlined text-primary text-[40px]" data-weight="fill">verified</span>
<h3 class="font-h2 text-primary">Academic Certificates</h3>
<p class="font-body-md text-on-surface-variant max-w-md">Submit a request for your academic certificate and follow the registrar’s review in your portal.</p>
</div>
<div class="mt-8 flex gap-4">
<RouterLink to="/requests/new?type=CERTIFICATE" class="bg-primary text-white px-6 py-3 font-label-sm rounded-lg hover:opacity-90">START REQUEST</RouterLink>
<RouterLink to="/help" class="text-primary font-label-sm px-6 py-3">VIEW REQUIREMENTS</RouterLink>
</div>
</div>
<!-- Transcript Card -->
<div class="bg-primary-container p-8 rounded-lg flex flex-col justify-between text-white border border-primary">
<div class="space-y-4">
<span aria-hidden="true" class="material-symbols-outlined text-primary-fixed-dim text-[40px]">description</span>
<h3 class="font-h2">Official Transcripts</h3>
<p class="text-slate-300 font-body-md">Complete academic records for university applications or professional background checks.</p>
</div>
<RouterLink to="/requests/new?type=TRANSCRIPT" class="mt-8 border border-white/30 bg-white/10 px-6 py-3 font-label-sm rounded-lg hover:bg-white/20 transition-all uppercase tracking-wider">APPLY NOW</RouterLink>
</div>
<!-- Diplomas -->
<div class="bg-white p-8 border border-outline-variant rounded-lg flex flex-col justify-between hover:shadow-lg transition-all">
<div class="space-y-4">
<span aria-hidden="true" class="material-symbols-outlined text-primary text-[40px]">military_tech</span>
<h3 class="font-h2 text-primary">Diplomas</h3>
<p class="font-body-md text-on-surface-variant">Request archived diplomas through the school Records Office.</p>
</div>
<RouterLink to="/requests/new?type=DIPLOMA" class="mt-8 text-primary font-label-sm border-t border-outline-variant pt-4 flex items-center gap-2">RECOVER DIPLOMA <span aria-hidden="true" class="material-symbols-outlined text-sm">arrow_forward</span></RouterLink>
</div>
<!-- WAEC -->
<div class="md:col-span-2 bg-white p-8 border border-outline-variant rounded-lg flex items-center gap-8 hover:shadow-lg transition-all">
<div class="h-full w-48 bg-surface-container-high rounded-lg overflow-hidden flex-shrink-0">
<div class="flex h-full min-h-40 items-center justify-center text-primary/40" aria-hidden="true"><span class="material-symbols-outlined text-5xl">description</span></div>
</div>
<div class="space-y-4">
<h3 class="font-h2 text-primary">WAEC/WASSCE Results</h3>
<p class="font-body-md text-on-surface-variant">Assistance in retrieving official West African Examinations Council results archived at the school registrar's office.</p>
<RouterLink to="/requests/new?type=WAEC_CERTIFICATE" class="bg-surface-container-highest text-primary px-6 py-2 font-label-sm rounded-lg hover:bg-outline-variant transition-all">SUBMIT INQUIRY</RouterLink>
</div>
</div>
</div>
</div>
</section>
<!-- Live published content -->
<section class="py-24 bg-white border-t border-outline-variant"><div class="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 [&>div]:min-w-0">
<div><div class="flex flex-wrap gap-4 justify-between items-end mb-10"><div><span class="font-label-sm text-primary uppercase tracking-[0.2em] block mb-2">Notice Board</span><h2 class="font-h1 text-primary">Latest Announcements</h2></div><RouterLink to="/announcements" class="text-primary font-label-sm hover:underline">View All News</RouterLink></div>
<p v-if="loading" role="status">Loading announcements…</p><ApiAlert :message="errors.announcements"/><button v-if="errors.announcements" class="secondary-button mb-6" @click="load">Retry updates</button>
<div class="space-y-8"><RouterLink v-for="post in announcements" :key="post.id" :to="`/announcements/${post.id}`" class="flex gap-6 group"><time :datetime="post.publishedAt || post.createdAt" class="bg-surface-container-high w-20 h-20 flex flex-col items-center justify-center rounded-lg shrink-0"><span class="text-[20px] font-bold text-primary">{{ datePart(post.publishedAt || post.createdAt, 'day') }}</span><span class="text-[10px] uppercase font-bold text-on-surface-variant">{{ datePart(post.publishedAt || post.createdAt, 'month') }}</span></time><div><h3 class="font-h2 text-[18px] group-hover:text-primary-container mb-2">{{ post.title }}</h3><p class="text-on-surface-variant font-body-md line-clamp-2">{{ post.content }}</p></div></RouterLink><p v-if="!loading && !errors.announcements && !announcements.length">No announcements published yet.</p></div></div>
<div class="bg-surface-container-lowest border border-outline-variant p-6 sm:p-8 rounded-lg relative overflow-hidden min-w-0"><div aria-hidden="true" class="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16"></div><span class="font-label-sm text-primary uppercase tracking-[0.2em] block mb-2">Alumni Impact</span><h2 class="font-h1 text-primary mb-10">Success Stories</h2><p v-if="loading" role="status">Loading stories…</p><ApiAlert :message="errors.stories"/><button v-if="errors.stories" class="secondary-button mb-6" @click="load">Retry stories</button><ContentCarousel v-if="stories.length" :items="stories" label="alumni stories" :per-view="1"><template #default="{ item: post, index }"><MotionCard :index="index"><article class="border-l-4 border-primary pl-6 py-2"><p class="font-body-md italic text-on-surface-variant mb-4 line-clamp-3">{{ post.content }}</p><RouterLink :to="`/stories/${post.id}`" class="flex items-center gap-4 font-label-sm text-primary hover:underline"><PublicationImage v-if="post.image" :src="post.image" class="w-12 h-12 shrink-0 rounded-full" />{{ post.title }}</RouterLink></article></MotionCard></template></ContentCarousel><p v-if="!loading && !errors.stories && !stories.length">No alumni stories published yet.</p><RouterLink to="/stories" class="inline-block mt-8 font-label-sm text-primary underline">Explore alumni stories</RouterLink></div>
</div></section>
<section class="py-24 bg-primary text-white"><div class="max-w-7xl mx-auto px-6"><div class="flex flex-wrap gap-6 justify-between items-end mb-12"><div><span class="font-label-sm text-primary-fixed-dim uppercase tracking-[0.2em] block mb-2">Calendar</span><h2 class="font-h1">Upcoming Events</h2></div><RouterLink to="/events" class="bg-white/10 hover:bg-white/20 border border-white/20 px-6 py-2 rounded-lg font-label-sm uppercase tracking-wider">VIEW FULL CALENDAR</RouterLink></div><p v-if="loading" role="status">Loading events…</p><div v-if="errors.events" role="alert" class="mb-6"><p>{{ errors.events }}</p><button class="mt-3 underline" @click="load">Retry events</button></div><ContentCarousel v-if="events.length" :items="events" label="upcoming events" :per-view="4"><template #default="{ item: event, index }"><MotionCard :index="index" class="h-full"><RouterLink :to="`/events/${event.id}`" class="block h-full bg-white/5 border border-white/10 rounded-lg hover:bg-white/10"><PublicationImage v-if="event.image" :src="event.image" fit="contain" class="aspect-video" /><div class="p-6"><time v-if="event.eventDate" :datetime="event.eventDate" class="block text-primary-fixed-dim font-bold text-[24px] mb-4">{{ datePart(event.eventDate, 'month') }} {{ datePart(event.eventDate, 'day') }}</time><h3 class="font-h2 text-[18px] mb-2">{{ event.title }}</h3><p class="text-slate-300 font-caption">{{ event.eventLocation }}</p></div></RouterLink></MotionCard></template></ContentCarousel><p v-if="!loading && !errors.events && !events.length">No upcoming events published yet.</p></div></section>
<section class="py-24 bg-white"><div class="max-w-7xl mx-auto px-6"><div class="mb-12 flex flex-wrap items-end justify-between gap-6"><div><span class="font-label-sm text-primary uppercase tracking-[0.2em] block mb-2">School milestones</span><h2 class="font-h1 text-primary">Our History &amp; Achievements</h2></div><RouterLink to="/about#about-heading-history" class="font-label-sm text-primary underline">Explore school history</RouterLink></div><p v-if="loading" role="status">Loading school milestones…</p><ApiAlert :message="milestoneError" /><button v-if="milestoneError" class="secondary-button mb-6" @click="load">Retry school milestones</button><ContentCarousel v-if="milestones.length" :items="milestones" label="school milestones" :per-view="3"><template #default="{ item, index }"><MotionCard :index="index" class="h-full"><AchievementCard :record="item" /></MotionCard></template></ContentCarousel><p v-if="!loading && !milestoneError && !milestones.length" class="text-secondary">Verified school milestones will appear once published by the school.</p><RouterLink to="/gallery" class="mt-8 inline-flex items-center gap-2 font-label-sm text-primary underline">View school photographs<span aria-hidden="true" class="material-symbols-outlined">photo_library</span></RouterLink></div></section>
<!-- Document Process -->
<section class="py-24 bg-surface">
<div class="max-w-7xl mx-auto px-6">
<div class="text-center mb-16">
<h2 class="font-h1 text-primary">How to Request Your Documents</h2>
<p class="font-body-md text-on-surface-variant mt-4">A simple 3-step process to access your academic history.</p>
</div>
<div class="grid md:grid-cols-3 gap-12 relative">
<div class="hidden md:block absolute top-10 left-0 w-full h-[2px] bg-slate-200 -z-10"></div>
<div class="bg-white p-8 rounded-lg border border-outline-variant text-center space-y-4">
<div class="w-20 h-20 bg-primary text-white rounded-full flex items-center justify-center font-h1 mx-auto border-8 border-surface">1</div>
<h4 class="font-h2">Identity Verification</h4>
<p class="font-body-md text-on-surface-variant">Apply using your school details. After administrator approval, activate your account using your private invitation.</p>
</div>
<div class="bg-white p-8 rounded-lg border border-outline-variant text-center space-y-4">
<div class="w-20 h-20 bg-primary text-white rounded-full flex items-center justify-center font-h1 mx-auto border-8 border-surface">2</div>
<h4 class="font-h2">Select Document</h4>
<p class="font-body-md text-on-surface-variant">Choose a transcript, certificate or diploma and provide your school information, contact phone and purpose.</p>
</div>
<div class="bg-white p-8 rounded-lg border border-outline-variant text-center space-y-4">
<div class="w-20 h-20 bg-primary text-white rounded-full flex items-center justify-center font-h1 mx-auto border-8 border-surface">3</div>
<h4 class="font-h2">Secure Processing</h4>
<p class="font-body-md text-on-surface-variant">Track the review status and registrar notes until your document is ready for pickup. Confirm any fees with the Records Office.</p>
</div>
</div>
</div>
</section>
</div></PublicLayout></template>
