<script setup lang="ts">
import { useRoute } from 'vue-router';
import DashboardSidebar from '@/components/DashboardSidebar.vue';
import DashboardTopbar from '@/components/DashboardTopbar.vue';
const route = useRoute();
</script>
<template><div class="dashboard-ui min-h-screen" :class="route.path === '/admin' ? 'bg-[#f8fafc]' : 'bg-background'"><DashboardSidebar/><div class="lg:ml-sidebar-width"><DashboardTopbar v-if="!['/requests/new', '/admin/alumni'].includes(route.path)"/><main id="main-content" tabindex="-1"><slot/></main></div></div></template>
