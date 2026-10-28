<script setup lang="ts">
import { nextTick, onMounted, onBeforeUnmount, ref } from 'vue';
import { api, errorMessage } from '@/api/client';
import type { ApiResponse } from '@/types/api';
type Answer = { answer: string; sources: { title: string; path: string }[] };
const available=ref(false), open=ref(false), busy=ref(false), question=ref(''), error=ref(''), lastQuestion=ref(''), pendingQuestion=ref('');
const turns=ref<{question:string;reply:Answer}[]>([]), input=ref<HTMLTextAreaElement>(), launcher=ref<HTMLButtonElement>();
let controller: AbortController | undefined;
const suggestions=['How do I register?', 'How do I activate my account?', 'How do I request a transcript?', 'Where are upcoming events?', 'What is known about cadet drills?'];
onMounted(async()=> { try { available.value=(await api.get<ApiResponse<{enabled:boolean}>>('/chatbot/availability')).data.data.enabled; } catch { available.value=false; } });
onBeforeUnmount(()=>controller?.abort());
async function toggle(){open.value=!open.value;await nextTick();if(open.value)input.value?.focus();else launcher.value?.focus();}
function clear(){controller?.abort();controller=undefined;busy.value=false;turns.value=[];question.value='';error.value='';lastQuestion.value='';pendingQuestion.value='';void nextTick(()=>input.value?.focus());}
async function send(value=question.value){
  if(busy.value||value.trim().length<2)return;
  error.value='';lastQuestion.value=value;pendingQuestion.value=value;busy.value=true; const request=new AbortController(); controller=request;
  try{const reply=(await api.post<ApiResponse<Answer>>('/chatbot/messages',{message:value.trim()},{signal:request.signal})).data.data;
    if(request.signal.aborted)return;
    turns.value=[...turns.value.slice(-9),{question:value,reply}];question.value='';
  }catch(e){if(!request.signal.aborted)error.value=errorMessage(e);}finally{if(controller===request){busy.value=false;pendingQuestion.value='';controller=undefined;await nextTick();input.value?.focus();}}
}
</script>
<template><div v-if="available" class="fixed bottom-4 right-4 z-50 max-w-[calc(100vw-2rem)]">
<section v-if="open" id="school-assistant" aria-labelledby="school-assistant-title" class="mb-3 flex max-h-[75dvh] w-96 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-lg border border-outline-variant bg-white shadow-xl" @keydown.esc.stop.prevent="toggle">
<header class="flex items-center justify-between gap-4 bg-primary p-4 text-white"><h2 id="school-assistant-title" class="font-bold">Gray D. Allison School Assistant</h2><button type="button" aria-label="Close school assistant" class="rounded border border-white px-3 py-1" @click="toggle">Close</button></header>
<div class="space-y-4 overflow-y-auto p-4"><p class="text-sm">Welcome to the Gray D. Allison School Assistant! Ask me about school history, alumni membership, academic achievements, cadet drills, upcoming events, and document request procedures.</p><p class="text-sm text-secondary">Public guidance only. Your question is sent to Groq. Do not share passwords, activation links or personal details. Chats stay on this page and are not saved by the portal.</p><RouterLink to="/privacy" class="text-sm underline">Privacy information</RouterLink>
<div class="flex flex-wrap gap-2"><button v-for="suggestion in suggestions" :key="suggestion" type="button" :disabled="busy" class="rounded border border-outline-variant px-3 py-2 text-left text-sm text-primary" @click="send(suggestion)">{{suggestion}}</button></div>
<div aria-live="polite" aria-relevant="additions" class="space-y-4"><article v-for="(turn,index) in turns" :key="index" class="space-y-2 border-t pt-3"><h3 class="rounded bg-surface-container-low p-3 break-words font-semibold text-primary">{{turn.question}}</h3><p class="whitespace-pre-wrap break-words text-sm">{{turn.reply.answer}}</p><ul class="space-y-1"><li v-for="source in turn.reply.sources" :key="source.path"><RouterLink :to="source.path" class="text-sm text-primary underline">{{source.title}}</RouterLink></li></ul><RouterLink v-if="!turn.reply.sources.length" to="/contact" class="underline">Contact the school</RouterLink></article></div>
<p v-if="pendingQuestion" class="rounded bg-surface-container-low p-3 break-words font-semibold">{{pendingQuestion}}</p><p v-if="busy" role="status">Finding school guidance…</p><p v-if="error" role="alert" class="text-sm text-error">{{error}}</p><button v-if="error&&lastQuestion" type="button" class="secondary-button" :disabled="busy" @click="send(lastQuestion)">Retry question</button>
</div><form class="space-y-3 border-t p-4" @submit.prevent="send()"><label for="assistant-question" class="field-label">Ask a general school question</label><textarea id="assistant-question" ref="input" v-model="question" required minlength="2" maxlength="600" rows="2" class="field-input" :disabled="busy"/><p class="text-xs text-secondary">{{question.length}}/600 · Each question is answered independently.</p><div class="flex flex-wrap gap-3"><button class="primary-button" :disabled="busy||question.trim().length<2">Send question</button><button type="button" class="secondary-button" @click="clear">Clear chat</button></div></form>
</section><button ref="launcher" type="button" :aria-expanded="open" aria-controls="school-assistant" class="primary-button shadow-lg" @click="toggle">{{open?'Hide assistant':'Ask the school assistant'}}</button></div></template>
