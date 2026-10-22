import { Link } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { formatCount, formatDate, formatINR } from "@/lib/format"
import { cn } from "@/lib/utils"

/** "In Production - Cover Design" -> "In production · Cover design" */
function statusLabel(status) {
  const [main, detail] = status.split(" - ")
  if (!detail) return status
  return `${main.charAt(0)}${main.slice(1).toLowerCase()} · ${detail.charAt(0)}${detail.slice(1).toLowerCase()}`
}

export function BookStatusBadge({ book }) {
  return <Badge variant={book.stage === "published" ? "success" : "warning"}>{statusLabel(book.status)}</Badge>
}

/** label + value pair; `strong` highlights the value */
function Stat({ label, value, strong }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("font-semibold", strong && "text-primary-strong")}>{value}</dd>
    </div>
  )
}

/**
 * One book with every field the brief asks for: title, ISBN, genre, publication
 * date, status, MRP, copies sold, royalty earned / paid / pending.
 * Edge cases: in-production books show "—" for missing MRP and date;
 * books never paid out say "No payout yet" instead of a blank date.
 */
export function BookCard({ book, linkToDetail = true }) {
  const inProduction = book.stage === "in_production"
  const titleId = `book-${book.id}-title`

  return (
    <Card role="article" className="gap-4" aria-labelledby={titleId}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="grid min-w-0 gap-1">
          <h2 id={titleId} className="text-lg leading-snug">
            {linkToDetail ? (
              <Link to={`/author/books/${book.id}`} className="hover:underline">
                {book.title}
              </Link>
            ) : (
              book.title
            )}
          </h2>
          <p className="text-sm text-muted-foreground">
            {book.genre ?? "—"} · ISBN {book.isbn ?? "—"}
          </p>
        </div>
        <BookStatusBadge book={book} />
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        <Stat label="Published" value={formatDate(book.publication_date)} />
        <Stat label="MRP" value={formatINR(book.mrp)} />
        <Stat label="Copies sold" value={formatCount(book.total_copies_sold)} />
      </dl>

      {inProduction ? (
        <p className="rounded-md bg-surface-3 px-3 py-2 text-sm text-muted-foreground">
          Sales and royalties will appear here once your book is published.
        </p>
      ) : (
        <div className="grid gap-2 border-t border-border pt-4">
          <dl className="grid grid-cols-3 gap-x-4">
            <Stat label="Royalty earned" value={formatINR(book.total_royalty_earned)} />
            <Stat label="Paid" value={formatINR(book.royalty_paid)} />
            <Stat label="Pending" value={formatINR(book.royalty_pending)} strong={book.royalty_pending > 0} />
          </dl>
          <p className="text-xs text-muted-foreground">
            {book.last_royalty_payout_date
              ? `Last payout: ${formatDate(book.last_royalty_payout_date)}`
              : "No payout yet"}
          </p>
        </div>
      )}
    </Card>
  )
}
