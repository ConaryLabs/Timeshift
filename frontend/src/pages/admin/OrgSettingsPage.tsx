// frontend/src/pages/admin/OrgSettingsPage.tsx
/* eslint-disable react-hooks/incompatible-library */
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import { FormField } from '@/components/ui/form-field'
import { LoadingState } from '@/components/ui/loading-state'
import { ErrorState } from '@/components/ui/error-state'
import { useOrganization, useUpdateOrganization, useOrgSettings, useSetOrgSetting } from '@/hooks/queries'
import type { OrgSetting } from '@/api/organization'
import { extractApiError, formatDate } from '@/lib/format'

const BASE_US_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'America/Phoenix',
  'America/Boise',
  'America/Indiana/Indianapolis',
]

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  timezone: z.string().min(1, 'Timezone is required'),
})

type FormValues = z.infer<typeof schema>

const MONTHS = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
]

const PAY_PERIOD_TYPES = [
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'semimonthly', label: 'Semi-Monthly' },
  { value: 'monthly', label: 'Monthly' },
]

const SETTING_LABELS: Record<string, string> = {
  fiscal_year_start_month: 'Fiscal Year Start Month',
  pay_period_type: 'Pay Period Type',
  bid_cycle_months: 'Bid Cycle',
  vacation_hours_charged_sep_feb: 'Vacation Hours (Sep-Feb)',
}

function getSettingLabel(key: string): string {
  return SETTING_LABELS[key] ?? key.replace(/_/g, ' ')
}

function getSettingValue(settings: OrgSetting[] | undefined, key: string): string {
  const s = settings?.find((s) => s.key === key)
  if (!s) return ''
  const val = s.value
  if (typeof val === 'string') return val
  if (typeof val === 'number') return String(val)
  return ''
}

function ConfigSection() {
  const { data: settings, isLoading } = useOrgSettings()
  const setMut = useSetOrgSetting()

  const [localFiscalMonth, setFiscalMonth] = useState<string | null>(null)
  const [localPayPeriod, setPayPeriod] = useState<string | null>(null)
  const [localBidCycle, setBidCycle] = useState<string | null>(null)

  const fiscalMonth = localFiscalMonth ?? (getSettingValue(settings, 'fiscal_year_start_month') || '1')
  const payPeriod = localPayPeriod ?? (getSettingValue(settings, 'pay_period_type') || 'biweekly')
  const bidCycle = localBidCycle ?? (getSettingValue(settings, 'bid_cycle_months') || '6')

  function saveSetting(key: string, value: string | number) {
    setMut.mutate(
      { key, value: value },
      {
        onSuccess: () => toast.success(`${getSettingLabel(key)} saved`),
        onError: (err: unknown) => {
          const msg = extractApiError(err, 'Failed to save setting')
          toast.error(msg)
        },
      },
    )
  }

  if (isLoading) return <LoadingState />

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <FormField label="Fiscal Year Start Month" htmlFor="cfg-fiscal" className="flex-1">
          <Select value={fiscalMonth} onValueChange={setFiscalMonth}>
            <SelectTrigger id="cfg-fiscal">
              <SelectValue placeholder="Select month" />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <Button
          size="sm"
          variant="outline"
          aria-label="Save fiscal year start month"
          onClick={() => saveSetting('fiscal_year_start_month', Number(fiscalMonth))}
          disabled={setMut.isPending}
        >
          <Save className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-end gap-3">
        <FormField label="Pay Period Type" htmlFor="cfg-pay" className="flex-1">
          <Select value={payPeriod} onValueChange={setPayPeriod}>
            <SelectTrigger id="cfg-pay">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {PAY_PERIOD_TYPES.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <Button
          size="sm"
          variant="outline"
          aria-label="Save pay period type"
          onClick={() => saveSetting('pay_period_type', payPeriod)}
          disabled={setMut.isPending}
        >
          <Save className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-end gap-3">
        <FormField label="Bid Cycle (months)" htmlFor="cfg-bid" className="flex-1">
          <Input
            id="cfg-bid"
            type="number"
            min={1}
            max={24}
            value={bidCycle}
            onChange={(e) => setBidCycle(e.target.value)}
          />
        </FormField>
        <Button
          size="sm"
          variant="outline"
          aria-label="Save bid cycle"
          onClick={() => saveSetting('bid_cycle_months', Number(bidCycle))}
          disabled={setMut.isPending}
        >
          <Save className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

export default function OrgSettingsPage() {
  const { data: org, isLoading, isError } = useOrganization()
  const updateMut = useUpdateOrganization()

  // Include the org's current timezone in the list even if it's not in the base list
  const timezones = useMemo(() => {
    if (!org || BASE_US_TIMEZONES.includes(org.timezone)) return BASE_US_TIMEZONES
    return [org.timezone, ...BASE_US_TIMEZONES]
  }, [org])

  const { register, handleSubmit, reset, formState: { errors, isDirty }, setValue, watch } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: org ? { name: org.name, timezone: org.timezone } : { name: '', timezone: '' },
    resetOptions: { keepDirtyValues: true },
  })

  const timezone = watch('timezone')

  function onSubmit(values: FormValues) {
    updateMut.mutate(values, {
      onSuccess: (data) => {
        toast.success('Organization updated')
        reset({ name: data.name, timezone: data.timezone })
      },
      onError: (err: unknown) => {
        const msg = extractApiError(err, 'Failed to update organization')
        toast.error(msg)
      },
    })
  }

  if (isLoading) return <LoadingState />

  if (isError) {
    return (
      <div>
        <PageHeader title="Organization Settings" />
        <ErrorState message="Failed to load organization settings." />
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Organization Settings" />

      <div className="max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>General</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <FormField label="Organization Name" htmlFor="org-name" required error={errors.name?.message}>
                <Input id="org-name" {...register('name')} />
              </FormField>
              <FormField label="Timezone" htmlFor="org-tz" required error={errors.timezone?.message}>
                <Select value={timezone} onValueChange={(v) => setValue('timezone', v, { shouldDirty: true })}>
                  <SelectTrigger id="org-tz">
                    <SelectValue placeholder="Select timezone..." />
                  </SelectTrigger>
                  <SelectContent>
                    {timezones.map((tz) => (
                      <SelectItem key={tz} value={tz}>{tz.replace(/_/g, ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <Button type="submit" disabled={updateMut.isPending || !isDirty}>
                Save Changes
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <ConfigSection />
          </CardContent>
        </Card>

        {org && (
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Slug:</span>{' '}
                <span className="font-mono">{org.slug}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Created:</span>{' '}
                {formatDate(org.created_at)}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
