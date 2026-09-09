import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

// The version comes from package.json at build time, so the number in the header
// does not have to be edited by hand for every release.
const { version } = JSON.parse(readFileSync('./package.json', 'utf8'));

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(version) },
});
