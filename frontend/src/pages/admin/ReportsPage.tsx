import { useState, useCallback } from 'react'
import { Download } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { DataTable, type Column } from '@/components/ui/data-table'
import { FormField } from '@/components/ui/form-field'
import {
  useCoverageReport,
  useOtSummaryReport,
  useLeaveSummaryReport,
  useOtByPeriodReport,
  useWorkSummaryReport,
  useTeams,
  useClassifications,
  useUsers,
} from '@/hooks/queries'
import type { CoverageReport, OtSummaryReport, LeaveSummaryReport, OtByPeriodReport, WorkSummaryReport } from '@/api/reports'

const currentYear = new Date().getFullYear()
const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i)

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
  ].join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
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
  const sevenDaysAgo = new Date(today)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const sevenDaysFromNow = new Date(today)
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)

  const [startDate, setStartDate] = useState(sevenDaysAgo.toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState(sevenDaysFromNow.toISOString().slice(0, 10))
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

  const handleExport = useCallback(() => {
    if (!data) return
    downloadCsv('coverage-report.csv', ['Date', 'Shift', 'Required', 'Actual', 'Coverage %', 'Status'], data.map((r) => [r.date, r.shift_name, String(r.required_headcount), String(r.actual_headcount), `${r.coverage_percent}%`, r.status]))
  }, [data])

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
        {data && data.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-1 self-end">
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
        )}
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

  const handleExport = useCallback(() => {
    if (!data) return
    downloadCsv('ot-summary.csv', ['Employee', 'Classification', 'Worked', 'Declined', 'Total'], data.map((r) => [`${r.last_name}, ${r.first_name}`, r.classification_name ?? '', r.hours_worked.toFixed(1), r.hours_declined.toFixed(1), r.total_hours.toFixed(1)]))
  }, [data])

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
        {data && data.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-1 self-end">
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
        )}
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

// -- OT by Time Period Tab --

