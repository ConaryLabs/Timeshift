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

  // When an error is present, inject aria-describedby on the child input element
  const enhanced = error && errorId && isValidElement(children)
    ? cloneElement(children as React.ReactElement<Record<string, unknown>>, { 'aria-describedby': errorId })
    : children

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
