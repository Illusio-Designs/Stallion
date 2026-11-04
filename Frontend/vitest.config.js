import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Next handles Tailwind in production; component tests only need DOM behavior.
  css: { postcss: { plugins: [] } },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{js,jsx}'],
  },
});
