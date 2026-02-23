import { useState } from 'react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { DataTable, type Column } from '@/components/ui/data-table'
import { FormField } from '@/components/ui/form-field'
import {
  useCoverageReport,
  useOtSummaryReport,
  useLeaveSummaryReport,
  useTeams,
  useClassifications,
} from '@/hooks/queries'
import type { CoverageReport, OtSummaryReport, LeaveSummaryReport } from '@/api/reports'

const currentYear = new Date().getFullYear()
const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i)

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function CoverageStatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    over: 'bg-blue-100 text-blue-800 border-blue-200',
    met: 'bg-green-100 text-green-800 border-green-200',
    under: 'bg-amber-100 text-amber-800 border-amber-200',
    critical: 'bg-red-100 text-red-800 border-red-200',
  }
  return (
    <Badge variant="outline" className={`text-xs font-medium capitalize ${variants[status] ?? ''}`}>
      {status}
    </Badge>
  )
}

// -- Coverage Tab --

function CoverageTab() {
  const today = new Date()
  const thirtyDaysAgo = new Date(today)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 7)
  const thirtyDaysFromNow = new Date(today)
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 7)

  const [startDate, setStartDate] = useState(thirtyDaysAgo.toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState(thirtyDaysFromNow.toISOString().slice(0, 10))
  const [teamId, setTeamId] = useState<string>('')

  const { data: teams } = useTeams()
  const { data, isLoading, isError } = useCoverageReport({
    start_date: startDate,
    end_date: endDate,
    team_id: teamId || undefined,
  })

  const columns: Column<CoverageReport>[] = [
    { header: 'Date', cell: (r) => formatDate(r.date) },
    { header: 'Shift', accessorKey: 'shift_name' },
    { header: 'Required', cell: (r) => String(r.required_headcount), className: 'text-center' },
    { header: 'Actual', cell: (r) => String(r.actual_headcount), className: 'text-center' },
    { header: 'Coverage', cell: (r) => `${r.coverage_percent}%`, className: 'text-center' },
    { header: 'Status', cell: (r) => <CoverageStatusBadge status={r.status} /> },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <FormField label="Start Date" htmlFor="cov-start">
          <Input id="cov-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" />
        </FormField>
        <FormField label="End Date" htmlFor="cov-end">
          <Input id="cov-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40" />
        </FormField>
        <FormField label="Team" htmlFor="cov-team">
          <Select value={teamId || 'all'} onValueChange={(v) => setTeamId(v === 'all' ? '' : v)}>
            <SelectTrigger id="cov-team" className="w-44">
              <SelectValue placeholder="All teams" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All teams</SelectItem>
              {teams?.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </div>

      {isError ? (
        <p className="text-sm text-destructive">Failed to load coverage report.</p>
      ) : (
        <DataTable
          columns={columns}
          data={data ?? []}
          isLoading={isLoading}
          emptyMessage="No scheduled shifts in this range"
          rowKey={(r) => `${r.date}-${r.shift_template_id}`}
        />
      )}
    </div>
  )
}

// -- OT Summary Tab --

function OtSummaryTab() {
  const [fiscalYear, setFiscalYear] = useState(currentYear)
  const [classificationId, setClassificationId] = useState<string>('')

  const { data: classifications } = useClassifications()
  const { data, isLoading, isError } = useOtSummaryReport({
    fiscal_year: fiscalYear,
    classification_id: classificationId || undefined,
  })

  const columns: Column<OtSummaryReport>[] = [
    { header: 'Employee', cell: (r) => `${r.last_name}, ${r.first_name}` },
    { header: 'Classification', cell: (r) => r.classification_name ?? '-' },
    { header: 'Worked', cell: (r) => r.hours_worked.toFixed(1), className: 'text-right' },
    { header: 'Declined', cell: (r) => r.hours_declined.toFixed(1), className: 'text-right' },
    { header: 'Total', cell: (r) => r.total_hours.toFixed(1), className: 'text-right font-medium' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <FormField label="Fiscal Year" htmlFor="ot-year">
          <Select value={String(fiscalYear)} onValueChange={(v) => setFiscalYear(Number(v))}>
            <SelectTrigger id="ot-year" className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Classification" htmlFor="ot-class">
          <Select value={classificationId || 'all'} onValueChange={(v) => setClassificationId(v === 'all' ? '' : v)}>
            <SelectTrigger id="ot-class" className="w-44">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {classifications?.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </div>

      {isError ? (
        <p className="text-sm text-destructive">Failed to load OT summary.</p>
      ) : (
        <DataTable
          columns={columns}
          data={data ?? []}
          isLoading={isLoading}
          emptyMessage="No OT records for this period"
          rowKey={(r) => r.user_id}
        />
      )}
    </div>
  )
}

// -- Leave Summary Tab --

function LeaveSummaryTab() {
  const startOfYear = `${currentYear}-01-01`
  const endOfYear = `${currentYear}-12-31`

  const [startDate, setStartDate] = useState(startOfYear)
  const [endDate, setEndDate] = useState(endOfYear)

  const { data, isLoading, isError } = useLeaveSummaryReport({
    start_date: startDate,
    end_date: endDate,
  })

  const columns: Column<LeaveSummaryReport>[] = [
    { header: 'Code', accessorKey: 'leave_type_code', className: 'w-20' },
    { header: 'Leave Type', accessorKey: 'leave_type_name' },
    { header: 'Total', cell: (r) => String(r.total_requests), className: 'text-center' },
    {
      header: 'Approved',
      cell: (r) => (
        <span className="text-green-700">{r.approved_count}</span>
      ),
      className: 'text-center',
    },
    {
      header: 'Denied',
      cell: (r) => (
        <span className="text-red-700">{r.denied_count}</span>
      ),
      className: 'text-center',
    },
    {
      header: 'Pending',
      cell: (r) => (
        <span className="text-amber-700">{r.pending_count}</span>
      ),
      className: 'text-center',
    },
    {
      header: 'Hours (Approved)',
      cell: (r) => r.total_hours.toFixed(1),
      className: 'text-right',
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <FormField label="Start Date" htmlFor="leave-start">
          <Input id="leave-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" />
        </FormField>
        <FormField label="End Date" htmlFor="leave-end">
          <Input id="leave-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40" />
        </FormField>
      </div>

      {isError ? (
        <p className="text-sm text-destructive">Failed to load leave summary.</p>
      ) : (
        <DataTable
          columns={columns}
          data={data ?? []}
          isLoading={isLoading}
          emptyMessage="No leave requests in this range"
          rowKey={(r) => r.leave_type_code}
        />
      )}
    </div>
  )
}

// -- Main Page --

export default function ReportsPage() {
  const [tab, setTab] = useState('coverage')

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Coverage analytics and operational summaries"
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="coverage">Coverage</TabsTrigger>
          <TabsTrigger value="ot">OT Summary</TabsTrigger>
          <TabsTrigger value="leave">Leave Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="coverage">
          <Card>
            <CardHeader>
              <CardTitle>Shift Coverage Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <CoverageTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ot">
          <Card>
            <CardHeader>
              <CardTitle>Overtime Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <OtSummaryTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leave">
          <Card>
            <CardHeader>
              <CardTitle>Leave Usage Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <LeaveSummaryTab />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
