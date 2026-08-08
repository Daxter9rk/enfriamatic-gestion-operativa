import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@firebase/firestore')) return 'firebase-firestore';
          if (id.includes('@firebase/auth')) return 'firebase-auth';
          if (id.includes('@firebase/')) return 'firebase-core';
          if (id.includes('react-router')) return 'react-router';
          if (id.includes('react-dom') || id.includes('/react/')) return 'react';
          return undefined;
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
