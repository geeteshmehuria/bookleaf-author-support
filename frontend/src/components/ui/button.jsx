import * as React from "react"
import { cva } from "class-variance-authority"
import { cn, focusRing } from "@/lib/utils"
import { Slot } from "radix-ui"

const buttonVariants = cva(
  cn(
    "inline-flex shrink-0 items-center justify-center gap-2 font-cta font-medium whitespace-nowrap transition-colors",
    "disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    focusRing
  ),
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground not-disabled:hover:bg-primary-action-hover",
        secondary:
          "border border-brand bg-surface text-primary-strong not-disabled:hover:bg-tint",
        ghost: "text-foreground not-disabled:hover:bg-accent not-disabled:hover:text-accent-foreground",
        destructive: "bg-destructive text-white not-disabled:hover:bg-primary-action-hover",
        link: "text-link underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-3 text-sm has-[>svg]:px-2.5",
        default: "h-10 px-4 text-sm has-[>svg]:px-3",
        lg: "h-[52px] px-7 text-base",
        icon: "size-10",
        "icon-sm": "size-8",
      },
      shape: {
        rounded: "rounded-sm",
        pill: "rounded-pill",
      },
    },
    compoundVariants: [{ variant: "link", className: "h-auto px-0" }],
    defaultVariants: {
      variant: "default",
      size: "default",
      shape: "rounded",
    },
  }
)

/**
 * shape="pill" for CTAs and login, "rounded" (default) for admin screens.
 */
function Button({
  className,
  variant = "default",
  size = "default",
  shape = "rounded",
  asChild = false,
  type,
  ...props
}) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      type={asChild ? undefined : (type ?? "button")}
      className={cn(buttonVariants({ variant, size, shape, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
