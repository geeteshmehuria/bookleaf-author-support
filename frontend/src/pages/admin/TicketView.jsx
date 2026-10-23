import { useState } from "react"
import { Link, useLocation, useParams } from "react-router-dom"
import { AlertTriangle, ArrowLeft, Lock, RefreshCw, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { BookStatusBadge } from "@/components/books/BookCard"
import { AiDraftPanel } from "@/components/tickets/AiDraftPanel"
import { EmptyState, ErrorState, LoadingCards } from "@/components/feedback"
import { PriorityBadge } from "@/components/tickets/PriorityBadge"
import { TicketStatusBadge } from "@/components/tickets/TicketStatusBadge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Field } from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/context/auth"
import { useApi } from "@/hooks/use-api"
import { formatDate, formatDateTime, formatHours, formatINR, formatRelative } from "@/lib/format"
import { CATEGORIES, PRIORITIES, STATUSES } from "@/lib/tickets"
import { cn } from "@/lib/utils"
import { api } from "@/services/api"

const UNASSIGNED = "none"

// --- Small pieces ------------------------------------------------------------

function Message({ who, when, tone, tag, children }) {
  return (
    <li
      className={cn(
        "grid gap-1 rounded-card p-4",
        tone === "support" && "bg-tint",
        tone === "author" && "border border-border bg-surface",
        tone === "note" && "border border-warning/40 bg-warning-soft"
      )}
    >
      <p className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="flex items-center gap-2 font-bold">
          {who}
          {tag}
        </span>
        <time dateTime={when} title={formatDateTime(when)} className="text-muted-foreground">
          {formatRelative(when)}
        </time>
      </p>
      <p className="text-sm whitespace-pre-wrap">{children}</p>
    </li>
  )
}

function ComposeBox({ label, helper, placeholder, submitLabel, onSubmit, extraAction, text: outerText, onTextChange }) {
  const [ownText, setOwnText] = useState("")
  const text = outerText ?? ownText
  const setText = onTextChange ?? setOwnText
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  async function send(extra) {
    if (busy) return
    if (!text.trim()) return setError("Write something first")
    setBusy(true)
    setError("")
    try {
      await onSubmit(text.trim(), extra)
      setText("")
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        send()
      }}
      noValidate
    >
      <Field label={label} helper={helper} error={error}>
        <Textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            if (error) setError("")
          }}
          rows={4}
          maxLength={5000}
          placeholder={placeholder}
          disabled={busy}
        />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" shape="pill" disabled={busy}>
          {busy ? "Saving…" : submitLabel}
        </Button>
        {extraAction && (
          <Button type="button" size="sm" shape="pill" variant="secondary" disabled={busy} onClick={() => send(extraAction.value)}>
            {extraAction.label}
          </Button>
        )}
      </div>
    </form>
  )
}

