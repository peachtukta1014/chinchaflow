import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const appBuildIso = new Date().toISOString();

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_BUILD_ISO__: JSON.stringify(appBuildIso),
  },
  resolve: {
    dedupe: ['firebase', 'firebase/app', 'firebase/auth', 'firebase/storage'],
  },
  build: {
    outDir: 'dist',
  },
});
