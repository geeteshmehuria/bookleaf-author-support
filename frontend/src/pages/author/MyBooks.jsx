import { BookOpen } from "lucide-react"
import { BookCard } from "@/components/books/BookCard"
import { EmptyState, ErrorState, LoadingCards } from "@/components/feedback"
import { useApi } from "@/hooks/use-api"
import { formatINR } from "@/lib/format"

export function bookTotals(books) {
  return books.reduce(
    (t, b) => ({
      earned: t.earned + b.total_royalty_earned,
      paid: t.paid + b.royalty_paid,
      pending: t.pending + b.royalty_pending,
      published: t.published + (b.stage === "published" ? 1 : 0),
      inProduction: t.inProduction + (b.stage === "in_production" ? 1 : 0),
    }),
    { earned: 0, paid: 0, pending: 0, published: 0, inProduction: 0 }
  )
}

export default function MyBooks() {
  const { data: books, error, loading, reload } = useApi("/books")

  if (loading) return <LoadingCards count={3} label="Loading your books" />
  if (error) return <ErrorState error={error} onRetry={reload} title="Couldn't load your books" />
  if (books.length === 0) {
    return (
      <EmptyState icon={BookOpen} title="No books yet">
        Your books will appear here once they are set up for publishing. Questions? Raise a query from Support.
      </EmptyState>
    )
  }

  const t = bookTotals(books)
  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        {books.length} {books.length === 1 ? "book" : "books"} · {formatINR(t.earned)} earned ·{" "}
        <span className="font-semibold text-primary-strong">{formatINR(t.pending)} pending</span>
      </p>
      {books.map((book) => (
        <BookCard key={book.id} book={book} />
      ))}
    </div>
  )
}
