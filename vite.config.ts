import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // 只在开发模式加载环境变量，生产构建不包含密钥
    const env = mode === 'development' ? loadEnv(mode, '.', '') : {};
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        strictPort: true,
      },
      plugins: [react()],
      // 生产构建不注入密钥，用户需要在应用中配置
      define: mode === 'development' ? {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || '')
      } : {},
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      // Tauri expects a fixed port, fail if that port is not available
      clearScreen: false,
      envPrefix: ['VITE_', 'TAURI_'],
      build: {
        // Tauri uses Chromium on Windows and WebKit on macOS and Linux
        target: process.env.TAURI_PLATFORM == 'windows' ? 'chrome105' : 'safari13',
        // don't minify for debug builds
        minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
        // produce sourcemaps for debug builds
        sourcemap: !!process.env.TAURI_DEBUG,
      },
    };
});
