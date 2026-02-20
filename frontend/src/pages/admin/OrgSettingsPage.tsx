import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import { FormField } from '@/components/ui/form-field'
import { LoadingState } from '@/components/ui/loading-state'
import { useOrganization, useUpdateOrganization } from '@/hooks/queries'

const US_TIMEZONES = [
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

export default function OrgSettingsPage() {
  const { data: org, isLoading } = useOrganization()
  const updateMut = useUpdateOrganization()

  const { register, handleSubmit, reset, formState: { errors, isDirty }, setValue, watch } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  const timezone = watch('timezone')

  useEffect(() => {
    if (org) {
      reset({ name: org.name, timezone: org.timezone })
    }
  }, [org, reset])

  function onSubmit(values: FormValues) {
    updateMut.mutate(values, {
      onSuccess: () => toast.success('Settings saved'),
    })
  }

  if (isLoading) return <LoadingState />

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
                    <SelectValue placeholder="Select timezone…" />
                  </SelectTrigger>
                  <SelectContent>
                    {US_TIMEZONES.map((tz) => (
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
                {new Date(org.created_at).toLocaleDateString()}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
