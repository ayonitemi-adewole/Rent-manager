import { LogOut } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/features/auth/auth-context'
import { formatNgPhone } from '@/lib/phone'

export function SettingsPage() {
  const { session, signOut } = useAuth()
  const phone = session?.user.phone

  return (
    <>
      <PageHeader title="Settings" />
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>{phone ? formatNgPhone(phone) : 'Signed in'}</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Payout account</CardTitle>
            <CardDescription>
              The bank account tenants' rent is paid into. Coming in Week 3 (Flutterwave).
            </CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardContent>
            <Button variant="outline" className="w-full" onClick={signOut}>
              <LogOut /> Sign out
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
