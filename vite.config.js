import { defineConfig } from 'vite';
import glsl from 'vite-plugin-glsl';

export default defineConfig({
  root: 'src',
  base: './',
  plugins: [glsl()],
  assetsInclude: ['**/*.glb'],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    target: 'es2020',
    minify: 'terser',
    chunkSizeWarningLimit: 1200
  }
});

