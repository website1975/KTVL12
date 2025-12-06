import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load các biến môi trường từ file .env (nếu có)
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    define: {
      // Ép kiểu các biến môi trường thành chuỗi JSON để Client đọc được
      // Nếu không có giá trị (undefined), sẽ gán là chuỗi rỗng "" để tránh lỗi crash app
      'process.env.API_KEY': JSON.stringify(env.API_KEY || ''),
      'process.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL || ''),
      'process.env.VITE_SUPABASE_KEY': JSON.stringify(env.VITE_SUPABASE_KEY || ''),
      'process.env.NODE_ENV': JSON.stringify(mode),
    }
  }
})
