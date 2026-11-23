

import { defineConfig } from 'vite';
import react      from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    plugins: [
        tailwindcss(),
        react(),
    ],
    server: {
        port: 3001,
        allowedHosts: ['dev-api.dabaexchange.world'],
        proxy: {
            '/api': {
                target: 'http://localhost:8080',
                changeOrigin: true,
            },
        },
    },
});
