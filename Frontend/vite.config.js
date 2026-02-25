import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  preview: {
    port: 4173, // optional, Vite port
    host: true, // listen on all interfaces
    allowedHosts: ['personal-finance-tracker-nmqq.onrender.com'] // Add your Render URL here
  }
})