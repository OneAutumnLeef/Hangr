import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Closet } from './routes/Closet'
import { Capture } from './routes/Capture'
import { BulkCapture } from './routes/BulkCapture'
import { Wants } from './routes/Wants'
import { ItemDetail } from './routes/ItemDetail'
import { Log } from './routes/Log'
import { Insights } from './routes/Insights'
import { Settings } from './routes/Settings'
import { InstallPrompt } from './components/InstallPrompt'
import { Toaster } from './components/Toaster'
import { ErrorBoundary } from './components/ErrorBoundary'

function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/closet" replace />} />
          <Route path="/closet" element={<Closet />} />
          <Route path="/closet/:id" element={<ItemDetail />} />
          <Route path="/capture" element={<Capture />} />
          <Route path="/capture/bulk" element={<BulkCapture />} />
          <Route path="/wants" element={<Wants />} />
          <Route path="/log" element={<Log />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/closet" replace />} />
        </Route>
      </Routes>
      <Toaster />
      <InstallPrompt />
    </ErrorBoundary>
  )
}

export default App