function SideSelect({ id, label, value, options, onChange, disabled, helper }) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <Field label={label} helper={helper}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
      </Field>
      <SelectContent>
        {options.map(([v, text]) => (
          <SelectItem key={v} value={v}>
            {text}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** "AI suggested: High" / "Overridden. AI suggested: High" / "Set by keyword rules" */
function aiHelper(current, suggested, source) {
  if (!suggested) return source === "rules" ? "Set by keyword rules (AI was unavailable)" : "Not classified by AI yet"
  return current === suggested ? `AI suggested: ${suggested}` : `Overridden. AI suggested: ${suggested}`
}

function Dl({ rows }) {
  return (
    <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1.5 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="min-w-0 break-words">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

// --- Page --------------------------------------------------------------------

export default function TicketView() {
  const { ticketId } = useParams()
  const { state } = useLocation()
  const { user } = useAuth()
  // Refreshes every 10 s so a new message from the author appears while the admin has the ticket open.
  const { data: ticket, error, loading, reload, setData } = useApi(`/admin/tickets/${encodeURIComponent(ticketId)}`, {
    pollMs: 10000,
  })
  const { data: team } = useApi("/admin/team")
  const [saving, setSaving] = useState(false)
  // fromDraft: the admin started from the AI draft (stays true if they edit it), stored as is_ai_drafted
  const [reply, setReply] = useState({ text: "", fromDraft: false })
  const setReplyText = (text) => setReply((r) => ({ text, fromDraft: text ? r.fromDraft : false }))

  const backTo = `/admin${state?.from ?? ""}`
  const back = (
    <Button asChild variant="link" className="w-fit text-sm">
      <Link to={backTo}>
        <ArrowLeft aria-hidden="true" /> Ticket queue
      </Link>
    </Button>
  )

  if (loading && !ticket) return <LoadingCards count={2} label="Loading ticket" />
  if (error?.status === 404) {
    return (
      <div className="grid gap-4">
        {back}
        <EmptyState title="Ticket not found" />
      </div>
    )
  }
  if (error) return <ErrorState error={error} onRetry={reload} title="Couldn't load this ticket" />

  /** PATCH one field; the API returns the updated ticket. */
  async function update(changes, message) {
    setSaving(true)
    try {
      setData(await api.patch(`/admin/tickets/${ticket.id}`, changes))
      toast.success(message)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function sendReply(body, resolveAfter) {
    // Show the reply as soon as it's saved. If resolving then fails, don't throw:
    // the compose box would keep the text and invite sending the same reply twice.
    setData(await api.post(`/admin/tickets/${ticket.id}/replies`, { body, is_ai_drafted: reply.fromDraft }))
    if (!resolveAfter) return toast.success("Reply sent to the author")
    try {
      setData(await api.patch(`/admin/tickets/${ticket.id}`, { status: "Resolved" }))
      toast.success("Reply sent and ticket resolved")
    } catch (err) {
      toast.error(`Reply sent, but the ticket couldn't be resolved: ${err.message}`)
    }
  }

  async function reclassify() {
    setSaving(true)
    try {
      setData(await api.post(`/admin/tickets/${ticket.id}/classify`))
      toast.success("Classified by AI")
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function addNote(body) {
    setData(await api.post(`/admin/tickets/${ticket.id}/notes`, { body }))
    toast.success("Internal note added")
  }

  const book = ticket.book_detail
  const author = ticket.author_profile
  const assignedToMe = ticket.assignee?.id === user.id

  return (
    <div className="grid gap-4">
      {back}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Main column: the conversation */}
        <div className="grid gap-4">
          <Card className="gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 className="min-w-0 text-xl leading-snug">{ticket.subject}</h2>
              <div className="flex flex-wrap gap-2">
                <PriorityBadge priority={ticket.priority} />
                <TicketStatusBadge status={ticket.status} />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              #{ticket.ticket_number} · {ticket.author.name} · {ticket.book ? ticket.book.title : "General / Account level"} ·
              Raised {formatDateTime(ticket.created_at)}
            </p>
            {ticket.overdue && (
              <p className="flex items-center gap-2 text-sm font-semibold text-danger-strong">
                <AlertTriangle aria-hidden="true" className="size-4" />
                Waiting {formatHours(ticket.waiting_hours)} for a reply (over 48 h)
              </p>
            )}
          </Card>

          <section aria-label="Conversation with the author">
            <ol className="grid gap-3">
              <Message who={`${ticket.author.name} (author)`} when={ticket.created_at} tone="author">
                {ticket.description}
              </Message>
              {ticket.messages.map((m) => (
                <Message
                  key={m.id}
                  who={m.from_support ? m.sender.name : `${m.sender.name} (author)`}
                  when={m.created_at}
                  tone={m.from_support ? "support" : "author"}
                  tag={
                    m.is_ai_drafted && (
                      <Badge variant="neutral">
                        <Sparkles aria-hidden="true" /> AI draft
                      </Badge>
                    )
                  }
                >
                  {m.body}
                </Message>
              ))}
            </ol>
          </section>

          {/* Keyed on category too: changing it drops the cached draft on the server
              (it quoted the old category's policy), so the panel loads a fresh one. */}
          <AiDraftPanel
            key={`${ticket.id}:${ticket.category}`}
            ticketId={ticket.id}
            onUse={(text) => {
              setReply({ text, fromDraft: true })
              document.getElementById("reply-box")?.scrollIntoView({ behavior: "smooth", block: "center" })
            }}
          />

          <Card className="gap-3" id="reply-box">
            <ComposeBox
              text={reply.text}
              onTextChange={setReplyText}
              label={reply.fromDraft ? "Reply to the author (from AI draft, edit freely)" : "Reply to the author"}
              helper="The author sees this in their ticket. Sending moves an Open ticket to In Progress."
              submitLabel="Send reply"
              extraAction={ticket.status !== "Resolved" && ticket.status !== "Closed" ? { label: "Send & resolve", value: true } : null}
              onSubmit={sendReply}
            />
          </Card>

          <Card className="gap-3 border border-warning/40">
            <h3 className="flex items-center gap-2 text-base">
              <Lock aria-hidden="true" className="size-4 text-warning-strong" /> Internal notes
              <span className="text-xs font-normal text-muted-foreground">Never shown to the author</span>
            </h3>
            {ticket.notes.length > 0 ? (
              <ol className="grid gap-2">
                {ticket.notes.map((n) => (
                  <Message key={n.id} who={n.admin.name} when={n.created_at} tone="note">
                    {n.body}
                  </Message>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">No notes yet.</p>
            )}
            <ComposeBox label="Add a note" submitLabel="Add note" placeholder="e.g. Checked with the print floor…" onSubmit={addNote} />
          </Card>
        </div>

        {/* Side column: manage + context */}
        <div className="grid gap-4 lg:sticky lg:top-20">
          <Card className="gap-4">
            <h3 className="text-base">Manage</h3>
            <SideSelect
              id="m-status"
              label="Status"
              value={ticket.status}
              disabled={saving}
              options={STATUSES.map((s) => [s, s])}
              onChange={(v) => update({ status: v }, `Status set to ${v}`)}
            />
            <SideSelect
              id="m-category"
              label="Category"
              value={ticket.category}
              disabled={saving}
              helper={aiHelper(ticket.category, ticket.ai_category, ticket.classified_by)}
              options={CATEGORIES.map((c) => [c, c])}
              onChange={(v) => update({ category: v }, `Category set to ${v}`)}
            />
            <SideSelect
              id="m-priority"
              label="Priority"
              value={ticket.priority}
              disabled={saving}
              helper={aiHelper(ticket.priority, ticket.ai_priority, ticket.classified_by)}
              options={PRIORITIES.map((p) => [p, p])}
              onChange={(v) => update({ priority: v }, `Priority set to ${v}`)}
            />
            <div className="grid gap-2">
              <SideSelect
                id="m-assignee"
                label="Assigned to"
                value={ticket.assignee?.id ?? UNASSIGNED}
                disabled={saving || !team}
                options={[[UNASSIGNED, "Unassigned"], ...(team ?? []).map((p) => [p.id, p.id === user.id ? `${p.name} (me)` : p.name])]}
                onChange={(v) => update({ assigned_to: v === UNASSIGNED ? null : v }, v === UNASSIGNED ? "Unassigned" : "Assignee updated")}
              />
              {!assignedToMe && (
                <Button size="sm" variant="secondary" className="w-fit" disabled={saving} onClick={() => update({ assigned_to: user.id }, "Assigned to you")}>
                  Assign to me
                </Button>
              )}
            </div>
            {ticket.ai_reasoning && (
              <p className="rounded-md bg-surface-3 p-3 text-xs text-muted-foreground">
                <span className="font-semibold">{ticket.classified_by === "ai" ? "AI reasoning: " : "Why: "}</span>
                {ticket.ai_reasoning}
              </p>
            )}
            {ticket.classified_by !== "ai" && (
              <Button size="sm" variant="secondary" className="w-fit" disabled={saving} onClick={reclassify}>
                <RefreshCw aria-hidden="true" /> Classify with AI
              </Button>
            )}
          </Card>

          <Card className="gap-3">
            <h3 className="text-base">Author</h3>
            <Dl
              rows={[
                ["Name", author.name],
                ["Email", <a key="e" href={`mailto:${author.email}`} className="text-link hover:underline">{author.email}</a>],
                ["Phone", author.phone ?? "—"],
                ["City", author.city ?? "—"],
                ["Joined", formatDate(author.joined_date.slice(0, 10))],
                ["Books", author.book_count],
              ]}
            />
          </Card>

          <Card className="gap-3">
            <h3 className="text-base">Book</h3>
            {book ? (
              <>
                <div className="grid gap-1">
                  <p className="font-semibold">{book.title}</p>
                  <BookStatusBadge book={book} />
                </div>
                <Dl
                  rows={[
                    ["ISBN", book.isbn ?? "—"],
                    ["Published", formatDate(book.publication_date)],
                    ["MRP", formatINR(book.mrp)],
                    ["Copies sold", book.total_copies_sold],
                    ["Earned", formatINR(book.total_royalty_earned)],
                    ["Paid", formatINR(book.royalty_paid)],
                    ["Pending", formatINR(book.royalty_pending)],
                    ["Last payout", book.last_royalty_payout_date ? formatDate(book.last_royalty_payout_date) : "No payout yet"],
                    ["Print partner", book.print_partner ?? "—"],
                  ]}
                />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">General / account-level query. No book selected.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
