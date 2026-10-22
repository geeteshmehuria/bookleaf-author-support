import { Link, useParams } from "react-router-dom"
import { ArrowLeft, LifeBuoy } from "lucide-react"
import { BookCard } from "@/components/books/BookCard"
import { EmptyState, ErrorState, LoadingCards } from "@/components/feedback"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useApi } from "@/hooks/use-api"
import { formatINR } from "@/lib/format"

function BackLink() {
  return (
    <Button asChild variant="link" className="w-fit text-sm">
      <Link to="/author/books">
        <ArrowLeft aria-hidden="true" /> All books
      </Link>
    </Button>
  )
}

/** One book. Another author's book ID gets the same "not found" as a made-up ID (API returns 404). */
export default function BookDetail() {
  const { bookId } = useParams()
  const { data: book, error, loading, reload } = useApi(`/books/${encodeURIComponent(bookId)}`)

  if (loading) return <LoadingCards count={1} label="Loading book" />
  if (error?.status === 404) {
    return (
      <div className="grid gap-4">
        <BackLink />
        <EmptyState title="Book not found">We couldn't find this book in your account.</EmptyState>
      </div>
    )
  }
  if (error) return <ErrorState error={error} onRetry={reload} title="Couldn't load this book" />

  return (
    <div className="grid gap-4">
      <BackLink />
      <BookCard book={book} linkToDetail={false} />

      <Card className="gap-3">
        <h2 className="text-base">Details</h2>
        <dl className="grid gap-2 text-sm sm:grid-cols-[180px_1fr]">
          <dt className="text-muted-foreground">Royalty per copy</dt>
          <dd>{formatINR(book.author_royalty_per_copy)}</dd>
          <dt className="text-muted-foreground">Print partner</dt>
          <dd>{book.print_partner ?? "—"}</dd>
          <dt className="text-muted-foreground">Available on</dt>
          <dd>{book.available_on.length ? book.available_on.join(", ") : "Not listed yet"}</dd>
        </dl>
      </Card>

      <Button asChild shape="pill" className="w-fit">
        <Link to={`/author/support/new?book=${book.id}`}>
          <LifeBuoy aria-hidden="true" /> Ask about this book
        </Link>
      </Button>
    </div>
  )
}
