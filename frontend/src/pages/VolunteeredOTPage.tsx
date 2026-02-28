import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { ErrorState } from '@/components/ui/error-state'
import { DataTable, type Column } from '@/components/ui/data-table'
import { StatusBadge } from '@/components/ui/status-badge'
import { useOtRequests, useWithdrawVolunteerOtRequest } from '@/hooks/queries'
import { formatTime, formatDate, formatDay, extractApiError } from '@/lib/format'
import type { OtRequest } from '@/api/otRequests'

export default function VolunteeredOTPage() {
  // Fetch only requests where the current user has an active volunteer entry
  const { data: requests, isLoading, isError, refetch } = useOtRequests({ volunteered_by_me: true })
  const withdrawMut = useWithdrawVolunteerOtRequest()
  const [pendingWithdrawId, setPendingWithdrawId] = useState<string | null>(null)

  function handleWithdraw(id: string) {
    setPendingWithdrawId(id)
    withdrawMut.mutate(id, {
      onSuccess: () => toast.success('Volunteer entry withdrawn'),
      onError: (err: unknown) => {
        toast.error(extractApiError(err, 'Failed to withdraw'))
      },
      onSettled: () => setPendingWithdrawId(null),
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
      header: 'My Status',
      cell: (r) => r.user_assigned
        ? <StatusBadge status="assigned" />
        : <StatusBadge status="volunteered" />,
    },
    {
      header: 'Slot Status',
      cell: (r) => <StatusBadge status={r.status} />,
    },
    {
      header: 'Actions',
      cell: (r) =>
        !r.user_assigned && (r.status === 'open' || r.status === 'partially_filled') ? (
          <Button
            size="sm"
            variant="outline"
            className="text-red-700 hover:bg-red-50"
            onClick={() => handleWithdraw(r.id)}
            disabled={pendingWithdrawId === r.id}
            aria-label={`Withdraw volunteer for OT on ${formatDate(r.date)}`}
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
        <ErrorState message="Failed to load volunteered OT." onRetry={() => refetch()} />
      ) : (
        <DataTable
          columns={columns}
          data={requests ?? []}
          isLoading={isLoading}
          emptyMessage="No volunteered overtime"
          emptyDescription="You have not volunteered for any OT slots. Browse available overtime to volunteer."
          emptyAction={
            <Button asChild size="sm" variant="outline">
              <Link to="/available-ot">Browse Available OT</Link>
            </Button>
          }
          rowKey={(r) => r.id}
        />
      )}
    </div>
  )
}
