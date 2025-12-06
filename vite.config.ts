import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Để tránh lỗi process is not defined trên trình duyệt khi dùng thư viện cũ
    'process.env': {}
  }
})