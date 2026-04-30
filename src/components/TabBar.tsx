import { NavLink } from 'react-router-dom'
import {
  Shirt,
  CalendarCheck,
  Plus,
  BarChart3,
  Settings as SettingsIcon,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useShell } from '@/lib/shell'

interface Tab {
  to: string
  icon: LucideIcon
  label: string
}

const tabs: Tab[] = [
  { to: '/closet', icon: Shirt, label: 'Closet' },
  { to: '/log', icon: CalendarCheck, label: 'Log' },
  { to: '/insights', icon: BarChart3, label: 'Insights' },
  { to: '/settings', icon: SettingsIcon, label: 'Settings' },
]

export function TabBar() {
  // Fade out + tuck down whenever a blocking overlay (Sheet, confirm dialog)
  // is open — the capsule otherwise covers sheet footers. Selector returns
  // a boolean so renders only flip when the threshold crosses.
  const hidden = useShell((s) => s.overlayCount > 0)

  return (
    <nav
      aria-hidden={hidden}
      className={cn(
        'fixed left-0 right-0 z-50 flex justify-center px-5 pointer-events-none transition-[opacity,transform] duration-200 ease-out',
        hidden && 'opacity-0 translate-y-3',
      )}
      style={{ bottom: 'max(16px, env(safe-area-inset-bottom))' }}
    >
      <div
        className={cn(
          'w-full max-w-md h-14 px-2 bg-surface-1 border border-hairline rounded-full flex items-center justify-around',
          hidden ? 'pointer-events-none' : 'pointer-events-auto',
        )}
      >
        {tabs.slice(0, 2).map((tab) => (
          <TabButton key={tab.to} tab={tab} />
        ))}

        <NavLink
          to="/capture"
          aria-label="Add"
          className="relative -top-5 w-14 h-14 bg-accent text-ink-950 rounded-full flex items-center justify-center active:scale-95 transition-transform"
        >
          <Plus size={24} strokeWidth={2.25} />
        </NavLink>

        {tabs.slice(2).map((tab) => (
          <TabButton key={tab.to} tab={tab} />
        ))}
      </div>
    </nav>
  )
}

function TabButton({ tab }: { tab: Tab }) {
  const Icon = tab.icon
  return (
    <NavLink
      to={tab.to}
      className={({ isActive }) =>
        cn(
          'flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-full text-[10px] tracking-wide transition-colors',
          isActive
            ? 'bg-surface-2 border border-hairline text-accent'
            : 'text-tertiary hover:text-ink-50',
        )
      }
    >
      <Icon size={20} strokeWidth={1.75} />
      <span>{tab.label}</span>
    </NavLink>
  )
}
