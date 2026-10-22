import { useState } from "react"
import { RefreshCw, Sparkles } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useApi } from "@/hooks/use-api"
import { formatDateTime, formatRelative } from "@/lib/format"
import { api } from "@/services/api"

/**
 * AI-drafted reply for the open ticket. The first GET generates it; later visits get
 * the cached copy (no new AI call). If the AI is down the panel says so and the admin
 * just writes the reply by hand: nothing else on the page depends on it.
 */
export function AiDraftPanel({ ticketId, onUse }) {
  const { data: draft, loading, error, setData } = useApi(`/admin/tickets/${ticketId}/draft`)
  const [regenerating, setRegenerating] = useState(false)

  async function regenerate() {
    setRegenerating(true)
    try {
      setData(await api.post(`/admin/tickets/${ticketId}/draft`))
    } catch (err) {
      setData({ available: false, reason: err.message })
    } finally {
      setRegenerating(false)
    }
  }

  const busy = (loading && !draft) || regenerating
  const heading = (
    <h3 className="flex items-center gap-2 text-base">
      <Sparkles aria-hidden="true" className="size-4 text-brand" /> AI-drafted reply
    </h3>
  )

  if (busy) {
    return (
      <Card className="gap-3" aria-busy="true">
        {heading}
        <p className="text-sm text-muted-foreground">Writing a draft from the ticket and BookLeaf's policies…</p>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </Card>
    )
  }

  if (error || !draft?.available) {
    return (
      <Alert variant="warning">
        <AlertTitle>AI draft unavailable: write the reply yourself</AlertTitle>
        <AlertDescription>
          <p>
            {(error?.message ?? draft?.reason ?? "The AI service didn't respond").replace(/\.?$/, ".")} Everything else on
            this ticket works as normal.
          </p>
          <Button variant="secondary" size="sm" onClick={regenerate} className="mt-1">
            <RefreshCw aria-hidden="true" /> Try again
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <Card className="gap-3 border border-brand/30">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {heading}
        <span className="text-xs text-muted-foreground" title={formatDateTime(draft.generated_at)}>
          {draft.cached ? "Saved draft" : "New draft"} · {formatRelative(draft.generated_at)}
        </span>
      </div>
      {draft.stale && (
        <p className="rounded-md bg-warning-soft px-3 py-2 text-sm text-warning-strong">
          The author wrote again after this draft. Regenerate for an up-to-date reply.
        </p>
      )}
      <p className="rounded-md bg-surface-3 p-3 text-sm whitespace-pre-wrap">{draft.text}</p>
      <p className="text-xs text-muted-foreground">Check names, numbers and promises before sending. You can edit it after inserting.</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" shape="pill" onClick={() => onUse(draft.text)}>
          Use this draft
        </Button>
        <Button size="sm" shape="pill" variant="secondary" onClick={regenerate}>
          <RefreshCw aria-hidden="true" /> Regenerate
        </Button>
      </div>
    </Card>
  )
}
