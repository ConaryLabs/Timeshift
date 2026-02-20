import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
  rowKey: (row: T) => string
}

export function DataTable<T>({ columns, data, isLoading, emptyMessage = "No data", rowKey }: DataTableProps<T>) {
  if (isLoading) {
    return <LoadingState />
  }

  if (data.length === 0) {
    return <EmptyState title={emptyMessage} />
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col, i) => (
              <TableHead key={i} className={col.className}>
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow key={rowKey(row)}>
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
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
