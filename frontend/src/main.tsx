import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'sonner'
import { toast } from 'sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { SESSION_EXPIRED } from '@/api/client'
import './index.css'
import App from './App.tsx'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
    mutations: {
      onError: (error: unknown) => {
        if (error === SESSION_EXPIRED) return
        const axiosErr = error as { response?: { data?: { error?: string } } }
        const msg = axiosErr?.response?.data?.error ?? 'Something went wrong'
        toast.error(msg)
      },
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </TooltipProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
    <Toaster richColors position="top-right" />
  </StrictMode>,
)
