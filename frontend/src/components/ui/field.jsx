import * as React from "react"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"

/**
 * Label + control + helper/error text.
 * The single child control gets id, aria-describedby and aria-invalid wired automatically:
 *   <Field label="Email" error={errors.email}><Input type="email" /></Field>
 */
function Field({ label, helper, error, required, className, children }) {
  const id = React.useId()
  const helperId = `${id}-helper`
  const errorId = `${id}-error`
  const describedBy = [error && errorId, helper && helperId].filter(Boolean).join(" ") || undefined

  const child = React.Children.only(children)
  const control = React.cloneElement(child, {
    id: child.props.id ?? id,
    "aria-describedby": describedBy,
    "aria-invalid": error ? true : undefined,
    "aria-required": required || undefined,
  })

  return (
    <div data-slot="field" className={cn("grid gap-1.5", className)}>
      <Label htmlFor={child.props.id ?? id} className="font-semibold">
        {label}
        {required && <span aria-hidden="true" className="text-primary-strong">*</span>}
      </Label>
      {control}
      {helper && (
        <p id={helperId} className="text-xs text-muted-foreground">
          {helper}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs font-semibold text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

export { Field }
