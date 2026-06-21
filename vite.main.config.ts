import { defineConfig } from 'vite';
import { builtinModules } from 'node:module';

// Externalize only Electron and Node built-ins. Everything else (electron-store
// etc.) is bundled into the main process file, because the Forge Vite setup does
// not ship node_modules. ffmpeg-static is not imported at runtime - its binary is
// shipped via extraResource and resolved by path - so it does not need to be here.
const external = [
  'electron',
  ...builtinModules,
  ...builtinModules.map((m) => `node:${m}`),
];

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      external,
    },
  },
});
