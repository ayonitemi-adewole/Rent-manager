import {
  Building2,
  LayoutDashboard,
  Settings,
  UserPlus,
  Users,
} from 'lucide-react';
import { useEffect } from 'react';
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useMatches,
  useNavigation,
} from 'react-router';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { useLandlord } from '@/features/landlord/api';
import { TourProvider } from '@/features/onboarding/TourProvider';
import { formatNgPhone } from '@/lib/phone';
import { cn, initials } from '@/lib/utils';
import { prefetchCommonPages } from './pages';
import type { PageWidth } from './router';

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/properties', label: 'Properties', icon: Building2, end: false },
  { to: '/tenants', label: 'Tenants', icon: Users, end: false },
  { to: '/settings', label: 'Settings', icon: Settings, end: false },
];

/** Content width on large screens: forms stay a comfortable reading width, lists and the dashboard spread out. */
const WIDTH: Record<PageWidth, string> = {
  narrow: 'lg:max-w-2xl',
  wide: 'lg:max-w-6xl',
};

/**
 * Phones: logo on top, tab bar at the bottom (thumb reach).
 * Large screens (lg, 1024px+): a fixed sidebar with the same links, and wider pages.
 * Both navs carry data-tour; the guided tour points at whichever one is visible.
 */
export function AppLayout() {
  const loading = useNavigation().state === 'loading';
  const { pathname } = useLocation();
  const matches = useMatches();
  const width =
    (matches.at(-1)?.handle as { width?: PageWidth } | undefined)?.width ??
    'wide';

  // Once a landlord is in, fetch the pages they open most so taps feel instant.
  useEffect(prefetchCommonPages, []);

  return (
    <TourProvider>
      {loading && (
        <div
          role="progressbar"
          aria-label="Loading page"
          className="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden"
        >
          <div className="page-progress bg-primary h-full w-2/5" />
        </div>
      )}

      <Sidebar />

      <div className="flex min-h-dvh flex-col lg:pl-64">
        <header className="bg-background/90 sticky top-0 z-10 border-b px-4 py-3 backdrop-blur lg:hidden">
          <div className="mx-auto max-w-2xl">
            <Logo size="sm" />
          </div>
        </header>

        <main className="flex-1 px-4 pt-4 pb-24 lg:px-10 lg:pt-10 lg:pb-12">
          <div className={cn('mx-auto max-w-2xl', WIDTH[width])}>
            {/* Keyed by page, so each new page fades in (shows that the tap did something). */}
            <div key={pathname} className="motion-safe:animate-enter">
              <Outlet />
            </div>
          </div>
        </main>
      </div>

      <nav
        aria-label="Main"
        className="bg-background/95 fixed inset-x-0 bottom-0 z-10 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        <ul className="mx-auto grid max-w-2xl grid-cols-4">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                data-tour={`nav-${label.toLowerCase()}`}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-[color,transform] motion-safe:active:scale-95',
                    isActive
                      ? 'text-primary'
                      : 'text-muted-foreground hover:text-foreground'
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
    </TourProvider>
  );
}

function Sidebar() {
  const { data: landlord } = useLandlord();
  const name = landlord?.display_name || landlord?.full_name;

  return (
    <aside className="bg-card fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r lg:flex">
      <div className="px-6 pt-6 pb-8">
        <Link to="/" aria-label="RentPadi dashboard" className="inline-block">
          <Logo size="md" />
        </Link>
      </div>

      <nav aria-label="Main" className="flex-1 px-3">
        <ul className="space-y-1">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                data-tour={`nav-${label.toLowerCase()}`}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-secondary text-primary'
                      : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                  )
                }
              >
                <Icon className="size-4.5" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>

        <Button asChild className="mt-6 w-full">
          <Link to="/tenants/new">
            <UserPlus /> Add tenant
          </Link>
        </Button>
      </nav>

      {landlord && (
        <Link
          to="/settings"
          className="hover:bg-accent/60 m-3 flex items-center gap-3 rounded-lg p-3 transition-colors"
        >
          <span className="bg-secondary text-secondary-foreground grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold">
            {initials(name ?? '')}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{name}</span>
            <span className="text-muted-foreground block truncate text-xs">
              {formatNgPhone(landlord.phone)}
            </span>
          </span>
        </Link>
      )}
    </aside>
  );
}
