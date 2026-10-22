import * as React from "react"
import { cn } from "@/lib/utils"
import { Progress as ProgressPrimitive } from "radix-ui"

/**
 * Pill progress bar: tint track, brand-coral fill.
 * `label` (e.g. "Day 7 / 21") is shown above the bar and used as the accessible name.
 */
function Progress({
  className,
  value,
  max = 100,
  label,
  ...props
}) {
  const id = React.useId()
  const pct = Math.min(100, Math.max(0, ((value || 0) / max) * 100))

  const bar = (
    <ProgressPrimitive.Root
      data-slot="progress"
      value={value}
      max={max}
      aria-labelledby={label ? id : undefined}
      className={cn("relative h-2.5 w-full overflow-hidden rounded-pill bg-tint", className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="h-full w-full flex-1 rounded-pill bg-brand transition-transform"
        style={{ transform: `translateX(-${100 - pct}%)` }}
      />
    </ProgressPrimitive.Root>
  )

  if (!label) return bar

  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span id={id} className="font-semibold text-foreground">{label}</span>
        <span className="text-muted-foreground">{Math.round(pct)}%</span>
      </div>
      {bar}
    </div>
  )
}

export { Progress }
