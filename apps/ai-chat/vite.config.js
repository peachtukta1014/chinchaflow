import path from 'path';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(path.join(__dirname, 'package.json'), 'utf8'));

const appBuildIso = new Date().toISOString();
const appBuildSha = (process.env.GITHUB_SHA || 'local').slice(0, 7);

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_BUILD_ISO__: JSON.stringify(appBuildIso),
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_BUILD_SHA__: JSON.stringify(appBuildSha),
  },
  build: {
    outDir: 'dist',
  },
});