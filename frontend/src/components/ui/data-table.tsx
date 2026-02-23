import { useState, useCallback } from "react"
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

export interface Column<T> {
  header: string
  accessorKey?: keyof T
  cell?: (row: T) => React.ReactNode
  className?: string
}

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
}: DataTableProps<T>) {
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())

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
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => {
              const key = rowKey(row)
              return (
                <TableRow key={key} data-state={selectedKeys.has(key) ? 'selected' : undefined}>
                  {selectable && (
                    <TableCell className="w-10">
                      <Checkbox
                        checked={selectedKeys.has(key)}
                        onCheckedChange={() => toggleOne(key)}
                        aria-label="Select row"
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
    </div>
  )
}
