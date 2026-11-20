import type { ComponentType } from 'react'
import { createBrowserRouter } from 'react-router'
import { FullPageSpinner } from '@/components/FullPageSpinner'
import { NotFoundPage } from './NotFoundPage'
import { pages } from './pages'
import { RouteError } from './RouteError'

/** How wide a page may grow on large screens (AppLayout reads it from the route handle). */
export type PageWidth = 'narrow' | 'wide'
const narrow = { width: 'narrow' satisfies PageWidth }

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
      { path: '/terms', ...page(pages.legal, 'TermsPage') },
      { path: '/privacy', ...page(pages.legal, 'PrivacyPage') },

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
                        handle: narrow,
                        ...page(pages.propertyForm, 'NewPropertyPage'),
                      },
                      {
                        path: 'properties/:propertyId',
                        ...page(pages.propertyDetail, 'PropertyDetailPage'),
                      },
                      {
                        path: 'properties/:propertyId/edit',
                        handle: narrow,
                        ...page(pages.propertyForm, 'EditPropertyPage'),
                      },
                      {
                        path: 'properties/:propertyId/units/new',
                        handle: narrow,
                        ...page(pages.unitForm, 'NewUnitPage'),
                      },
                      {
                        path: 'properties/:propertyId/units/:unitId/edit',
                        handle: narrow,
                        ...page(pages.unitForm, 'EditUnitPage'),
                      },
                      {
                        path: 'tenants',
                        ...page(pages.tenants, 'TenantsPage'),
                      },
                      {
                        path: 'tenants/new',
                        handle: narrow,
                        ...page(pages.tenantForms, 'NewTenantPage'),
                      },
                      {
                        path: 'tenants/:tenantId',
                        ...page(pages.tenantDetail, 'TenantDetailPage'),
                      },
                      {
                        path: 'tenants/:tenantId/edit',
                        handle: narrow,
                        ...page(pages.tenantForms, 'EditTenantPage'),
                      },
                      {
                        path: 'tenants/:tenantId/statement',
                        ...page(pages.statement, 'StatementPage'),
                      },
                      {
                        path: 'tenants/:tenantId/charges/:chargeId/record',
                        handle: narrow,
                        ...page(pages.recordPayment, 'RecordPaymentPage'),
                      },
                      {
                        path: 'settings',
                        handle: narrow,
                        ...page(pages.settings, 'SettingsPage'),
                      },
                      {
                        path: 'settings/payout',
                        handle: narrow,
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
