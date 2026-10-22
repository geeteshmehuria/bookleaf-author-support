import { Badge } from "@/components/ui/badge"

const VARIANT = { Critical: "danger", High: "warning", Medium: "info", Low: "neutral" }

export function PriorityBadge({ priority }) {
  return <Badge variant={VARIANT[priority] ?? "neutral"}>{priority}</Badge>
}
