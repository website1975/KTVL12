
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env từ file .env (nếu có)
  const env = loadEnv(mode, (process as any).cwd(), '')
  
  // Lấy API_KEY: Ưu tiên từ môi trường hệ thống (AI Studio / Vercel / Docker) rồi mới đến file .env
  const apiKey = (
    process.env.GEMINI_API_KEY || 
    process.env.API_KEY || 
    process.env.VITE_GEMINI_API_KEY || 
    process.env.VITE_API_KEY || 
    env.GEMINI_API_KEY || 
    env.API_KEY || 
    env.VITE_GEMINI_API_KEY || 
    env.VITE_API_KEY || 
    ''
  ).trim();

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.')
      }
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      strictPort: true,
    },
    preview: {
      host: '0.0.0.0',
      port: 3000,
      strictPort: true,
    },
    define: {
      'process.env.API_KEY': JSON.stringify(apiKey),
      'process.env.GEMINI_API_KEY': JSON.stringify(apiKey),
    }
  }
})
