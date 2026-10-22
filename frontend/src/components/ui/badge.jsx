import * as React from "react"
import { cva } from "class-variance-authority"
import { cn, focusRing } from "@/lib/utils"
import { Slot } from "radix-ui"

// Text always uses a *-strong colour on a soft background (AA). Never white on success/warning.
const badgeVariants = cva(
  cn(
    "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-pill border border-transparent px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3",
    focusRing
  ),
  {
    variants: {
      variant: {
        default: "bg-tint text-primary-strong",
        neutral: "bg-surface-3 text-muted-foreground",
        outline: "border-border bg-surface text-foreground",
        success: "bg-success-soft text-success-strong",
        warning: "bg-warning-soft text-warning-strong",
        info: "bg-info-soft text-info-strong",
        danger: "bg-danger-soft text-danger-strong",
      },
      uppercase: {
        true: "tracking-wide uppercase",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      uppercase: false,
    },
  }
)

function Badge({
  className,
  variant = "default",
  uppercase = false,
  asChild = false,
  ...props
}) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant, uppercase }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
