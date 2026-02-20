import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface LoadingStateProps {
  message?: string
  className?: string
}

export function LoadingState({ message = "Loading…", className }: LoadingStateProps) {
  return (
    <div className={cn("flex items-center justify-center py-12 gap-2 text-muted-foreground", className)}>
      <Loader2 className="h-5 w-5 animate-spin" />
      <span className="text-sm">{message}</span>
    </div>
  )
}
