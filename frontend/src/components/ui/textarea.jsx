import * as React from "react"
import { cn, fieldBase } from "@/lib/utils"

function Textarea({
  className,
  ...props
}) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(fieldBase, "flex field-sizing-content min-h-24 py-2", className)}
      {...props}
    />
  )
}

export { Textarea }
