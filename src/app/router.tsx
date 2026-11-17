import { createBrowserRouter } from 'react-router'
import { LoginPage } from '@/features/auth/LoginPage'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { OnboardingPage } from '@/features/landlord/OnboardingPage'
import { RequireLandlord } from '@/features/landlord/RequireLandlord'
import { PropertiesPage } from '@/features/properties/PropertiesPage'
import { PropertyDetailPage } from '@/features/properties/PropertyDetailPage'
import { EditPropertyPage, NewPropertyPage } from '@/features/properties/PropertyFormPage'
import { EditUnitPage, NewUnitPage } from '@/features/properties/UnitFormPage'
import { RecordPaymentPage } from '@/features/payments/RecordPaymentPage'
import { PayoutPage } from '@/features/payout/PayoutPage'
import { PaymentResultPage } from '@/features/public/PaymentResultPage'
import { ReceiptPage } from '@/features/public/ReceiptPage'
import { TenantPortalPage } from '@/features/public/TenantPortalPage'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { TenantDetailPage } from '@/features/tenants/TenantDetailPage'
import { EditTenantPage, NewTenantPage } from '@/features/tenants/TenantFormPages'
import { StatementPage } from '@/features/tenants/StatementPage'
import { TenantsPage } from '@/features/tenants/TenantsPage'
import { AppLayout } from './AppLayout'
import { NotFoundPage } from './NotFoundPage'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },

  // Public, no login: links sent to tenants by SMS.
  { path: '/t/:token', element: <TenantPortalPage /> },
  { path: '/t/:token/paid', element: <PaymentResultPage /> },
  { path: '/r/:token', element: <ReceiptPage /> },

  // Landlord app.
  {
    element: <RequireAuth />,
    children: [
      { path: 'onboarding', element: <OnboardingPage /> },
      {
        element: <RequireLandlord />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { index: true, element: <DashboardPage /> },
              { path: 'properties', element: <PropertiesPage /> },
              { path: 'properties/new', element: <NewPropertyPage /> },
              { path: 'properties/:propertyId', element: <PropertyDetailPage /> },
              { path: 'properties/:propertyId/edit', element: <EditPropertyPage /> },
              { path: 'properties/:propertyId/units/new', element: <NewUnitPage /> },
              { path: 'properties/:propertyId/units/:unitId/edit', element: <EditUnitPage /> },
              { path: 'tenants', element: <TenantsPage /> },
              { path: 'tenants/new', element: <NewTenantPage /> },
              { path: 'tenants/:tenantId', element: <TenantDetailPage /> },
              { path: 'tenants/:tenantId/edit', element: <EditTenantPage /> },
              { path: 'tenants/:tenantId/statement', element: <StatementPage /> },
              { path: 'tenants/:tenantId/charges/:chargeId/record', element: <RecordPaymentPage /> },
              { path: 'settings', element: <SettingsPage /> },
              { path: 'settings/payout', element: <PayoutPage /> },
            ],
          },
        ],
      },
    ],
  },

  { path: '*', element: <NotFoundPage /> },
])
