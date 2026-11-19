import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router'
import { router } from '@/app/router'
import { SetupNotice } from '@/components/SetupNotice'
import { isSupabaseConfigured } from '@/lib/env'
import { initTheme } from '@/lib/theme'
import './index.css'

// Light, dark, or the device's setting (Settings → Appearance).
initTheme()

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isSupabaseConfigured ? (
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    ) : (
      <SetupNotice />
    )}
  </StrictMode>,
)
