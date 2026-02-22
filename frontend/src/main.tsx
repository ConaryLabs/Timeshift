import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { BrowserRouter } from 'react-router-dom'
import { Toaster, toast } from 'sonner'
import { isAxiosError } from 'axios'
import { TooltipProvider } from '@/components/ui/tooltip'
import { SESSION_EXPIRED } from '@/api/client'
import './index.css'
import App from './App.tsx'

/**
 * Map an API error to a user-facing message. Returns null to suppress the toast
 * (e.g. 401s handled by the auth interceptor, or SESSION_EXPIRED sentinels).
 */
function errorMessage(error: unknown): string | null {
  if (error === SESSION_EXPIRED) return null

  if (isAxiosError(error)) {
    if (!error.response) return 'Network error — check your connection'
    const { status, data } = error.response
    if (status === 401) return null  // handled by silent-refresh interceptor
    if (status === 409) return data?.error ?? 'Conflict — this record may have been changed by someone else'
    if (status >= 500) return 'Server error — please try again'
    return data?.error ?? null  // other 4xx: show server message if present, else suppress
  }

  return 'An unexpected error occurred'
}

function isTransient(error: unknown): boolean {
  if (!isAxiosError(error)) return false
  return !error.response || error.response.status >= 500
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      const msg = errorMessage(error)
      if (!msg) return
      // Deduplicate transient toasts (network outage may fail many queries at once)
      toast.error(msg, {
        id: isTransient(error) ? `query-error:${msg}` : undefined,
        ...(isTransient(error) && {
          action: {
            label: 'Retry',
            onClick: () => queryClient.refetchQueries({ queryKey: query.queryKey }),
          },
        }),
      })
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      const msg = errorMessage(error)
      if (!msg) return
      toast.error(msg)
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
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
