import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  // Los componentes de Next.js se escriben en archivos .js con JSX.
  oxc: { include: /\.[jt]sx?$/, exclude: /node_modules/, lang: 'jsx', jsx: { runtime: 'automatic' } },
  resolve: { alias: { '@': path.resolve(import.meta.dirname) } },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/preparar.js'],
    globals: true,
    css: false,
  },
});
