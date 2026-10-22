import { Link } from "react-router-dom"
import { LifeBuoy, MessageSquare, Plus } from "lucide-react"
import { EmptyState, ErrorState, LoadingCards } from "@/components/feedback"
import { TicketStatusBadge } from "@/components/tickets/TicketStatusBadge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useApi } from "@/hooks/use-api"
import { formatDateTime, formatRelative } from "@/lib/format"

function NewQueryButton() {
  return (
    <Button asChild shape="pill">
      <Link to="/author/support/new">
        <Plus aria-hidden="true" /> New query
      </Link>
    </Button>
  )
}

export default function MyTickets() {
  // Refreshes every 5 s: status changes and new replies show up without reloading.
  const { data: tickets, error, loading, reload } = useApi("/tickets", { pollMs: 5000 })

  if (loading) return <LoadingCards count={3} label="Loading your queries" />
  if (error) return <ErrorState error={error} onRetry={reload} title="Couldn't load your queries" />
  if (tickets.length === 0) {
    return (
      <EmptyState icon={LifeBuoy} title="No queries yet" action={<NewQueryButton />}>
        Questions about royalties, your book's status, ISBN, printing or distribution? Our team usually replies within
        48 hours.
      </EmptyState>
    )
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {tickets.length} {tickets.length === 1 ? "query" : "queries"}
        </p>
        <NewQueryButton />
      </div>

      <ul className="grid gap-3">
        {tickets.map((t) => (
          <li key={t.id}>
            <Card className="relative gap-2 p-5 transition-shadow hover:shadow-pop">
              <div className="flex items-start justify-between gap-3">
                <h2 className="min-w-0 text-base leading-snug">
                  {/* the whole card is clickable through this link's ::after */}
                  <Link to={`/author/support/${t.id}`} className="after:absolute after:inset-0 hover:underline">
                    {t.subject}
                  </Link>
                </h2>
                <TicketStatusBadge status={t.status} />
              </div>
              <p className="text-sm text-muted-foreground">
                #{t.ticket_number} · {t.book ? t.book.title : "General / Account level"}
              </p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span title={formatDateTime(t.updated_at)}>Updated {formatRelative(t.updated_at)}</span>
                <span className="inline-flex items-center gap-1">
                  <MessageSquare aria-hidden="true" className="size-3.5" />
                  {t.reply_count} {t.reply_count === 1 ? "reply" : "replies"}
                </span>
                {t.last_reply_from_support && t.status !== "Closed" && (
                  <span className="font-semibold text-primary-strong">BookLeaf replied</span>
                )}
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  )
}
