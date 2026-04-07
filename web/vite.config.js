import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import { sentryVitePlugin } from '@sentry/vite-plugin';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      vue(),
      // Upload source maps to Sentry on production builds.
      // Requires SENTRY_AUTH_TOKEN env var (set in CI / Cloudflare Pages build settings).
      ...(env.SENTRY_AUTH_TOKEN ? [sentryVitePlugin({
        org: 'antosik-allister',
        project: 'javascript-vue',
        authToken: env.SENTRY_AUTH_TOKEN,
        sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },
        telemetry: false,
      })] : []),
    ],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: true,
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:8787',
          changeOrigin: true
        }
      }
    }
  };
});
