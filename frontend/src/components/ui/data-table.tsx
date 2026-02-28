import { useState, useCallback, useMemo } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { EmptyState } from "@/components/ui/empty-state"
import { LoadingState } from "@/components/ui/loading-state"
import { Button } from "@/components/ui/button"
import { ArrowUp, ArrowDown, ChevronsUpDown, ChevronLeft, ChevronRight } from "lucide-react"

export interface Column<T> {
  header: string
  accessorKey?: keyof T
  cell?: (row: T) => React.ReactNode
  className?: string
  sortable?: boolean
  /** Custom sort value extractor. Falls back to accessorKey value. */
  sortValue?: (row: T) => string | number | null | undefined
}

type SortDirection = 'asc' | 'desc'

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  isLoading?: boolean
  emptyMessage?: string
  emptyDescription?: string
  emptyAction?: React.ReactNode
  rowKey: (row: T) => string
  selectable?: boolean
  onSelectionChange?: (selectedKeys: Set<string>) => void
  toolbar?: (selectedKeys: Set<string>) => React.ReactNode
  /** Enable client-side pagination with this page size. */
  pageSize?: number
  /** Increment this value to clear the current selection (e.g. after a bulk operation). */
  clearSelectionKey?: number
}

function getSortValue<T>(row: T, col: Column<T>): string | number | null | undefined {
  if (col.sortValue) return col.sortValue(row)
  if (col.accessorKey != null) {
    const v = row[col.accessorKey]
    if (v == null) return null
    if (typeof v === 'number') return v
    return String(v)
  }
  return null
}

function compareValues(a: string | number | null | undefined, b: string | number | null | undefined, dir: SortDirection): number {
  // Nulls always sort last
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1

  let cmp: number
  if (typeof a === 'number' && typeof b === 'number') {
    cmp = a - b
  } else {
    cmp = String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
  }
  return dir === 'desc' ? -cmp : cmp
}

export function DataTable<T>({
  columns,
  data,
  isLoading,
  emptyMessage = "No data",
  emptyDescription,
  emptyAction,
  rowKey,
  selectable,
  onSelectionChange,
  toolbar,
  pageSize,
  clearSelectionKey,
}: DataTableProps<T>) {
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [sortColIndex, setSortColIndex] = useState<number | null>(null)
  const [sortDir, setSortDir] = useState<SortDirection>('asc')
  const [page, setPage] = useState(0)

  // Clear selection when clearSelectionKey changes (e.g. after bulk operations).
  // Track the last-seen key in state to detect changes without refs or effects.
  const [lastClearKey, setLastClearKey] = useState(clearSelectionKey)
  if (clearSelectionKey !== undefined && clearSelectionKey !== lastClearKey) {
    setLastClearKey(clearSelectionKey)
    setSelectedKeys(new Set())
  }

  const updateSelection = useCallback((next: Set<string>) => {
    setSelectedKeys(next)
    onSelectionChange?.(next)
  }, [onSelectionChange])

  const toggleAll = useCallback(() => {
    if (selectedKeys.size === data.length) {
      updateSelection(new Set())
    } else {
      updateSelection(new Set(data.map(rowKey)))
    }
  }, [selectedKeys.size, data, rowKey, updateSelection])

  const toggleOne = useCallback((key: string) => {
    const next = new Set(selectedKeys)
    if (next.has(key)) {
      next.delete(key)
    } else {
      next.add(key)
    }
    updateSelection(next)
  }, [selectedKeys, updateSelection])

  const handleSort = useCallback((colIndex: number) => {
    if (sortColIndex === colIndex) {
      if (sortDir === 'asc') {
        setSortDir('desc')
      } else {
        // Clear sort
        setSortColIndex(null)
        setSortDir('asc')
      }
    } else {
      setSortColIndex(colIndex)
      setSortDir('asc')
    }
    setPage(0)
  }, [sortColIndex, sortDir])

  const sortedData = useMemo(() => {
    if (sortColIndex == null) return data
    const col = columns[sortColIndex]
    if (!col) return data
    return [...data].sort((a, b) =>
      compareValues(getSortValue(a, col), getSortValue(b, col), sortDir)
    )
  }, [data, columns, sortColIndex, sortDir])

  const totalPages = pageSize ? Math.max(1, Math.ceil(sortedData.length / pageSize)) : 1
  const clampedPage = Math.min(page, totalPages - 1)

  const pagedData = useMemo(() => {
    if (!pageSize) return sortedData
    const start = clampedPage * pageSize
    return sortedData.slice(start, start + pageSize)
  }, [sortedData, pageSize, clampedPage])

  if (isLoading) {
    return <LoadingState />
  }

  if (data.length === 0) {
    return <EmptyState title={emptyMessage} description={emptyDescription} action={emptyAction} />
  }

  const allSelected = selectedKeys.size === data.length
  const someSelected = selectedKeys.size > 0 && selectedKeys.size < data.length

  return (
    <div>
      {toolbar && selectedKeys.size > 0 && (
        <div className="mb-2">
          {toolbar(selectedKeys)}
        </div>
      )}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {selectable && (
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                    onCheckedChange={toggleAll}
                    aria-label="Select all rows"
                  />
                </TableHead>
              )}
              {columns.map((col, i) => (
                <TableHead key={i} className={col.className}>
                  {col.sortable ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 hover:text-foreground transition-colors -ml-1 px-1 py-0.5 rounded"
                      onClick={() => handleSort(i)}
                    >
                      {col.header}
                      {sortColIndex === i ? (
                        sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedData.map((row) => {
              const key = rowKey(row)
              return (
                <TableRow key={key} data-state={selectedKeys.has(key) ? 'selected' : undefined}>
                  {selectable && (
                    <TableCell className="w-10">
                      <Checkbox
                        checked={selectedKeys.has(key)}
                        onCheckedChange={() => toggleOne(key)}
                        aria-label={`Select row ${key}`}
                      />
                    </TableCell>
                  )}
                  {columns.map((col, i) => (
                    <TableCell key={i} className={col.className}>
                      {col.cell
                        ? col.cell(row)
                        : col.accessorKey
                          ? String(row[col.accessorKey] ?? '')
                          : null}
                    </TableCell>
                  ))}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      {pageSize && totalPages > 1 && (
        <div className="flex items-center justify-between px-2 py-3 text-sm text-muted-foreground">
          <span>
            {clampedPage * pageSize + 1}–{Math.min((clampedPage + 1) * pageSize, sortedData.length)} of {sortedData.length}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={clampedPage === 0}
              onClick={() => setPage(p => Math.max(0, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only">Previous page</span>
            </Button>
            <span className="px-2">
              Page {clampedPage + 1} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={clampedPage >= totalPages - 1}
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            >
              <ChevronRight className="h-4 w-4" />
              <span className="sr-only">Next page</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
