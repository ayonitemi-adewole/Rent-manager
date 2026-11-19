import { Monitor, Moon, Palette, Sun, type LucideIcon } from 'lucide-react'
import { CollapsibleCard } from '@/components/CollapsibleCard'
import { setThemePref, useThemePref, type ThemePref } from '@/lib/theme'
import { cn } from '@/lib/utils'

const OPTIONS: { value: ThemePref; label: string; icon: LucideIcon }[] = [
  { value: 'system', label: 'Device', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
]

/** Light, dark, or follow the device. Saved on this device only. */
export function AppearanceCard() {
  const pref = useThemePref()

  return (
    <CollapsibleCard
      id="appearance"
      icon={<Palette />}
      title="Appearance"
      description="Light, dark, or follow your device."
      status={OPTIONS.find((o) => o.value === pref)?.label}
    >
      <fieldset>
        <legend className="sr-only">Theme</legend>
        <div className="bg-muted grid grid-cols-3 gap-1 rounded-lg p-1">
          {OPTIONS.map(({ value, label, icon: Icon }) => (
            <label
              key={value}
              className={cn(
                'text-muted-foreground flex h-11 cursor-pointer items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors',
                'has-[:focus-visible]:ring-ring/50 has-[:focus-visible]:ring-[3px]',
                pref === value ? 'bg-background text-foreground shadow-sm' : 'hover:text-foreground',
              )}
            >
              <input
                type="radio"
                name="theme"
                value={value}
                checked={pref === value}
                onChange={() => setThemePref(value)}
                className="sr-only"
              />
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <p className="text-muted-foreground text-xs">
        {pref === 'system'
          ? 'Following your device’s light or dark setting. Saved on this device only.'
          : `Always ${pref}, whatever your device is set to. Saved on this device only.`}
      </p>
    </CollapsibleCard>
  )
}
