import { Badge } from "@/components/ui/badge"

const VARIANT = { Open: "info", "In Progress": "warning", Resolved: "success", Closed: "neutral" }

export function TicketStatusBadge({ status }) {
  return <Badge variant={VARIANT[status] ?? "neutral"}>{status}</Badge>
}
