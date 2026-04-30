import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './index.css'
import { installDiagnostics } from './lib/diagnostics'

// Install before anything else so we capture even early init errors.
installDiagnostics()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Most data is local (Dexie via useLiveQuery handles its own subscriptions),
      // so React Query is only used where we have async work without live updates.
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)
