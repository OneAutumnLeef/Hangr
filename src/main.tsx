import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './index.css'
import { installDiagnostics } from './lib/diagnostics'
import { trackVisit } from './lib/visitTracker'

// Install before anything else so we capture even early init errors.
installDiagnostics()

// Fire-and-forget: bumps the cross-app visit counter (one per session).
void trackVisit()

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

// Subpath-aware routing — when deployed at derajyojith.dev/Hangr/, BASE_URL
// is '/Hangr/' (set in vite.config.ts) and React Router needs the same
// basename minus the trailing slash so client routes resolve correctly.
const ROUTER_BASENAME = import.meta.env.BASE_URL.replace(/\/$/, '')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={ROUTER_BASENAME}>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)
