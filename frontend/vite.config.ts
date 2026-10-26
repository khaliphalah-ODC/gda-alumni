import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import { APP_NAME } from './src/config/branding';

export default defineConfig(({ mode }) => {
  // Read only the API port from backend configuration; never expose its secrets to the bundle.
  const backendDirectory = fileURLToPath(new URL('../backend', import.meta.url));
  const backend = loadEnv(mode, backendDirectory, '');
  const apiPort = Number(process.env.GDA_API_PORT || backend.PORT || 4000);
  if (!Number.isInteger(apiPort) || apiPort < 1 || apiPort > 65535) throw new Error('Invalid backend PORT');
  const proxy = { '/api': { target: `http://127.0.0.1:${apiPort}` } };
  return {
  plugins: [vue(), { name: 'app-branding', transformIndexHtml: html => html.replace('%APP_NAME%', APP_NAME) }],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { port: 3000, strictPort: true, proxy, fs: { allow: [fileURLToPath(new URL('.', import.meta.url)), fileURLToPath(new URL('../images', import.meta.url))] } },
  preview: { port: 3000, strictPort: true, proxy },
  };
});
