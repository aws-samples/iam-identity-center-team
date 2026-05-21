import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react({
      include: ['**/*.js', '**/*.jsx'],
    }),
  ],
  server: {
    port: 3000,
    open: true,
  },
  esbuild: {
    loader: 'jsx',
    include: [/src\/.*\.js$/, /node_modules\/react-csv\/.*\.jsx?$/],
    exclude: [],
  },
  optimizeDeps: {
    include: ['react-csv'],
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
      },
    },
  },
  build: {
    commonjsOptions: {
      include: [/react-csv/, /node_modules/],
    },
  },
  resolve: {
    alias: {
      './runtimeConfig': './runtimeConfig.browser',
    },
  },
});
