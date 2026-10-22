import { Link } from "react-router-dom"
import { BookOpen, IndianRupee, LifeBuoy, Wallet } from "lucide-react"
import { ErrorState, LoadingCards } from "@/components/feedback"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { StatCard } from "@/components/ui/stat-card"
import { useAuth } from "@/context/auth"
import { useApi } from "@/hooks/use-api"
import { formatINR } from "@/lib/format"
import { bookTotals } from "./MyBooks"

// Answers taken from BookLeaf's knowledge base, so authors can self-serve before raising a query.
const FAQ = [
  {
    q: "When are royalties paid?",
    a: "Royalties are calculated every quarter and paid by bank transfer within 45 days of the quarter ending. If your total is below ₹1,000, it rolls over to the next quarter.",
  },
  {
    q: "How long does printing take?",
    a: "Standard print turnaround is 5–7 business days from order confirmation.",
  },
  {
    q: "Something is wrong with my ISBN or book details",
    a: "Raise a query under ISBN & Metadata Issues. ISBN errors are treated as high priority and sent to our production team.",
  },
]

export default function Dashboard() {
  const { user } = useAuth()
  const { data: books, error, loading, reload } = useApi("/books")
  const firstName = user.name.split(" ")[0]

  return (
    <div className="grid gap-6">
      <section className="grid gap-1">
        <h2 className="text-2xl">
          Hello, <span className="text-highlight">{firstName}</span>
        </h2>
        <p className="text-muted-foreground">Here is how your books are doing.</p>
      </section>

      {loading && <LoadingCards count={1} label="Loading your summary" />}
      {error && <ErrorState error={error} onRetry={reload} title="Couldn't load your summary" />}
      {books && <Summary books={books} />}

      <Card>
        <CardHeader>
          <CardTitle>Need help?</CardTitle>
          <CardDescription>Ask about royalties, your book's status, ISBN, printing or distribution.</CardDescription>
          <CardAction>
            <Button asChild size="sm" shape="pill">
              <Link to="/author/support">
                <LifeBuoy aria-hidden="true" /> Get support
              </Link>
            </Button>
          </CardAction>
        </CardHeader>
      </Card>

      <section className="grid gap-2">
        <h2 className="text-xl">Common questions</h2>
        <Accordion type="single" collapsible>
          {FAQ.map(({ q, a }) => (
            <AccordionItem key={q} value={q}>
              <AccordionTrigger>{q}</AccordionTrigger>
              <AccordionContent>{a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    </div>
  )
}

function Summary({ books }) {
  const t = bookTotals(books)
  const booksLabel =
    t.inProduction > 0 ? `Published · ${t.inProduction} in production` : t.published === 1 ? "Published book" : "Published books"

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard value={t.published} label={booksLabel} icon={BookOpen} />
        <StatCard value={formatINR(t.earned)} label="Royalty earned" icon={IndianRupee} />
        <StatCard value={formatINR(t.pending)} label="Royalty pending" icon={Wallet} />
      </div>
      <Button asChild variant="link" className="w-fit text-sm">
        <Link to="/author/books">See all your books</Link>
      </Button>
    </div>
  )
}
