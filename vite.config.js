import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  server: {
    host: true,
    port: 4173
  },
  preview: {
    host: true,
    port: 4173
  }
});

