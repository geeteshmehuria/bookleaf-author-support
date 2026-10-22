import { useState } from "react"
import { Link, useParams } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import { EmptyState, ErrorState, LoadingCards } from "@/components/feedback"
import { TicketStatusBadge } from "@/components/tickets/TicketStatusBadge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Field } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { useApi } from "@/hooks/use-api"
import { formatDateTime, formatRelative } from "@/lib/format"
import { cn } from "@/lib/utils"
import { api } from "@/services/api"

function BackLink() {
  return (
    <Button asChild variant="link" className="w-fit text-sm">
      <Link to="/author/support">
        <ArrowLeft aria-hidden="true" /> All queries
      </Link>
    </Button>
  )
}

function Message({ who, when, from_support, children }) {
  return (
    <li className={cn("grid gap-1 rounded-card p-4", from_support ? "bg-tint" : "border border-border bg-surface")}>
      <p className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
        <span className={cn("font-bold", from_support ? "text-primary-strong" : "text-foreground")}>{who}</span>
        <time dateTime={when} title={formatDateTime(when)} className="text-muted-foreground">
          {formatRelative(when)}
        </time>
      </p>
      {/* whitespace-pre-wrap keeps the author's line breaks; text is rendered as text, never as HTML */}
      <p className="text-sm whitespace-pre-wrap">{children}</p>
    </li>
  )
}

export default function TicketDetail() {
  const { ticketId } = useParams()
  const { data, error, loading, reload } = useApi(`/tickets/${encodeURIComponent(ticketId)}`)
  // The reply call returns the updated ticket; show that instead of reloading.
  const [updated, setUpdated] = useState(null)
  const ticket = updated?.id === ticketId ? updated : data

  const [reply, setReply] = useState("")
  const [replyError, setReplyError] = useState("")
  const [sending, setSending] = useState(false)

  if (loading && !ticket) return <LoadingCards count={2} label="Loading query" />
  if (error?.status === 404) {
    return (
      <div className="grid gap-4">
        <BackLink />
        <EmptyState title="Query not found">We couldn't find this query in your account.</EmptyState>
      </div>
    )
  }
  if (error) return <ErrorState error={error} onRetry={reload} title="Couldn't load this query" />

  async function onReply(e) {
    e.preventDefault()
    if (sending) return
    if (!reply.trim()) return setReplyError("Write a message first")
    setSending(true)
    setReplyError("")
    try {
      setUpdated(await api.post(`/tickets/${ticket.id}/replies`, { body: reply.trim() }))
      setReply("")
    } catch (err) {
      setReplyError(err.message)
      if (err.code === "TICKET_CLOSED") {
        // Drop the copy from an earlier reply, or it would hide the fresh (closed) ticket.
        setUpdated(null)
        reload()
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="grid gap-4">
      <BackLink />

      <Card className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="min-w-0 text-xl leading-snug">{ticket.subject}</h2>
          <TicketStatusBadge status={ticket.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          #{ticket.ticket_number} ·{" "}
          {ticket.book ? (
            <Link to={`/author/books/${ticket.book.id}`} className="hover:underline">
              {ticket.book.title}
            </Link>
          ) : (
            "General / Account level"
          )}{" "}
          · Raised {formatDateTime(ticket.created_at)}
        </p>
      </Card>

      <section aria-label="Conversation" className="grid gap-3">
        <ol className="grid gap-3">
          <Message who="Your query" when={ticket.created_at}>
            {ticket.description}
          </Message>
          {ticket.messages.map((m) => (
            <Message key={m.id} who={m.sender_name} when={m.created_at} from_support={m.from_support}>
              {m.body}
            </Message>
          ))}
        </ol>

        {ticket.messages.length === 0 && ticket.status === "Open" && (
          <p className="text-sm text-muted-foreground">
            Thanks, we've got your query. Our team usually replies within 48 hours; you'll see the reply here.
          </p>
        )}
      </section>

      {ticket.can_reply ? (
        <Card className="gap-3">
          <form className="grid gap-3" onSubmit={onReply} noValidate>
            <Field
              label="Add a reply"
              error={replyError}
              helper={ticket.status === "Resolved" ? "Replying will reopen this query." : undefined}
            >
              <Textarea
                value={reply}
                onChange={(e) => {
                  setReply(e.target.value)
                  if (replyError) setReplyError("")
                }}
                rows={3}
                maxLength={5000}
                disabled={sending}
              />
            </Field>
            <Button type="submit" size="sm" shape="pill" className="w-fit" disabled={sending}>
              {sending ? "Sending…" : "Send reply"}
            </Button>
          </form>
        </Card>
      ) : (
        <Alert>
          <AlertDescription>
            This query is closed. Need more help?{" "}
            <Link to="/author/support/new" className="font-semibold underline">
              Raise a new query
            </Link>
            .
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
