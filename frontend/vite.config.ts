import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('radix-ui') || id.includes('@radix-ui') || id.includes('lucide-react') || id.includes('class-variance-authority') || id.includes('clsx') || id.includes('tailwind-merge'))
              return 'vendor-ui'
            if (id.includes('react-router') || id.includes('/react-dom/') || id.includes('/react/'))
              return 'vendor-react'
            if (id.includes('@tanstack/react-query') || id.includes('axios'))
              return 'vendor-query'
            if (id.includes('react-hook-form') || id.includes('@hookform') || id.includes('zod'))
              return 'vendor-forms'
            if (id.includes('date-fns') || id.includes('react-day-picker'))
              return 'vendor-dates'
          }
        },
      },
    },
  },
})
