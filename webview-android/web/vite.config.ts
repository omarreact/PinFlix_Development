import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/postcss';
import { fileURLToPath } from 'node:url';
export default defineConfig({
 base: '/', plugins: [react()], css: {postcss: {plugins:[tailwind()]}},
 resolve: {alias: {
  '@': fileURLToPath(new URL('.',import.meta.url)),
  'next/navigation': fileURLToPath(new URL('./navigation.ts',import.meta.url)),
  'next/dynamic': fileURLToPath(new URL('./dynamic.tsx',import.meta.url)),
 }},
 build:{outDir:'../app/src/main/assets/web',emptyOutDir:true},
});
