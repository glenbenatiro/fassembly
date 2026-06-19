import { defineConfig } from 'vite';

// Native and binary-bearing modules must stay external so they are required
// from node_modules at runtime instead of being bundled. ffmpeg-static in
// particular resolves to an on-disk binary path that bundling would break.
const external = [
  'electron',
  'electron-squirrel-startup',
  'electron-store',
  'assemblyai',
  'ffmpeg-static',
  'fluent-ffmpeg',
];

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      external,
    },
  },
});
