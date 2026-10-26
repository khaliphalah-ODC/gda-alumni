<script setup lang="ts">
import { APP_NAME } from '@/config/branding';
</script>
<template><div class="reference-ui"><footer class="site-footer border-t border-slate-200 bg-slate-50 text-slate-700">
<div class="max-w-7xl mx-auto px-6 pt-16 pb-8">
<div class="grid md:grid-cols-4 gap-12 mb-16">
<div class="md:col-span-2 space-y-6">
<h3 class="text-lg font-black text-[#1B2E4B] tracking-widest uppercase">{{ APP_NAME }}</h3>
<p class="font-body-md text-on-surface-variant max-w-md">
                        The premiere educational institution of the Ministry of National Defense, Liberia. Connecting alumni with school information, membership and academic record services.
                    </p>
<div class="flex gap-4">
<RouterLink class="w-10 h-10 bg-primary-container/10 flex items-center justify-center rounded-lg text-primary hover:bg-primary hover:text-white transition-all" to="/contact" aria-label="School contact information">
<span aria-hidden="true" class="material-symbols-outlined text-[20px]">public</span>
</RouterLink>
<RouterLink class="w-10 h-10 bg-primary-container/10 flex items-center justify-center rounded-lg text-primary hover:bg-primary hover:text-white transition-all" to="/help" aria-label="Portal help">
<span aria-hidden="true" class="material-symbols-outlined text-[20px]">alternate_email</span>
</RouterLink>
</div>
</div>
<div class="space-y-6">
<h4 class="font-label-sm text-primary uppercase tracking-widest">Portal Links</h4>
<ul class="space-y-4 font-caption text-on-surface-variant">
<li><RouterLink class="hover:text-primary transition-colors" to="/dashboard">Alumni Dashboard</RouterLink></li>
<li><RouterLink class="hover:text-primary transition-colors" to="/requests">Document Status</RouterLink></li>
<li><RouterLink class="hover:text-primary transition-colors" to="/login">Staff Portal</RouterLink></li>
<li><RouterLink class="hover:text-primary transition-colors" to="/gallery">School Photo Gallery</RouterLink></li>
<li><RouterLink class="hover:text-primary transition-colors" to="/privacy">Privacy Policy</RouterLink></li>
</ul>
</div>
<div class="space-y-6">
<h4 class="font-label-sm text-primary uppercase tracking-widest">School Contact</h4>
<ul class="space-y-4 font-caption text-on-surface-variant">
<li class="flex items-start gap-2">
<span aria-hidden="true" class="material-symbols-outlined text-[18px]">location_on</span>
<span>BTC Campus, Ministry of Defense<br/>Monrovia, Liberia</span>
</li>
<li class="flex items-center gap-2">
<span aria-hidden="true" class="material-symbols-outlined text-[18px]">phone</span>
<span>Contact the Records Office</span>
</li>
</ul>
</div>
</div>
<div class="flex flex-col md:flex-row justify-between items-center gap-4 pt-8 border-t border-slate-200">
<p class="font-sans text-xs uppercase tracking-wider text-slate-600">
                    © {{ new Date().getFullYear() }} Gray D. Allison High School. Ministry of National Defense, Liberia.
                </p>
<div class="flex flex-wrap justify-center gap-6 font-sans text-xs uppercase tracking-wider">
<RouterLink class="text-slate-600 hover:underline" to="/privacy">Privacy Policy</RouterLink>
<RouterLink class="text-slate-600 hover:underline" to="/terms">Terms of Service</RouterLink>
<RouterLink class="text-slate-600 hover:underline" to="/about">Ministry of Defense</RouterLink>
<RouterLink class="text-slate-600 hover:underline" to="/login">Staff Portal</RouterLink>
</div>
</div>
</div>
</footer></div></template>
