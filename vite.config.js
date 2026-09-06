import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

// Версія береться з package.json під час збірки — щоб число в шапці
// не треба було правити руками при кожному релізі.
const { version } = JSON.parse(readFileSync('./package.json', 'utf8'));

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(version) },
});
