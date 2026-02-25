import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  User,
  Mail,
  Phone,
  Briefcase,
  CalendarDays,
  Hash,
  Save,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/ui/page-header'
import { LoadingState } from '@/components/ui/loading-state'
import { useAuthStore } from '@/store/auth'
import { useMyPreferences, useUpdateMyPreferences } from '@/hooks/queries'
import { extractApiError } from '@/lib/format'

const EMPLOYEE_TYPE_LABELS: Record<string, string> = {
  regular_full_time: 'Regular Full Time',
  job_share: 'Job Share',
  medical_part_time: 'Medical Part Time',
  temp_part_time: 'Temp Part Time',
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '\u2014'
  const d = new Date(dateStr + 'T00:00:00')
  if (isNaN(d.getTime())) return '\u2014'
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  )
}

export default function MyProfilePage() {
  const user = useAuthStore((s) => s.user)
  const { data: prefs, isLoading: prefsLoading, isError: prefsError } = useMyPreferences()
  const updatePrefsMut = useUpdateMyPreferences()

  const [emailNotif, setEmailNotif] = useState(true)
  const [smsNotif, setSmsNotif] = useState(false)
  const [preferredView, setPreferredView] = useState<'month' | 'week' | 'day'>('week')
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!prefs) return
    setEmailNotif(prefs.notification_email)
    setSmsNotif(prefs.notification_sms)
    setPreferredView(prefs.preferred_view)
    setDirty(false)
  }, [prefs])

  function handleSave() {
    updatePrefsMut.mutate(
      {
        notification_email: emailNotif,
        notification_sms: smsNotif,
        preferred_view: preferredView,
      },
      {
        onSuccess: () => {
          setDirty(false)
          toast.success('Preferences saved')
        },
        onError: (err: unknown) => {
          const msg = extractApiError(err, 'Failed to save preferences')
          toast.error(msg)
        },
      },
    )
  }

  if (!user) return null

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="My Profile"
        description="View your profile and manage preferences"
      />

      {/* Profile info */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Profile Information</CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          <InfoRow icon={User} label="Name" value={`${user.first_name} ${user.last_name}`} />
          <InfoRow icon={Mail} label="Email" value={user.email} />
          <InfoRow icon={Phone} label="Phone" value={user.phone || '\u2014'} />
          <InfoRow icon={Hash} label="Employee ID" value={user.employee_id || '\u2014'} />
          <InfoRow
            icon={Briefcase}
            label="Classification"
            value={user.classification_name || '\u2014'}
          />
          <InfoRow
            icon={Briefcase}
            label="Employee Type"
            value={EMPLOYEE_TYPE_LABELS[user.employee_type] || user.employee_type}
          />
          <InfoRow icon={CalendarDays} label="Hire Date" value={formatDate(user.hire_date)} />
          <InfoRow icon={CalendarDays} label="Overall Seniority" value={formatDate(user.overall_seniority_date)} />
          <InfoRow icon={CalendarDays} label="Bargaining Unit Seniority" value={formatDate(user.bargaining_unit_seniority_date)} />
          <InfoRow icon={CalendarDays} label="Classification Seniority" value={formatDate(user.classification_seniority_date)} />
        </CardContent>
      </Card>

      {/* Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Preferences</CardTitle>
        </CardHeader>
        <CardContent>
          {prefsLoading ? (
            <LoadingState message="Loading preferences..." />
          ) : prefsError ? (
            <p className="text-sm text-destructive p-4">Failed to load preferences.</p>
          ) : (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="email-notif">Email Notifications</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Receive email notifications for schedule changes
                  </p>
                </div>
                <Switch
                  id="email-notif"
                  checked={emailNotif}
                  onCheckedChange={(v) => {
                    setEmailNotif(v)
                    setDirty(true)
                  }}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="sms-notif">SMS Notifications</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Receive text message alerts for urgent updates
                  </p>
                </div>
                <Switch
                  id="sms-notif"
                  checked={smsNotif}
                  onCheckedChange={(v) => {
                    setSmsNotif(v)
                    setDirty(true)
                  }}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Preferred Schedule View</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Default view when opening My Schedule
                  </p>
                </div>
                <Select
                  value={preferredView}
                  onValueChange={(v: 'month' | 'week' | 'day') => {
                    setPreferredView(v)
                    setDirty(true)
                  }}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week">Week</SelectItem>
                    <SelectItem value="month">Month</SelectItem>
                    <SelectItem value="day">Day</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="pt-2">
                <Button
                  onClick={handleSave}
                  disabled={!dirty || updatePrefsMut.isPending}
                  className="gap-1.5"
                >
                  <Save className="h-4 w-4" />
                  {updatePrefsMut.isPending ? 'Saving...' : 'Save Preferences'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
