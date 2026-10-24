<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuth } from '@/stores/auth';
import { errorMessage } from '@/api/client';
const { user, logout } = useAuth(); const router = useRouter(); const route = useRoute(); const open = ref(false), error = ref('');
const links = computed(() => user.value?.role === 'SUPER_ADMIN' ? [
  { icon: 'settings', label: 'Platform overview', to: '/super-admin' },
  { icon: 'manage_accounts', label: 'Admin accounts', to: '/super-admin/admins' },
  { icon: 'chat', label: 'Chatbot settings', to: '/super-admin/chatbot' },
  { icon: 'tune', label: 'Platform settings', to: '/super-admin/settings' },
  { icon: 'person', label: 'Account Settings', to: '/account/settings' },
] : [
  { icon: 'dashboard', label: 'Dashboard', to: user.value?.role === 'ADMIN' ? '/admin' : '/dashboard' },
  ...(user.value?.role === 'ADMIN' ? [{ icon: 'chat', label: 'Chatbot school answers', to: '/admin/chatbot' }, { icon: 'group', label: 'Manage Alumni', to: '/admin/alumni' }, { icon: 'fact_check', label: 'Membership Applications', to: '/admin/membership' }, { icon: 'qr_code_2', label: 'Membership QR code', to: '/admin/membership/qr' }, { icon: 'description', label: 'Manage Requests', to: '/admin/requests' }, { icon: 'campaign', label: 'Manage Announcements', to: '/admin/content/announcements' }, { icon: 'auto_stories', label: 'Moderate Stories', to: '/admin/content/stories' }, { icon: 'event', label: 'Manage Events', to: '/admin/content/events' }, { icon: 'photo_library', label: 'Manage Gallery', to: '/admin/content/gallery' }, { icon: 'military_tech', label: 'Featured Achievements', to: '/admin/content/achievements' }, { icon: 'history_edu', label: 'Manage History', to: '/admin/content/history' }, { icon: 'groups', label: 'Manage Leadership', to: '/admin/content/leadership/school' }] : []),
  { icon: 'settings', label: 'Account Settings', to: '/account/settings' },
  { icon: 'group', label: 'Alumni Directory', to: '/alumni' },
  ...(user.value?.role === 'ALUMNI' ? [{ icon: 'person', label: 'My Profile', to: '/profile' }] : []),
  { icon: 'description', label: 'My Requests', to: '/requests' },
  { icon: 'add_circle', label: 'Submit Request', to: '/requests/new' },
  { icon: 'edit', label: 'My Stories', to: '/stories/mine' },
  { icon: 'auto_stories', label: 'Stories', to: '/stories' },
  { icon: 'campaign', label: 'Announcements', to: '/announcements' },
  { icon: 'event', label: 'Events', to: '/events' },
]);
const secondaryPaths = new Set(['/alumni', '/requests', '/requests/new', '/stories/mine', '/stories', '/announcements', '/events']);
const desktopLinks = computed(() => user.value?.role === 'ADMIN' ? links.value.filter(link => !secondaryPaths.has(link.to)) : links.value);
const secondaryLinks = computed(() => user.value?.role === 'ADMIN' ? links.value.filter(link => secondaryPaths.has(link.to)) : []);
async function signOut() { error.value = ''; try { await logout(); await router.push('/'); } catch (e) { error.value = errorMessage(e); } }
</script>
<template><header class="sticky top-0 z-50 flex flex-wrap items-center justify-between bg-primary-container px-5 py-4 text-white lg:hidden"><RouterLink to="/account/settings" class="flex items-center gap-2 font-bold"><img v-if="user?.profileImage" :src="user.profileImage" alt="Your profile" referrerpolicy="no-referrer" class="h-8 w-8 rounded-full object-cover">GDA Management</RouterLink><button aria-controls="mobile-dashboard-nav" :aria-expanded="open" @click="open = !open">{{ open ? 'Close menu' : 'Menu' }}</button><nav v-if="open" id="mobile-dashboard-nav" class="w-full space-y-1 pt-4"><RouterLink v-for="link in links" :key="link.to" :to="link.to" class="block py-2" @click="open = false">{{ link.label }}</RouterLink><button class="py-2" @click="signOut">Log out</button></nav><p v-if="error" role="alert" class="w-full pt-3">{{ error }}</p></header>
<aside class="fixed left-0 top-0 z-40 hidden h-screen w-sidebar-width border-r border-slate-200 bg-white lg:block"><div class="flex h-full flex-col"><div class="px-6 py-8"><RouterLink to="/" class="flex items-center gap-3"><span aria-hidden="true" class="material-symbols-outlined flex h-10 w-10 shrink-0 items-center justify-center rounded bg-primary-container text-white">{{ user?.role === 'ADMIN' ? 'shield' : 'school' }}</span><span><strong class="block text-lg font-black tracking-tight text-primary-container">GDA Management</strong><span class="block font-bold uppercase tracking-widest text-slate-500" :class="user?.role === 'ADMIN' ? 'text-[10px]' : 'mt-2 text-[11px]'">Ministry of Defense</span></span></RouterLink></div><nav aria-label="Portal navigation" class="flex-1 space-y-1 overflow-y-auto" :class="user?.role === 'ADMIN' ? 'px-6' : 'px-2'"><RouterLink v-for="link in desktopLinks" :key="link.to" :to="link.to" class="flex items-center gap-3 border-l-4 px-4 py-3 text-[13px] font-semibold hover:bg-slate-50" :class="(route.path === link.to || (link.to === '/admin/content/leadership/school' && route.path.startsWith('/admin/content/leadership/'))) ? 'border-primary-container bg-slate-50 text-primary' : 'border-transparent text-secondary'"><span aria-hidden="true" class="material-symbols-outlined">{{ link.icon }}</span>{{ link.label }}</RouterLink><details v-if="secondaryLinks.length" class="px-4 text-[13px] font-semibold text-secondary"><summary class="cursor-pointer py-3">Community &amp; personal services</summary><RouterLink v-for="link in secondaryLinks" :key="link.to" :to="link.to" class="flex items-center gap-3 py-3 hover:text-primary"><span aria-hidden="true" class="material-symbols-outlined">{{ link.icon }}</span>{{ link.label }}</RouterLink></details></nav><div class="border-t p-5"><RouterLink to="/help" class="mb-4 flex items-center gap-3 text-sm text-secondary"><span aria-hidden="true" class="material-symbols-outlined">help</span>Support</RouterLink><p v-if="error" role="alert" class="mb-3 text-sm text-error">{{ error }}</p><button class="flex items-center gap-3 text-sm font-semibold text-error" @click="signOut"><span aria-hidden="true" class="material-symbols-outlined">logout</span>Log out</button></div></div></aside></template>
