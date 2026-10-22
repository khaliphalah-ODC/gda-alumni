<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
const reference = ref('');
const router = useRouter();
function track() { void router.push({ path: '/requests', query: { request: reference.value.trim() } }); }
</script>
<template><form class="space-y-4" @submit.prevent="track"><label for="service-tracking-id" class="sr-only">Document tracking ID</label><input id="service-tracking-id" v-model.trim="reference" class="w-full border border-outline bg-white px-4 py-2 text-sm outline-none focus:border-primary" placeholder="Enter Tracking ID" required pattern="c[a-z0-9]{24}" title="Enter the request reference from your submission receipt"><button class="w-full border-2 border-primary px-6 py-2 text-label-sm font-bold text-primary transition hover:bg-primary hover:text-white">TRACK STATUS</button></form></template>
