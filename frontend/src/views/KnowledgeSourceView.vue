<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import PublicLayout from '@/layouts/PublicLayout.vue';
import ApiAlert from '@/components/ApiAlert.vue';
import { api, errorMessage } from '@/api/client';
import type { ApiResponse } from '@/types/api';
const route=useRoute(),router=useRouter(),error=ref(''),loading=ref(true);
const document=ref<{id:string;title:string;description:string;category:string;edition:number;pageCount:number;publicOriginal:boolean;page:number;totalPages:number;chunks:{id:string;text:string;pageNumber:number}[]}|null>(null);
async function load(){error.value='';loading.value=true;try{document.value=(await api.get<ApiResponse<NonNullable<typeof document.value>>>(`/chatbot/documents/${route.params.id}`,{params:{page:Number(route.query.page)||1}})).data.data;await nextTick();if(route.hash)globalThis.document.getElementById(route.hash.slice(1))?.scrollIntoView({block:'center'});}catch(e){error.value=errorMessage(e);document.value=null;}finally{loading.value=false;}}
function page(number:number){void router.push({query:{page:number}});}
watch(()=>[route.params.id,route.query.page],()=>{void load();},{immediate:true});
</script>
<template><PublicLayout><section class="mx-auto max-w-4xl space-y-6 px-5 py-12"><h1 class="text-h1">{{document?.title||'School knowledge source'}}</h1><ApiAlert :message="error"/><button v-if="error" class="secondary-button" @click="load">Retry source</button><p v-if="loading" role="status">Loading approved source…</p><template v-if="document"><p>{{document.category}} · Edition {{document.edition}} · {{document.pageCount}} pages</p><p>{{document.description}}</p><p class="text-sm">These passages were reviewed for public school guidance. The PDF original is private unless the school explicitly authorizes its download.</p><a v-if="document.publicOriginal" :href="`${api.defaults.baseURL}/chatbot/documents/${document.id}/original`" class="underline">Download approved public PDF</a><article v-for="chunk in document.chunks" :id="`chunk-${chunk.id}`" :key="chunk.id" class="scroll-mt-28 space-y-3 border bg-white p-5"><h2 class="text-h2">Page {{chunk.pageNumber}}</h2><p class="whitespace-pre-wrap break-words">{{chunk.text}}</p></article><nav v-if="document.totalPages>1" aria-label="School source passages" class="flex flex-wrap items-center gap-4"><button class="secondary-button" :disabled="document.page<=1" @click="page(document.page-1)">Previous passages</button><span>{{document.page}} / {{document.totalPages}}</span><button class="secondary-button" :disabled="document.page>=document.totalPages" @click="page(document.page+1)">Next passages</button></nav></template></section></PublicLayout></template>
