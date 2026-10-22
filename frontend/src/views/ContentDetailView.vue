<script setup lang="ts">
import { onScopeDispose, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import PublicLayout from '@/layouts/PublicLayout.vue';
import ApiAlert from '@/components/ApiAlert.vue';
import { api, errorMessage } from '@/api/client';
import { contentEndpoint, contentLabel, type ContentKind } from '@/utils/content';
import type { ApiResponse, Post } from '@/types/api';
const props = defineProps<{ type: ContentKind }>(); const route = useRoute();
const attempt = ref(0); const retry = () => { attempt.value++; };
const post = ref<Post | null>(null), loading = ref(true), error = ref('');
let controller: AbortController | undefined;
onScopeDispose(() => controller?.abort());
watch(() => [props.type, route.params.id, attempt.value], async () => { controller?.abort(); const current = new AbortController(); controller = current; loading.value = true; error.value = ''; post.value = null; try { post.value = (await api.get<ApiResponse<Post>>(`${contentEndpoint(props.type)}/${route.params.id}`, { signal: current.signal })).data.data; } catch (e) { if (!current.signal.aborted) error.value = errorMessage(e); } finally { if (!current.signal.aborted) loading.value = false; } }, { immediate: true });
</script>
<template><PublicLayout><article class="mx-auto max-w-4xl space-y-6 px-5 py-12"><RouterLink :to="`/${type}`" class="underline">Back to {{ contentLabel(type).toLowerCase() }}</RouterLink><ApiAlert :message="error"/><button v-if="error" class="secondary-button" @click="retry">Retry content</button><p v-if="loading" role="status">Loading content…</p><template v-if="post"><p v-if="!post.isPublished" class="border border-amber-300 bg-amber-50 p-3">Unpublished · visible only to authorized reviewers or its owner</p><h1 class="text-h1 text-primary">{{ post.title }}</h1><time v-if="post.publishedAt" class="block text-sm text-secondary">Published {{ new Date(post.publishedAt).toLocaleString() }}</time><img v-if="post.image" :src="post.image" :alt="post.title" referrerpolicy="no-referrer" class="max-h-[460px] w-full object-cover"><dl v-if="type === 'events'" class="space-y-3 border bg-white p-5"><div v-if="post.eventDate"><dt class="font-semibold">Event date</dt><dd>{{ new Date(post.eventDate).toLocaleString() }}</dd></div><div v-if="post.eventTime"><dt class="font-semibold">Time details</dt><dd>{{ post.eventTime }}</dd></div><div v-if="post.eventLocation"><dt class="font-semibold">Location</dt><dd>{{ post.eventLocation }}</dd></div><div v-if="post.audience"><dt class="font-semibold">Audience</dt><dd>{{ post.audience }}</dd></div></dl><p class="whitespace-pre-wrap break-words leading-8">{{ post.content }}</p></template></article></PublicLayout></template>
