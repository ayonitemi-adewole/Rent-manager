import { Outlet } from 'react-router'
import { AuthProvider } from './AuthProvider'

/** Login and the landlord app. Loaded only on those pages, so tenant links skip the login system. */
export function AuthLayout() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  )
}
