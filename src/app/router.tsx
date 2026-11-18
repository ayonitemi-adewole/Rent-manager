import type { ComponentType } from 'react'
import { createBrowserRouter } from 'react-router'
import { FullPageSpinner } from '@/components/FullPageSpinner'
import { NotFoundPage } from './NotFoundPage'
import { pages } from './pages'
import { RouteError } from './RouteError'

/** Route that downloads its page the first time it is opened. */
function page<K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) {
  return { lazy: { Component: async () => (await load())[name] } }
}

export const router = createBrowserRouter([
  {
    // Shown while the first page downloads, and if a page fails to download.
    HydrateFallback: FullPageSpinner,
    ErrorBoundary: RouteError,
    children: [
      // Public, no login: links sent to tenants by SMS.
      { path: '/t/:token', ...page(pages.tenantPortal, 'TenantPortalPage') },
      {
        path: '/t/:token/paid',
        ...page(pages.paymentResult, 'PaymentResultPage'),
      },
      { path: '/r/:token', ...page(pages.receipt, 'ReceiptPage') },

      // Login and the landlord app.
      {
        ...page(() => import('@/features/auth/AuthLayout'), 'AuthLayout'),
        children: [
          { path: '/login', ...page(pages.login, 'LoginPage') },
          {
            ...page(() => import('@/features/auth/RequireAuth'), 'RequireAuth'),
            children: [
              {
                path: 'onboarding',
                ...page(pages.onboarding, 'OnboardingPage'),
              },
              {
                ...page(() => import('@/features/landlord/RequireLandlord'), 'RequireLandlord'),
                children: [
                  {
                    ...page(() => import('./AppLayout'), 'AppLayout'),
                    children: [
                      {
                        index: true,
                        ...page(pages.dashboard, 'DashboardPage'),
                      },
                      {
                        path: 'properties',
                        ...page(pages.properties, 'PropertiesPage'),
                      },
                      {
                        path: 'properties/new',
                        ...page(pages.propertyForm, 'NewPropertyPage'),
                      },
                      {
                        path: 'properties/:propertyId',
                        ...page(pages.propertyDetail, 'PropertyDetailPage'),
                      },
                      {
                        path: 'properties/:propertyId/edit',
                        ...page(pages.propertyForm, 'EditPropertyPage'),
                      },
                      {
                        path: 'properties/:propertyId/units/new',
                        ...page(pages.unitForm, 'NewUnitPage'),
                      },
                      {
                        path: 'properties/:propertyId/units/:unitId/edit',
                        ...page(pages.unitForm, 'EditUnitPage'),
                      },
                      {
                        path: 'tenants',
                        ...page(pages.tenants, 'TenantsPage'),
                      },
                      {
                        path: 'tenants/new',
                        ...page(pages.tenantForms, 'NewTenantPage'),
                      },
                      {
                        path: 'tenants/:tenantId',
                        ...page(pages.tenantDetail, 'TenantDetailPage'),
                      },
                      {
                        path: 'tenants/:tenantId/edit',
                        ...page(pages.tenantForms, 'EditTenantPage'),
                      },
                      {
                        path: 'tenants/:tenantId/statement',
                        ...page(pages.statement, 'StatementPage'),
                      },
                      {
                        path: 'tenants/:tenantId/charges/:chargeId/record',
                        ...page(pages.recordPayment, 'RecordPaymentPage'),
                      },
                      {
                        path: 'settings',
                        ...page(pages.settings, 'SettingsPage'),
                      },
                      {
                        path: 'settings/payout',
                        ...page(pages.payout, 'PayoutPage'),
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },

      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
