import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    base: '/base-pokedex-20262/',
  plugins: [react()],
});
