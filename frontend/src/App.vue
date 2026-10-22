<script setup lang="ts">
import { MotionConfig, motion, useReducedMotion } from 'motion-v';
const reduced = useReducedMotion();
</script>
<template><MotionConfig reducedMotion="user"><a href="#main-content" class="skip-link">Skip to main content</a><RouterView v-slot="{ Component, route }"><motion.div :key="route.path" :initial="reduced || route.meta.auth ? false : { opacity: 0 }" :animate="{ opacity: 1 }" :transition="{ duration: reduced ? 0 : 0.18 }"><component :is="Component" /></motion.div></RouterView></MotionConfig></template>
