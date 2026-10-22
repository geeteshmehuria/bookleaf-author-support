import * as React from "react"
import { cva } from "class-variance-authority"
import { CircleCheckIcon, InfoIcon, OctagonXIcon, TriangleAlertIcon } from "lucide-react"
import { cn } from "@/lib/utils"

// Text uses *-strong colours on soft backgrounds (all >= 4.5:1). Never white on success/warning.
const alertVariants = cva(
  "relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-md border px-4 py-3 text-sm has-[>svg]:grid-cols-[calc(var(--spacing)*5)_1fr] has-[>svg]:gap-x-3 [&>svg]:size-5 [&>svg]:text-current",
  {
    variants: {
      variant: {
        default: "border-border bg-card text-card-foreground",
        success: "border-success/40 bg-success-soft text-success-strong",
        warning: "border-warning/40 bg-warning-soft text-warning-strong",
        danger: "border-destructive/40 bg-danger-soft text-danger-strong",
        info: "border-info/40 bg-info-soft text-info-strong",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const icons = {
  success: CircleCheckIcon,
  warning: TriangleAlertIcon,
  danger: OctagonXIcon,
  info: InfoIcon,
}

/** Pass `icon={false}` to hide the default icon for the variant. */
function Alert({
  className,
  variant = "default",
  icon = true,
  children,
  ...props
}) {
  const Icon = icon && icons[variant]
  return (
    <div
      data-slot="alert"
      role={variant === "danger" || variant === "warning" ? "alert" : "status"}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      {Icon && <Icon aria-hidden="true" />}
      {children}
    </div>
  )
}

function AlertTitle({
  className,
  ...props
}) {
  return (
    <div
      data-slot="alert-title"
      className={cn("col-start-2 min-h-4 font-bold", className)}
      {...props}
    />
  )
}

// Inherits the variant's text colour so it stays AA on the soft background.
function AlertDescription({
  className,
  ...props
}) {
  return (
    <div
      data-slot="alert-description"
      className={cn("col-start-2 grid justify-items-start gap-1 text-sm text-current [&_p]:leading-relaxed", className)}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription }
