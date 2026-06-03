import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const appBuildIso = new Date().toISOString();

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_BUILD_ISO__: JSON.stringify(appBuildIso),
  },
  resolve: {
    dedupe: ['firebase', 'firebase/app', 'firebase/auth', 'firebase/storage'],
    alias: {
      '@chincha/app-credits': path.resolve(__dirname, '../../packages/app-credits/src/index.js'),
    },
  },
  build: {
    outDir: 'dist',
  },
});
