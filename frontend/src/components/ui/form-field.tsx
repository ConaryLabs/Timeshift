import { isValidElement, cloneElement } from "react"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface FormFieldProps {
  label: string
  htmlFor?: string
  error?: string
  required?: boolean
  className?: string
  children: React.ReactNode
}

export function FormField({ label, htmlFor, error, required, className, children }: FormFieldProps) {
  const errorId = htmlFor ? `${htmlFor}-error` : undefined

  // Inject aria-describedby (when error) and aria-required (when required) on the child input
  let enhanced = children
  if (isValidElement(children)) {
    const extraProps: Record<string, unknown> = {}
    if (error && errorId) {
      extraProps['aria-describedby'] = errorId
    }
    if (required) {
      extraProps['aria-required'] = true
    }
    if (Object.keys(extraProps).length > 0) {
      enhanced = cloneElement(children as React.ReactElement<Record<string, unknown>>, extraProps)
    }
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {enhanced}
      {error && <p id={errorId} className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
