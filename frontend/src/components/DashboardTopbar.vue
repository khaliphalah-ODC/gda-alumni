<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useAuth } from '@/stores/auth';
const route = useRoute(), { user } = useAuth();
const label = computed(() => {
  if (route.path === '/admin' || route.path === '/dashboard' || route.path === '/super-admin') return 'Dashboard Overview';
  const names: Record<string, string> = { '/account/settings': 'Account Settings', '/admin/alumni': 'Alumni Management', '/admin/content/history': 'School History', '/admin/content/leadership/school': 'School Leadership', '/admin/content/leadership/alumni': 'Alumni Leadership', '/admin/membership': 'Membership Applications', '/admin/membership/qr': 'Membership QR code', '/admin/requests': 'Document Requests', '/alumni': 'Alumni Directory', '/profile': 'Alumni Profile', '/requests': 'My Requests', '/stories/mine': 'My Stories', '/super-admin/admins': 'Admin Accounts', '/super-admin/settings': 'Platform Settings' };
  return names[route.path] || 'Content Management';
});
const role = computed(() => ({ SUPER_ADMIN: 'Platform administrator', ADMIN: 'School administrator', ALUMNI: 'Alumni member', STUDENT: 'Visitor' }[user.value?.role || 'STUDENT']));
</script>
<template><header class="hidden h-16 items-center justify-between gap-6 border-b border-slate-200 bg-white px-8 lg:flex"><div class="flex min-w-0 items-center gap-2"><h2 v-if="route.path === '/admin'" class="text-h2 text-primary-container">Dashboard Overview</h2><span v-else class="text-xs uppercase tracking-wider text-secondary">Portal</span><span v-if="route.path !== '/admin'" aria-hidden="true" class="material-symbols-outlined text-sm text-outline">chevron_right</span><span v-if="route.path !== '/admin'" class="truncate text-sm font-semibold text-primary">{{ label }}</span></div><RouterLink to="/account/settings" class="flex min-w-0 items-center gap-3 border-l border-slate-200 pl-6" aria-label="Open account settings"><div class="min-w-0 text-right"><p class="max-w-64 truncate text-sm font-semibold text-primary">{{ user?.email }}</p><p class="text-xs text-secondary">{{ role }}</p></div><img v-if="user?.profileImage" :src="user.profileImage" alt="" referrerpolicy="no-referrer" class="h-10 w-10 rounded border border-slate-200 object-cover"><span v-else aria-hidden="true" class="material-symbols-outlined flex h-10 w-10 items-center justify-center rounded border border-slate-200 bg-slate-50 text-primary">person</span></RouterLink></header></template>
