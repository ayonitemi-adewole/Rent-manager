import { createBrowserRouter } from 'react-router'
import { LoginPage } from '@/features/auth/LoginPage'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { PropertiesPage } from '@/features/properties/PropertiesPage'
import { ReceiptPage } from '@/features/public/ReceiptPage'
import { TenantPortalPage } from '@/features/public/TenantPortalPage'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { TenantsPage } from '@/features/tenants/TenantsPage'
import { AppLayout } from './AppLayout'
import { NotFoundPage } from './NotFoundPage'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },

  // Public, no login: links sent to tenants by SMS.
  { path: '/t/:token', element: <TenantPortalPage /> },
  { path: '/r/:token', element: <ReceiptPage /> },

  // Landlord app.
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'properties', element: <PropertiesPage /> },
          { path: 'tenants', element: <TenantsPage /> },
          { path: 'settings', element: <SettingsPage /> },
        ],
      },
    ],
  },

  { path: '*', element: <NotFoundPage /> },
])
