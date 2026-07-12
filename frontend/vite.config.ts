import path from 'path';
import fs from 'fs';

import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react/jsx-runtime',
      'recharts',
      'react-calendar-heatmap',
    ],
  },
  resolve: {
    dedupe: ['react', 'react-dom'],
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
    alias: {
      react: fs.existsSync(path.resolve(__dirname, './node_modules/react'))
        ? path.resolve(__dirname, './node_modules/react')
        : path.resolve(__dirname, '../node_modules/react'),
      'react-dom': fs.existsSync(path.resolve(__dirname, './node_modules/react-dom'))
        ? path.resolve(__dirname, './node_modules/react-dom')
        : path.resolve(__dirname, '../node_modules/react-dom'),
      'vaul@1.1.2': 'vaul',
      'sonner@2.0.3': 'sonner',
      'recharts@2.15.2': 'recharts',
      'react-resizable-panels@2.1.7': 'react-resizable-panels',
      'react-hook-form@7.55.0': 'react-hook-form',
      'react-day-picker@8.10.1': 'react-day-picker',
      'next-themes@0.4.6': 'next-themes',
      'lucide-react@0.487.0': 'lucide-react',
      'input-otp@1.4.2': 'input-otp',
      'embla-carousel-react@8.6.0': 'embla-carousel-react',
      'cmdk@1.1.1': 'cmdk',
      'class-variance-authority@0.7.1': 'class-variance-authority',
      '@radix-ui/react-tooltip@1.1.8': '@radix-ui/react-tooltip',
      '@radix-ui/react-toggle@1.1.2': '@radix-ui/react-toggle',
      '@radix-ui/react-toggle-group@1.1.2': '@radix-ui/react-toggle-group',
      '@radix-ui/react-tabs@1.1.3': '@radix-ui/react-tabs',
      '@radix-ui/react-switch@1.1.3': '@radix-ui/react-switch',
      '@radix-ui/react-slot@1.1.2': '@radix-ui/react-slot',
      '@radix-ui/react-slider@1.2.3': '@radix-ui/react-slider',
      '@radix-ui/react-separator@1.1.2': '@radix-ui/react-separator',
      '@radix-ui/react-select@2.1.6': '@radix-ui/react-select',
      '@radix-ui/react-scroll-area@1.2.3': '@radix-ui/react-scroll-area',
      '@radix-ui/react-radio-group@1.2.3': '@radix-ui/react-radio-group',
      '@radix-ui/react-progress@1.1.2': '@radix-ui/react-progress',
      '@radix-ui/react-popover@1.1.6': '@radix-ui/react-popover',
      '@radix-ui/react-navigation-menu@1.2.5': '@radix-ui/react-navigation-menu',
      '@radix-ui/react-menubar@1.1.6': '@radix-ui/react-menubar',
      '@radix-ui/react-label@2.1.2': '@radix-ui/react-label',
      '@radix-ui/react-hover-card@1.1.6': '@radix-ui/react-hover-card',
      '@radix-ui/react-dropdown-menu@2.1.6': '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-dialog@1.1.6': '@radix-ui/react-dialog',
      '@radix-ui/react-context-menu@2.2.6': '@radix-ui/react-context-menu',
      '@radix-ui/react-collapsible@1.1.3': '@radix-ui/react-collapsible',
      '@radix-ui/react-checkbox@1.1.4': '@radix-ui/react-checkbox',
      '@radix-ui/react-avatar@1.1.3': '@radix-ui/react-avatar',
      '@radix-ui/react-aspect-ratio@1.1.2': '@radix-ui/react-aspect-ratio',
      '@radix-ui/react-alert-dialog@1.1.6': '@radix-ui/react-alert-dialog',
      '@radix-ui/react-accordion@1.2.3': '@radix-ui/react-accordion',
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
    chunkSizeWarningLimit: 1200,
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
    },
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.message.includes('Error when using sourcemap for reporting an error')) {
          return;
        }

        warn(warning);
      },
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, '/');

          if (!normalizedId.includes('/node_modules/')) {
            return undefined;
          }

          // Keep React in the main vendor chunk to avoid circular vendor deps.
          if (
            normalizedId.includes('/node_modules/react/') ||
            normalizedId.includes('/node_modules/react-dom/') ||
            normalizedId.includes('/node_modules/scheduler/')
          ) {
            return 'vendor';
          }

          if (normalizedId.includes('/node_modules/@radix-ui/')) {
            return 'vendor-radix';
          }

          if (normalizedId.includes('recharts') || normalizedId.includes('d3-')) {
            return 'vendor-charts';
          }

          if (normalizedId.includes('jspdf') || normalizedId.includes('html2canvas')) {
            return 'vendor-export';
          }

          if (normalizedId.includes('lucide-react')) {
            return 'vendor-icons';
          }

          if (normalizedId.includes('react-syntax-highlighter')) {
            return 'vendor-highlight';
          }

          if (normalizedId.includes('date-fns') || normalizedId.includes('react-day-picker')) {
            return 'vendor-date';
          }

          if (normalizedId.includes('i18next') || normalizedId.includes('react-i18next')) {
            return 'vendor-i18n';
          }

          if (normalizedId.includes('@dnd-kit')) {
            return 'vendor-dnd';
          }

          if (normalizedId.includes('embla-carousel')) {
            return 'vendor-carousel';
          }

          if (normalizedId.includes('driver.js')) {
            return 'vendor-tour';
          }

          if (normalizedId.includes('axios')) {
            return 'vendor-http';
          }

          if (normalizedId.includes('zustand')) {
            return 'vendor-state';
          }

          if (normalizedId.includes('cmdk') || normalizedId.includes('sonner') || normalizedId.includes('vaul')) {
            return 'vendor-ui';
          }

          if (normalizedId.includes('react-markdown') || normalizedId.includes('remark-') || normalizedId.includes('rehype-')) {
            return 'vendor-markdown';
          }

          if (normalizedId.includes('@tanstack')) {
            return 'vendor-query';
          }

          return 'vendor';
        },
      },
    },
  },
  server: {
    host: '0.0.0.0', // Allow external connections
    port: 3000,
    // Fail fast when 3000 is already occupied so developers do not
    // accidentally open a different app on 3000 while this one runs elsewhere.
    strictPort: true,
    open: true,
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