function OtByPeriodTab() {
  const today = new Date()
  const thirtyDaysAgo = new Date(today)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const [startDate, setStartDate] = useState(thirtyDaysAgo.toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState(today.toISOString().slice(0, 10))
  const [classificationId, setClassificationId] = useState<string>('')

  const { data: classifications } = useClassifications()
  const { data, isLoading, isError } = useOtByPeriodReport({
    start_date: startDate,
    end_date: endDate,
    classification_id: classificationId || undefined,
  })

  const columns: Column<OtByPeriodReport>[] = [
    { header: 'Employee', accessorKey: 'user_name' },
    { header: 'Classification', cell: (r) => r.classification_name ?? '-' },
    { header: 'Total Hours', cell: (r) => r.total_hours.toFixed(1), className: 'text-right font-medium' },
    { header: 'OT Shifts', cell: (r) => String(r.assignments.length), className: 'text-center' },
  ]

  const handleExport = useCallback(() => {
    if (!data) return
    const rows: string[][] = []
    for (const r of data) {
      for (const a of r.assignments) {
        rows.push([r.user_name, r.classification_name ?? '', a.date, a.hours.toFixed(1), a.ot_type ?? ''])
      }
    }
    downloadCsv('ot-by-period.csv', ['Employee', 'Classification', 'Date', 'Hours', 'OT Type'], rows)
  }, [data])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <FormField label="Start Date" htmlFor="otp-start">
          <Input id="otp-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" />
        </FormField>
        <FormField label="End Date" htmlFor="otp-end">
          <Input id="otp-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40" />
        </FormField>
        <FormField label="Classification" htmlFor="otp-class">
          <Select value={classificationId || 'all'} onValueChange={(v) => setClassificationId(v === 'all' ? '' : v)}>
            <SelectTrigger id="otp-class" className="w-44">
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
        {data && data.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-1 self-end">
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
        )}
      </div>

      {isError ? (
        <p className="text-sm text-destructive">Failed to load OT by period report.</p>
      ) : (
        <DataTable
          columns={columns}
          data={data ?? []}
          isLoading={isLoading}
          emptyMessage="No OT assignments in this range"
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

  const handleExport = useCallback(() => {
    if (!data) return
    downloadCsv('leave-summary.csv', ['Code', 'Leave Type', 'Total', 'Approved', 'Denied', 'Pending', 'Hours'], data.map((r) => [r.leave_type_code, r.leave_type_name, String(r.total_requests), String(r.approved_count), String(r.denied_count), String(r.pending_count), r.total_hours.toFixed(1)]))
  }, [data])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <FormField label="Start Date" htmlFor="leave-start">
          <Input id="leave-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" />
        </FormField>
        <FormField label="End Date" htmlFor="leave-end">
          <Input id="leave-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40" />
        </FormField>
        {data && data.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-1 self-end">
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
        )}
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

// -- Work Summary Tab --

function WorkSummaryTab() {
  const today = new Date()
  const thirtyDaysAgo = new Date(today)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const [startDate, setStartDate] = useState(thirtyDaysAgo.toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState(today.toISOString().slice(0, 10))
  const [userId, setUserId] = useState<string>('')

  const { data: users } = useUsers()
  const { data, isLoading, isError } = useWorkSummaryReport({
    start_date: startDate,
    end_date: endDate,
    user_id: userId || undefined,
  })

  const columns: Column<WorkSummaryReport>[] = [
    { header: 'Employee', accessorKey: 'user_name' },
    { header: 'Regular Shifts', cell: (r) => String(r.regular_shifts), className: 'text-center' },
    { header: 'OT Shifts', cell: (r) => String(r.ot_shifts), className: 'text-center' },
    { header: 'Leave Days', cell: (r) => String(r.leave_days), className: 'text-center' },
    { header: 'Total Hours', cell: (r) => r.total_hours.toFixed(1), className: 'text-right font-medium' },
  ]

  const handleExport = useCallback(() => {
    if (!data) return
    downloadCsv('work-summary.csv', ['Employee', 'Period', 'Regular Shifts', 'OT Shifts', 'Leave Days', 'Total Hours'], data.map((r) => [r.user_name, r.period, String(r.regular_shifts), String(r.ot_shifts), String(r.leave_days), r.total_hours.toFixed(1)]))
  }, [data])

  const activeUsers = (users ?? []).filter((u) => u.is_active)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <FormField label="Start Date" htmlFor="ws-start">
          <Input id="ws-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" />
        </FormField>
        <FormField label="End Date" htmlFor="ws-end">
          <Input id="ws-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40" />
        </FormField>
        <FormField label="Employee" htmlFor="ws-user">
          <Select value={userId || 'all'} onValueChange={(v) => setUserId(v === 'all' ? '' : v)}>
            <SelectTrigger id="ws-user" className="w-52">
              <SelectValue placeholder="All employees" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All employees</SelectItem>
              {activeUsers.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.last_name}, {u.first_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        {data && data.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-1 self-end">
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
        )}
      </div>

      {isError ? (
        <p className="text-sm text-destructive">Failed to load work summary.</p>
      ) : (
        <DataTable
          columns={columns}
          data={data ?? []}
          isLoading={isLoading}
          emptyMessage="No activity in this range"
          rowKey={(r) => r.user_id}
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
          <TabsTrigger value="ot-period">OT by Period</TabsTrigger>
          <TabsTrigger value="leave">Leave Summary</TabsTrigger>
          <TabsTrigger value="work">Work Summary</TabsTrigger>
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

        <TabsContent value="ot-period">
          <Card>
            <CardHeader>
              <CardTitle>OT by Time Period</CardTitle>
            </CardHeader>
            <CardContent>
              <OtByPeriodTab />
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

        <TabsContent value="work">
          <Card>
            <CardHeader>
              <CardTitle>Work Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <WorkSummaryTab />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
