import { LogoMark } from '@/components/Logo'

/** The mark with a small spinner under it, like the boot screen in index.html. */
export function FullPageSpinner() {
  return (
    <div className="grid min-h-dvh place-items-center motion-safe:animate-enter-late" role="status" aria-label="Loading">
      <div className="flex flex-col items-center gap-5">
        <LogoMark size={56} />
        <span className="border-primary/20 border-t-primary size-5 animate-spin rounded-full border-[3px] motion-reduce:animate-[spin_2.4s_linear_infinite]" />
      </div>
    </div>
  )
}
