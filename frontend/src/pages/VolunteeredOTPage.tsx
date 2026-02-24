import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { DataTable, type Column } from '@/components/ui/data-table'
import { StatusBadge } from '@/components/ui/status-badge'
import { useOtRequests, useWithdrawVolunteerOtRequest } from '@/hooks/queries'
import { formatTime } from '@/lib/format'
import type { OtRequest } from '@/api/otRequests'

export default function VolunteeredOTPage() {
  // Fetch only requests where the current user has an active volunteer entry
  const { data: requests, isLoading, isError } = useOtRequests({ volunteered_by_me: true })
  const withdrawMut = useWithdrawVolunteerOtRequest()

  function handleWithdraw(id: string) {
    withdrawMut.mutate(id, {
      onSuccess: () => toast.success('Volunteer entry withdrawn'),
      onError: (err: unknown) => {
        const msg =
          (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
          'Failed to withdraw'
        toast.error(msg)
      },
    })
  }

  function formatDate(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  }

  function formatDay(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'long',
    })
  }

  const columns: Column<OtRequest>[] = [
    {
      header: 'Day',
      cell: (r) => formatDay(r.date),
    },
    {
      header: 'Date',
      cell: (r) => formatDate(r.date),
    },
    {
      header: 'Time',
      cell: (r) => `${formatTime(r.start_time)} - ${formatTime(r.end_time)}`,
    },
    {
      header: 'Hours',
      cell: (r) => r.hours.toFixed(1),
      className: 'tabular-nums',
    },
    {
      header: 'Position',
      cell: (r) => r.classification_name,
    },
    {
      header: 'Location',
      cell: (r) => r.location ?? '-',
      className: 'max-w-[120px] truncate',
    },
    {
      header: 'Status',
      cell: (r) => <StatusBadge status={r.status} />,
    },
    {
      header: 'Actions',
      cell: (r) =>
        r.status === 'open' || r.status === 'partially_filled' ? (
          <Button
            size="sm"
            variant="outline"
            className="text-red-700 hover:bg-red-50"
            onClick={() => handleWithdraw(r.id)}
            disabled={withdrawMut.isPending}
          >
            Withdraw
          </Button>
        ) : null,
    },
  ]

  return (
    <div>
      <PageHeader title="My Volunteered OT" />

      {isError ? (
        <p className="text-sm text-destructive">Failed to load volunteered OT.</p>
      ) : (
        <DataTable
          columns={columns}
          data={requests ?? []}
          isLoading={isLoading}
          emptyMessage="No volunteered overtime"
          emptyDescription="You have not volunteered for any OT slots. Browse available overtime to volunteer."
          rowKey={(r) => r.id}
        />
      )}
    </div>
  )
}
