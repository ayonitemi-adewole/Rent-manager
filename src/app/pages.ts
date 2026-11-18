// Each page is its own download, fetched the first time it is opened.
// A tenant opening a payment link only downloads the tenant page, not the landlord app.

export const pages = {
  login: () => import('@/features/auth/LoginPage'),
  onboarding: () => import('@/features/landlord/OnboardingPage'),

  tenantPortal: () => import('@/features/public/TenantPortalPage'),
  paymentResult: () => import('@/features/public/PaymentResultPage'),
  receipt: () => import('@/features/public/ReceiptPage'),
  legal: () => import('@/features/legal/LegalPages'),

  dashboard: () => import('@/features/dashboard/DashboardPage'),
  properties: () => import('@/features/properties/PropertiesPage'),
  propertyDetail: () => import('@/features/properties/PropertyDetailPage'),
  propertyForm: () => import('@/features/properties/PropertyFormPage'),
  unitForm: () => import('@/features/properties/UnitFormPage'),
  tenants: () => import('@/features/tenants/TenantsPage'),
  tenantDetail: () => import('@/features/tenants/TenantDetailPage'),
  tenantForms: () => import('@/features/tenants/TenantFormPages'),
  statement: () => import('@/features/tenants/StatementPage'),
  recordPayment: () => import('@/features/payments/RecordPaymentPage'),
  settings: () => import('@/features/settings/SettingsPage'),
  payout: () => import('@/features/payout/PayoutPage'),
}

/** Pages a landlord opens most, fetched in the background once the app is idle. */
const COMMON: (keyof typeof pages)[] = [
  'properties',
  'propertyDetail',
  'tenants',
  'tenantDetail',
  'recordPayment',
  'settings',
]

type NetworkInfo = { saveData?: boolean; effectiveType?: string }

/** Skipped when the phone has Data Saver on or the connection is 2G. */
export function prefetchCommonPages() {
  const connection = (navigator as Navigator & { connection?: NetworkInfo }).connection
  if (connection?.saveData || /2g/.test(connection?.effectiveType ?? '')) return

  const run = () => {
    for (const name of COMMON) pages[name]().catch(() => {}) // a failed prefetch retries on click
  }
  if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 5000 })
  else setTimeout(run, 2000)
}
