import { Navigate, Outlet } from 'react-router'
import { FullPageSpinner } from '@/components/FullPageSpinner'
import { QueryState } from '@/components/QueryState'
import { needsOnboarding, useLandlord } from './api'

/** Sends signed-in users to onboarding until they have a profile, an email and the current terms accepted. */
export function RequireLandlord() {
  const { data: landlord, isPending, error, refetch } = useLandlord()
  if (isPending) return <FullPageSpinner />
  if (error) {
    return (
      <div className="mx-auto max-w-sm px-4 py-16">
        <QueryState isPending={false} error={error} refetch={refetch} />
      </div>
    )
  }
  if (needsOnboarding(landlord)) return <Navigate to="/onboarding" replace />
  return <Outlet />
}
