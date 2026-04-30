import { NavLink } from 'react-router-dom'
import {
  Shirt,
  Camera,
  CalendarCheck,
  BarChart3,
  Settings as SettingsIcon,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Tab {
  to: string
  icon: LucideIcon
  label: string
}

const tabs: Tab[] = [
  { to: '/closet', icon: Shirt, label: 'Closet' },
  { to: '/capture', icon: Camera, label: 'Add' },
  { to: '/log', icon: CalendarCheck, label: 'Log' },
  { to: '/insights', icon: BarChart3, label: 'Insights' },
  { to: '/settings', icon: SettingsIcon, label: 'Settings' },
]

export function TabBar() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-ink-900/95 border-t border-ink-800 backdrop-blur"
      style={{
        paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
      }}
    >
      <div className="mx-auto max-w-md flex items-stretch justify-between px-2 py-1">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                cn(
                  'flex-1 flex flex-col items-center gap-0.5 py-2 rounded-lg text-[10px] uppercase tracking-wide transition-colors',
                  isActive ? 'text-accent' : 'text-ink-400 hover:text-ink-100',
                )
              }
            >
              <Icon size={20} />
              <span>{tab.label}</span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
