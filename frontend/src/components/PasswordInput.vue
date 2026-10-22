<script setup lang="ts">
import { ref } from 'vue';
defineOptions({ inheritAttrs: false });
const props = defineProps<{ modelValue: string; modelModifiers?: { trim?: boolean } }>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
const visible = ref(false);
function update(event: Event) { const value = (event.target as HTMLInputElement).value; emit('update:modelValue', props.modelModifiers?.trim ? value.trim() : value); }
</script>
<template><div class="relative"><input v-bind="$attrs" :value="modelValue" :type="visible ? 'text' : 'password'" class="field-input pr-14" @input="update"><button type="button" class="absolute inset-y-0 right-0 flex min-w-12 items-center justify-center text-primary" :aria-label="visible ? 'Hide password' : 'Show password'" :aria-pressed="visible" :aria-controls="($attrs.id as string | undefined)" @click="visible = !visible"><span class="material-symbols-outlined" aria-hidden="true">{{ visible ? 'visibility_off' : 'visibility' }}</span></button></div></template>
