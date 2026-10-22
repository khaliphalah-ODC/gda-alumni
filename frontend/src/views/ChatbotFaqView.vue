<script setup lang="ts">
import { onMounted, ref } from 'vue';
import PublicLayout from '@/layouts/PublicLayout.vue';
import ApiAlert from '@/components/ApiAlert.vue';
import { api, errorMessage } from '@/api/client';
import type { ApiResponse } from '@/types/api';
const items=ref<{id:string;question:string;answer:string;path:string;updatedAt:string}[]>([]),error=ref(''),loading=ref(true);
async function load(){loading.value=true;error.value='';try{items.value=(await api.get<ApiResponse<typeof items.value>>('/chatbot/faqs')).data.data;}catch(e){error.value=errorMessage(e);}finally{loading.value=false;}}
onMounted(load);
</script>
<template><PublicLayout><section class="mx-auto max-w-3xl space-y-6 px-5 py-12"><h1 class="text-h1">School-approved answers</h1><ApiAlert :message="error"/><button v-if="error" class="secondary-button" @click="load">Retry</button><p v-if="loading" role="status">Loading answers…</p><p v-else-if="!items.length">No approved answers are published yet. Please contact the school for confirmed information.</p><article v-for="item in items" :id="`faq-${item.id}`" :key="item.id" class="space-y-3 border bg-white p-6"><h2 class="text-h2">{{item.question}}</h2><p class="whitespace-pre-wrap">{{item.answer}}</p><p class="text-sm text-secondary">Updated {{new Date(item.updatedAt).toLocaleDateString()}}</p><RouterLink :to="item.path" class="underline">Related portal page</RouterLink></article></section></PublicLayout></template>
