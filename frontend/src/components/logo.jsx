import { BookOpen } from "lucide-react"
import { cn } from "@/lib/utils"

function Logo({ className }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <BookOpen className="size-5" aria-hidden="true" />
      </span>
      <span className="text-xl font-extrabold tracking-tight text-ink">
        Book<span className="text-primary-strong">Leaf</span>
      </span>
    </div>
  )
}

export { Logo }
