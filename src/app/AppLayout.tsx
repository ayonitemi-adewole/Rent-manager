import {
  Building2,
  LayoutDashboard,
  Plus,
  Settings,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useMatches,
  useNavigation,
} from 'react-router';
import { Avatar } from '@/components/Avatar';
import { Logo } from '@/components/Logo';
import { PullToRefresh } from '@/components/PullToRefresh';
import { Button } from '@/components/ui/button';
import { useLandlord } from '@/features/landlord/api';
import { TourProvider } from '@/features/onboarding/TourProvider';
import { formatNgPhone } from '@/lib/phone';
import { cn } from '@/lib/utils';
import { prefetchCommonPages } from './pages';
import type { PageWidth } from './router';

type NavItem = {
  to: string;
  label: string;
  /** Under the icon in the phone tab bar, where space is tight. */
  short: string;
  icon: LucideIcon;
  end: boolean;
  /** The guided tour points at this (tour-steps.ts). */
  tour: string;
};

const nav: NavItem[] = [
  { to: '/', label: 'Dashboard', short: 'Home', icon: LayoutDashboard, end: true, tour: 'nav-dashboard' },
  { to: '/properties', label: 'Properties', short: 'Properties', icon: Building2, end: false, tour: 'nav-properties' },
  { to: '/tenants', label: 'Tenants', short: 'Tenants', icon: Users, end: false, tour: 'nav-tenants' },
  { to: '/settings', label: 'Settings', short: 'Settings', icon: Settings, end: false, tour: 'nav-settings' },
];

/** Content width on large screens: forms stay a comfortable reading width, lists and the dashboard spread out. */
const WIDTH: Record<PageWidth, string> = {
  narrow: 'lg:max-w-2xl',
  wide: 'lg:max-w-6xl',
};

/**
 * Phones: logo on top, a floating tab bar at the bottom (thumb reach) with a + for adding.
 * Large screens (lg, 1024px+): a Padi Green sidebar with the same links, and wider pages.
 * Both navs carry data-tour; the guided tour points at whichever one is visible.
 */
export function AppLayout() {
  const loading = useNavigation().state === 'loading';
  const { pathname } = useLocation();
  const matches = useMatches();
  const width =
    (matches.at(-1)?.handle as { width?: PageWidth } | undefined)?.width ??
    'wide';
  const { data: landlord } = useLandlord();
  const name = landlord?.display_name || landlord?.full_name || '';

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
          <div className="page-progress bg-gold h-full w-2/5" />
        </div>
      )}

      <Sidebar />

      <div className="flex min-h-dvh flex-col lg:pl-64">
        <header className="bg-background/80 sticky top-0 z-10 border-b border-border/60 px-4 py-2.5 backdrop-blur-md lg:hidden">
          <div className="mx-auto flex max-w-2xl items-center justify-between">
            <Link to="/" aria-label="RentPadi dashboard">
              <Logo size="sm" />
            </Link>
            {landlord && (
              <Link
                to="/profile"
                aria-label="Your profile"
                className="focus-visible:ring-ring/50 rounded-full outline-none focus-visible:ring-[3px]"
              >
                <Avatar name={name} size="sm" />
              </Link>
            )}
          </div>
        </header>

        {/* Only the page pulls down to refresh: the header above and the tab bar below stay put. */}
        <PullToRefresh className="flex flex-1 flex-col" contentClassName="flex flex-1 flex-col">
          <main className="flex-1 px-4 pt-5 pb-[calc(env(safe-area-inset-bottom)+7rem)] lg:px-10 lg:pt-10 lg:pb-12">
            <div className={cn('mx-auto max-w-2xl', WIDTH[width])}>
              {/* Keyed by page, so each new page fades in (shows that the tap did something). */}
              <div key={pathname} className="motion-safe:animate-enter">
                <Outlet />
              </div>
            </div>
          </main>
        </PullToRefresh>
      </div>

      <nav
        aria-label="Main"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3 pb-[calc(env(safe-area-inset-bottom)+0.625rem)] lg:hidden"
      >
        <ul className="bg-card/95 shadow-float pointer-events-auto mx-auto grid max-w-md grid-cols-5 items-center rounded-2xl border p-1.5 backdrop-blur-md">
          <TabItem item={nav[0]} />
          <TabItem item={nav[1]} />
          <li className="flex justify-center">
            <QuickAdd />
          </li>
          <TabItem item={nav[2]} />
          <TabItem item={nav[3]} />
        </ul>
      </nav>
    </TourProvider>
  );
}

