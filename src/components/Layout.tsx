import { Outlet } from 'react-router-dom'
import { TabBar } from './TabBar'

export function Layout() {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-ink-950">
      <main
        className="flex-1 pb-28"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <Outlet />
      </main>
      <TabBar />
    </div>
  )
}
