import * as React from "react"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"

/** Big highlight number with a small muted label under it (dashboards). */
function StatCard({ value, label, icon: Icon, className, ...props }) {
  return (
    <Card data-slot="stat-card" className={cn("gap-1", className)} {...props}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[32px] leading-none font-extrabold text-highlight">{value}</p>
        {Icon && <Icon aria-hidden="true" className="size-6 shrink-0 text-brand" />}
      </div>
      <p className="text-sm text-muted-foreground">{label}</p>
    </Card>
  )
}

export { StatCard }
