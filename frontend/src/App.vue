<script setup lang="ts">
import { MotionConfig, motion, useReducedMotion } from 'motion-v';
const reduced = useReducedMotion();
// Keep text opaque during route transitions so contrast is stable from first paint.
</script>
<template><MotionConfig reducedMotion="user"><a href="#main-content" class="skip-link">Skip to main content</a><RouterView v-slot="{ Component, route }"><motion.div :key="route.path" :initial="reduced || route.meta.auth ? false : { y: 4 }" :animate="{ y: 0 }" :transition="{ duration: reduced ? 0 : 0.18 }"><component :is="Component" /></motion.div></RouterView></MotionConfig></template>
