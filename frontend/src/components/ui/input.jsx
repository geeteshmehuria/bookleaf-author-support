import * as React from "react"
import { cn, fieldBase } from "@/lib/utils"

function Input({
  className,
  type,
  ...props
}) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        fieldBase,
        "h-10 py-2 selection:bg-tint selection:text-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-semibold file:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export { Input }
