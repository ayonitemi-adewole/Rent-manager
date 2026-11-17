import { Building2, LayoutDashboard, Settings, Users } from 'lucide-react'
import { NavLink, Outlet } from 'react-router'
import { Logo } from '@/components/Logo'
import { cn } from '@/lib/utils'

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/properties', label: 'Properties', icon: Building2, end: false },
  { to: '/tenants', label: 'Tenants', icon: Users, end: false },
  { to: '/settings', label: 'Settings', icon: Settings, end: false },
]

export function AppLayout() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col">
      <header className="bg-background/90 sticky top-0 z-10 border-b px-4 py-3 backdrop-blur">
        <Logo className="text-lg [&>span:first-child]:size-8" />
      </header>

      <main className="flex-1 px-4 pt-4 pb-24">
        <Outlet />
      </main>

      <nav
        aria-label="Main"
        className="bg-background/95 fixed inset-x-0 bottom-0 z-10 border-t backdrop-blur pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="mx-auto grid max-w-2xl grid-cols-4">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors',
                    isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                  )
                }
              >
                <Icon className="size-5" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