function TabItem({ item: { to, short, icon: Icon, end, tour } }: { item: NavItem }) {
  return (
    <li>
      <NavLink
        to={to}
        end={end}
        data-tour={tour}
        className="group focus-visible:ring-ring/50 flex flex-col items-center gap-0.5 rounded-xl py-1 text-[11px] font-semibold transition-transform outline-none focus-visible:ring-[3px] motion-safe:active:scale-95"
      >
        {({ isActive }) => (
          <>
            <span
              className={cn(
                'grid h-7 w-12 place-items-center rounded-full transition-colors',
                isActive ? 'bg-secondary text-primary' : 'text-muted-foreground group-hover:text-foreground'
              )}
            >
              <Icon className="size-5" />
            </span>
            <span className={isActive ? 'text-foreground' : 'text-muted-foreground'}>{short}</span>
          </>
        )}
      </NavLink>
    </li>
  );
}

/**
 * The + in the phone tab bar: the two things a landlord adds. A plain show/hide list of links
 * (no menu library: it would add ~28 kB to every landlord page). Closes on a tap outside or Escape.
 */
function QuickAdd() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-label="Add a tenant or property"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen((o) => !o)}
        className="bg-primary text-primary-foreground focus-visible:ring-ring/50 grid size-12 place-items-center rounded-xl shadow-[inset_0_1px_0_rgb(255_255_255/0.15),0_6px_16px_-6px_oklch(0.3_0.08_157/0.6)] transition-transform outline-none focus-visible:ring-[3px] motion-safe:active:scale-95"
      >
        <Plus
          className={cn('size-6 transition-transform motion-reduce:transition-none', open && 'rotate-45')}
          strokeWidth={2.5}
        />
      </button>
      {open && (
        <ul
          id={listId}
          className="bg-popover text-popover-foreground shadow-float absolute bottom-full left-1/2 mb-4 w-64 -translate-x-1/2 rounded-xl border p-1.5 motion-safe:animate-enter"
        >
          <QuickAddItem to="/tenants/new" icon={UserPlus} title="Add tenant" description="Someone renting a vacant unit" onPick={close} />
          <QuickAddItem to="/properties/new" icon={Building2} title="Add property" description="A building or compound" onPick={close} />
        </ul>
      )}
    </div>
  );
}

function QuickAddItem({
  to,
  icon: Icon,
  title,
  description,
  onPick,
}: {
  to: string;
  icon: LucideIcon;
  title: string;
  description: string;
  onPick: () => void;
}) {
  return (
    <li>
      <Link
        to={to}
        onClick={onPick}
        className="hover:bg-accent focus-visible:bg-accent flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm outline-none"
      >
        <span className="bg-secondary text-primary grid size-9 shrink-0 place-items-center rounded-lg">
          <Icon className="size-4.5" />
        </span>
        <span className="min-w-0">
          <span className="block font-semibold">{title}</span>
          <span className="text-muted-foreground block text-xs">{description}</span>
        </span>
      </Link>
    </li>
  );
}

function Sidebar() {
  const { data: landlord } = useLandlord();
  const name = landlord?.display_name || landlord?.full_name;

  return (
    <aside className="bg-sidebar text-sidebar-foreground fixed inset-y-0 left-0 z-20 hidden w-64 flex-col lg:flex">
      <div className="px-6 pt-7 pb-9">
        <Link to="/" aria-label="RentPadi dashboard" className="inline-block">
          <Logo size="md" tone="onBrand" />
        </Link>
      </div>

      <nav aria-label="Main" className="flex-1 px-3">
        <ul className="space-y-1">
          {nav.map(({ to, label, icon: Icon, end, tour }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                data-tour={tour}
                className={({ isActive }) =>
                  cn(
                    'relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-white/40',
                    isActive
                      ? 'bg-white/12 text-white'
                      : 'text-white/70 hover:bg-white/8 hover:text-white'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span aria-hidden="true" className="bg-gold absolute top-1/2 -left-3 h-6 w-1 -translate-y-1/2 rounded-r-full" />
                    )}
                    <Icon className="size-4.5" />
                    {label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>

        <Button asChild variant="gold" className="mt-7 w-full">
          <Link to="/tenants/new">
            <UserPlus /> Add tenant
          </Link>
        </Button>
      </nav>

      {landlord && (
        <NavLink
          to="/profile"
          aria-label={`${name}: your profile`}
          className={({ isActive }) =>
            cn(
              'm-3 flex items-center gap-3 rounded-xl p-3 transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-white/40',
              isActive ? 'bg-white/16' : 'bg-white/8 hover:bg-white/12'
            )
          }
        >
          <Avatar name={name ?? ''} size="sm" className="size-9" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-white">{name}</span>
            <span className="figure block truncate text-xs text-white/60">
              {formatNgPhone(landlord.phone)}
            </span>
          </span>
        </NavLink>
      )}
    </aside>
  );
}
