// Test-only: serves the panel on an isolated port and proxies /api to the isolated test API (18080),
// never to the real dev API on 8080. Used by playwright.botpolicy.config.js.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    plugins: [tailwindcss(), react()],
    server: { host: '127.0.0.1', port: 13001, strictPort: true, proxy: { '/api': { target: 'http://127.0.0.1:18080', changeOrigin: true } } },
});
