import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const STATUS_VARIANTS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  approved: "bg-green-100 text-green-800 border-green-200",
  denied: "bg-red-100 text-red-800 border-red-200",
  cancelled: "bg-slate-100 text-slate-600 border-slate-200",
  open: "bg-green-100 text-green-800 border-green-200",
  filled: "bg-blue-100 text-blue-800 border-blue-200",
  active: "bg-green-100 text-green-800 border-green-200",
  inactive: "bg-slate-100 text-slate-600 border-slate-200",
}

interface StatusBadgeProps {
  status: string
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs font-medium capitalize",
        STATUS_VARIANTS[status] ?? "bg-slate-100 text-slate-600 border-slate-200",
        className,
      )}
    >
      {status}
    </Badge>
  )
}
